import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Download, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import {
  initializeOnDeviceModel,
  isOnDeviceModelCached,
  isOnDeviceModelReady,
  ON_DEVICE_GPU_MEMORY,
  ON_DEVICE_MODEL_NAME,
  ON_DEVICE_MODEL_SIZE,
  interpretAssistantRequest,
  sendAssistantMessage,
} from '../../lib/aiAssistantService';
import {
  classifyAssistantIntent,
  formatMemberBirth,
  findMentionedMembers,
  extractAssistantDate,
  extractAssistantMonth,
  isAssistantCancellation,
  isAssistantConfirmation,
  localDateString,
  parseLessonDetails,
  parseAssistantTime,
} from '../../lib/assistantRequestRouter';

const initialMessage = {
  role: 'assistant',
  content: "안녕하세요! 회원·이용권·레슨·일정·정산·자료 관리 요청을 도와드려요. 가능한 기능은 상단의 ? 버튼에서 확인할 수 있습니다.",
};

const scheduleTimePattern = /^([01]\d|2[0-3]):(00|20|40)$/;
const assistantFeatureHelp = [
  '앱에서 할 수 있는 작업을 도와드릴게요.',
  '',
  '회원: 회원 수·목록 조회, 등록 여부 확인, 신규 등록, 상세 정보 수정·삭제',
  '이용권: 이용권 조회·추가·횟수 수정·삭제·재등록',
  '레슨/일정: 월별 횟수·현황, 반복 레슨 등록, 날짜별 일정 조회·추가·수정·삭제, 레슨 시작·종료',
  '정산: 월별 합계·내역 조회, 회원별 필터, 일별 정산 추가·수정·삭제',
  '자료: 회원/스케줄 CSV 불러오기·내려받기·빈 양식, 과거 기록, 전체 자료 초기화',
  '안내: 사용설명서와 일반 질문',
  '',
  '예: "조민식 회원 정보 보여줘", "조민식 이용권 추가", "내일 레슨 일정 열어줘", "이번 달 정산 보여줘".',
  '일반 저장·삭제는 화면에서 직접 실행합니다. 반복 레슨은 등록 내용을 확인한 뒤 채팅에서 "확정"해야 저장되며, 전체 자료 초기화는 관리자 비밀번호 확인이 필요합니다.',
].join('\n');

function assistantMemberRecord(member) {
  return {
    id: member.id,
    name: String(member.name || '').trim(),
    birth: member.birth || '',
    lessonType: member.lessonType || '',
    status: member.status || '',
    history: member.history || '',
  };
}

function updateLessonDraft(currentDraft, text, members, interpretedDetails) {
  const mentionedMembers = [
    ...findMentionedMembers(text, members),
    ...findMentionedMembers(interpretedDetails.memberName, members),
  ].filter((member, index, list) => list.findIndex((item) => String(item.id) === String(member.id)) === index)
    .map(assistantMemberRecord);
  const textDetails = parseLessonDetails(text);
  const details = {
    frequency: interpretedDetails.frequency ?? textDetails.frequency,
    lessons: interpretedDetails.lessons.length ? interpretedDetails.lessons : textDetails.lessons,
    lessonType: interpretedDetails.lessonType || textDetails.lessonType,
    startDate: interpretedDetails.startDate || textDetails.startDate,
  };
  const memberMatches = mentionedMembers.length ? mentionedMembers : currentDraft?.memberMatches || [];
  const member = mentionedMembers.length === 1
    ? mentionedMembers[0]
    : currentDraft?.member || null;
  const lessons = details.lessons.length ? details.lessons : currentDraft?.lessons || [];

  return {
    member,
    memberMatches,
    frequency: details.frequency ?? (details.lessons.length ? details.lessons.length : currentDraft?.frequency ?? null),
    lessons,
    lessonType: details.lessonType || currentDraft?.lessonType || member?.lessonType || '',
    requestedLessonType: details.lessonType || currentDraft?.requestedLessonType || '',
    startDate: details.startDate || currentDraft?.startDate || localDateString(),
    awaitingConfirmation: false,
  };
}

function getLessonDraftPrompt(draft) {
  if (draft.memberMatches.length > 1) {
    return '같은 이름의 회원이 여러 명 있어요. 회원정보 화면에서 정확한 회원을 확인한 뒤 다시 요청해 주세요.';
  }
  if (!draft.member) return '등록된 회원의 정확한 이름을 알려 주세요. 회원정보에 없는 이름은 새로 등록하지 않고 먼저 확인할게요.';
  if (draft.member.status === '탈퇴' || draft.member.history === '탈퇴') {
    return `${draft.member.name}님은 탈퇴 상태라 레슨을 추가할 수 없습니다.`;
  }
  if (!draft.frequency) return `${draft.member.name}님의 주 몇 회 레슨인가요? (주 최대 4회)`;
  if (!Number.isInteger(draft.frequency) || draft.frequency < 1 || draft.frequency > 4) {
    return '레슨은 주 1~4회까지 등록할 수 있어요. 횟수를 다시 알려 주세요.';
  }
  if (!draft.lessons.length) {
    return '요일과 시간을 알려 주세요. 예: 월요일 오후 3시, 수요일 16:00';
  }
  if (draft.lessons.length !== draft.frequency) {
    return `주 ${draft.frequency}회라고 하셨는데 요일·시간은 ${draft.lessons.length}개예요. 횟수 또는 일정을 맞춰 주세요.`;
  }
  if (draft.lessons.some((lesson) => !['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].includes(lesson.day))) {
    return '요일을 정확히 파악하지 못했어요. 요일을 다시 알려 주세요.';
  }
  if (draft.lessons.some((lesson) => !scheduleTimePattern.test(lesson.time))) {
    return '각 요일의 시간을 확인할 수 없어요. 오전/오후를 붙이거나 24시간제 HH:MM으로 알려 주세요. (20분 단위)';
  }
  const lessonKeys = draft.lessons.map((lesson) => `${lesson.day}_${lesson.time}`);
  if (new Set(lessonKeys).size !== lessonKeys.length) {
    return '같은 요일·시간이 중복됐어요. 서로 다른 레슨 시간을 알려 주세요.';
  }
  if (!['개인', '단체'].includes(draft.lessonType)) {
    return '이 회원의 레슨 유형(개인/단체)을 확인할 수 없습니다. 회원정보를 확인해 주세요.';
  }
  if (draft.requestedLessonType && draft.requestedLessonType !== draft.lessonType) {
    return `회원정보에 저장된 유형은 '${draft.lessonType}'입니다. 이 요청은 회원 유형을 변경하지 않으므로 회원정보에서 유형을 먼저 수정해 주세요.`;
  }
  const parsedStartDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.startDate)
    ? new Date(`${draft.startDate}T00:00:00`)
    : null;
  if (!parsedStartDate || Number.isNaN(parsedStartDate.getTime()) || localDateString(parsedStartDate) !== draft.startDate) {
    return '레슨 시작일을 확인할 수 없어요. 시작일을 YYYY-MM-DD 형식으로 알려 주세요.';
  }
  return '';
}

function normalizeMemberName(value) {
  const name = String(value || '').replace(/\s*(회원님|회원|님)\s*/g, '').trim();
  return name.length >= 2 && name.length <= 20 && !/[\d\n\r]/.test(name) ? name : '';
}

function isAppRequestLanguage(text) {
  return /(회원|레슨|수업|이용권|패스|등록|가입|추가|변경|수정|삭제|시작|종료|일정|스케줄|정산|매출|CSV|엑셀|파일|자료|과거\s*기록|아카이브|설명서|매뉴얼|기능|도움말|초기화)/i.test(text);
}

function formatLessonDraft(draft) {
  const sessions = draft.frequency * 4;
  const lessonLines = draft.lessons.map((lesson) => `- ${lesson.day} ${lesson.time}`).join('\n');
  return [
    `${draft.member.name}님의 기존 레슨은 유지하고, 아래 내용을 추가합니다.`,
    `- 주 ${draft.frequency}회 · ${draft.lessonType} 레슨`,
    lessonLines,
    `- 시작일: ${draft.startDate}`,
    `- 4주 일정 ${sessions}회와 ${sessions}회 이용권을 추가`,
    '',
    "이대로 등록할까요? 등록하려면 '확정', 취소하려면 '취소'라고 입력해 주세요.",
  ].join('\n');
}

export function AiAssistantDrawer({
  members = [],
  schedules = [],
  settlements = [],
  selectedMonth = localDateString().slice(0, 7),
  onNavigateToMembers,
  onNavigateToSchedules,
  onNavigateToSettlements,
  onOpenMemberDetails,
  onOpenReregister,
  onOpenScheduleEditor,
  onOpenScheduleDate,
  onOpenSettlement,
  onOpenArchive,
  onOpenClearData,
  onOpenDataManager,
  onOpenManual,
  onOpenMemberRegister,
  onOpenMemberSchedule,
  onAddMemberLessons,
  dataLoadError = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [modelState, setModelState] = useState(() => isOnDeviceModelReady() ? 'ready' : 'checking');
  const [hasCachedModel, setHasCachedModel] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState('');
  const [lessonDraft, setLessonDraft] = useState(null);
  const [duplicateRegistration, setDuplicateRegistration] = useState(null);
  const [memberRegistrationWaitingForName, setMemberRegistrationWaitingForName] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && modelState === 'ready') inputRef.current?.focus();
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages, isSending, modelState]);

  useEffect(() => {
    if (!isOpen || modelState !== 'checking') return undefined;

    let active = true;
    setModelError('');
    isOnDeviceModelCached()
      .then((cached) => {
        if (!active) return;
        setHasCachedModel(cached);
        setModelState(cached ? 'cached' : 'idle');
      })
      .catch((error) => {
        if (!active) return;
        setModelError(error.message || '저장된 모델을 확인하지 못했습니다.');
        setModelState('checking-error');
      });

    return () => {
      active = false;
    };
  }, [isOpen, modelState]);

  const prepareModel = async () => {
    setModelState('loading');
    setModelError('');
    setModelProgress(0);
    try {
      await initializeOnDeviceModel(({ progress }) => {
        setModelProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
      });
      setModelState('ready');
    } catch (error) {
      setModelError(error.message || 'AI 모델을 준비하지 못했습니다.');
      setModelState('error');
    }
  };

  const appendAssistantMessage = (content, role = 'assistant') => {
    setMessages((current) => [...current, { role, content }]);
  };

  const handleLessonDraft = async (text, currentDraft, initialInterpretation = null) => {
    setIsSending(true);
    try {
      const currentContext = currentDraft ? {
        intent: 'lesson-registration',
        memberName: currentDraft.member?.name || null,
        frequency: currentDraft.frequency,
        lessons: currentDraft.lessons,
        lessonType: currentDraft.lessonType || null,
        startDate: currentDraft.startDate,
      } : null;
      const interpretedDetails = initialInterpretation || await interpretAssistantRequest(text, currentContext);
      const updatedDraft = updateLessonDraft(currentDraft, text, members, interpretedDetails);
      const prompt = getLessonDraftPrompt(updatedDraft);
      if (prompt) {
        setLessonDraft(updatedDraft);
        appendAssistantMessage(prompt);
        return;
      }

      const confirmedDraft = { ...updatedDraft, awaitingConfirmation: true };
      setLessonDraft(confirmedDraft);
      appendAssistantMessage(formatLessonDraft(confirmedDraft));
    } catch (error) {
      appendAssistantMessage(error.message || '요청을 해석하지 못했습니다. 다시 설명해 주세요.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const getRequestInterpretation = async (text, currentContext = null) => {
    setIsSending(true);
    try {
      return await interpretAssistantRequest(text, currentContext);
    } catch (error) {
      appendAssistantMessage(error.message || '요청을 해석하지 못했습니다. 다시 설명해 주세요.', 'error');
      return null;
    } finally {
      setIsSending(false);
    }
  };

  const resolveMemberRequest = async (text, intent, initialInterpretation = null) => {
    let interpreted = initialInterpretation;
    let matches = findMentionedMembers(text, members);
    if (!matches.length && !interpreted) {
      interpreted = await getRequestInterpretation(text, { intent });
      if (!interpreted) return { matches: [], interpreted: null };
    }

    if (interpreted?.memberName) {
      matches = [
        ...matches,
        ...findMentionedMembers(interpreted.memberName, members),
      ].filter((member, index, list) => list.findIndex((item) => String(item.id) === String(member.id)) === index);
    }
    return { matches, interpreted };
  };

  const handleMemberRegistration = async (text, initialInterpretation = null) => {
    if (dataLoadError) {
      appendAssistantMessage(`회원정보를 불러오지 못해 중복 여부를 확인할 수 없습니다. ${dataLoadError}`, 'error');
      return;
    }

    const directMatches = findMentionedMembers(text, members);
    const nameFromText = text.match(/([가-힣]{2,6})\s*회원/);
    const simpleName = normalizeMemberName(directMatches[0]?.name || nameFromText?.[1]);
    const interpreted = initialInterpretation || (simpleName
      ? null
      : await getRequestInterpretation(text, { intent: 'member-registration' }));
    if (!simpleName && !interpreted) return;
    const name = simpleName || normalizeMemberName(interpreted.memberName);
    if (!name) {
      setMemberRegistrationWaitingForName(true);
      appendAssistantMessage('새로 등록할 회원의 이름을 알려 주세요.');
      return;
    }

    const existingMembers = findMentionedMembers(name, members);
    if (existingMembers.length) {
      const identities = existingMembers.map((member) => {
        const birth = formatMemberBirth(member.birth);
        return `${member.name}(${birth || '생년월일 미등록'})`;
      });
      setDuplicateRegistration({ name });
      appendAssistantMessage(
        `${identities.join(', ')} 회원이 이미 등록되어 있습니다. 동명이인일 수 있어요. 새 회원으로 추가 등록할까요? '등록' 또는 '취소'라고 답해 주세요.`
      );
      return;
    }

    if (!onOpenMemberRegister) {
      appendAssistantMessage('회원등록 화면을 열 수 없습니다.', 'error');
      return;
    }
    onOpenMemberRegister(name);
    appendAssistantMessage(`${name}님의 신규 회원등록 화면을 열었어요. 필수정보를 입력한 뒤 화면에서 저장해 주세요.`);
  };

  const handleMemberLookup = async (text, initialInterpretation = null) => {
    if (dataLoadError) {
      appendAssistantMessage(`회원정보를 불러오지 못해 등록 여부를 확인할 수 없습니다. ${dataLoadError}`, 'error');
      return;
    }

    const directMatches = findMentionedMembers(text, members);
    const interpreted = initialInterpretation || (directMatches.length
      ? null
      : await getRequestInterpretation(text, { intent: 'member-lookup' }));
    if (!directMatches.length && !interpreted) return;
    const name = normalizeMemberName(directMatches[0]?.name || interpreted.memberName);
    if (!name) {
      onNavigateToMembers?.();
      appendAssistantMessage('회원정보 화면으로 이동했어요. 확인할 회원의 이름을 알려 주시면 등록 여부를 확인해 드릴게요.');
      return;
    }

    const matches = findMentionedMembers(name, members);
    onNavigateToMembers?.();
    if (!matches.length) {
      appendAssistantMessage(`${name} 회원은 현재 등록된 회원 목록에서 찾지 못했습니다. 회원정보 화면에서 다시 확인해 주세요.`);
    } else if (matches.length === 1) {
      appendAssistantMessage(`${name} 회원은 등록되어 있습니다. 회원정보 화면으로 이동했어요.`);
    } else {
      const identities = matches.map((member) => `${member.name}(${formatMemberBirth(member.birth) || '생년월일 미등록'})`);
      appendAssistantMessage(`같은 이름의 회원이 여러 명 등록되어 있습니다: ${identities.join(', ')}. 정확한 회원은 회원정보 화면에서 확인해 주세요.`);
    }
  };

  const handleLessonChange = async (text, initialInterpretation = null) => {
    if (dataLoadError) {
      appendAssistantMessage(`회원·일정 정보를 불러오지 못했습니다. ${dataLoadError}`, 'error');
      return;
    }

    const directMatches = findMentionedMembers(text, members);
    const interpreted = initialInterpretation || (directMatches.length
      ? null
      : await getRequestInterpretation(text, { intent: 'lesson-change' }));
    if (!directMatches.length && !interpreted) return;
    const name = normalizeMemberName(directMatches[0]?.name || interpreted.memberName);
    if (!name) {
      appendAssistantMessage('어느 회원의 레슨을 변경할까요? 회원 이름을 포함해 다시 요청해 주세요.');
      return;
    }
    const matches = findMentionedMembers(name, members);
    if (!matches.length) {
      appendAssistantMessage(`${name} 회원을 찾지 못했습니다. 등록된 이름을 확인해 주세요.`);
      return;
    }
    if (matches.length > 1) {
      onNavigateToMembers?.();
      appendAssistantMessage(`같은 이름의 회원이 여러 명 있어요. 회원정보 화면에서 정확한 회원을 확인해 주세요.`);
      return;
    }
    if (/(매주|주간|고정|요일별)/.test(text)) {
      appendAssistantMessage('주간 고정 레슨의 요일·시간을 일괄 변경하는 기능은 아직 지원하지 않습니다. 날짜가 정해진 개별 일정은 스케줄표에서 수정할 수 있어요.');
      return;
    }
    if (!onOpenMemberSchedule) {
      appendAssistantMessage('스케줄표를 열 수 없습니다.', 'error');
      return;
    }
    onOpenMemberSchedule(name);
    appendAssistantMessage(`${name}님의 일정이 보이도록 스케줄표로 이동했어요. 변경할 일정을 선택하면 수정 창이 열립니다.`);
  };

  const handleMemberFeature = async (intent, text, initialInterpretation = null) => {
    if (intent === 'member-lookup') {
      await handleMemberLookup(text, initialInterpretation);
      return;
    }
    if (intent === 'member-navigation' && !findMentionedMembers(text, members).length && !initialInterpretation?.memberName) {
      onNavigateToMembers?.();
      appendAssistantMessage('회원정보 화면으로 이동했어요. 목록에서 회원을 선택해 주세요.');
      return;
    }

    const { matches } = await resolveMemberRequest(text, intent, initialInterpretation);
    if (!matches.length) {
      onNavigateToMembers?.();
      appendAssistantMessage(
        intent === 'member-navigation'
          ? '회원정보 화면으로 이동했어요. 목록에서 회원을 선택해 주세요.'
          : '회원 이름을 찾지 못했어요. 등록된 이름을 포함해 다시 요청해 주세요.'
      );
      return;
    }
    if (matches.length > 1) {
      onNavigateToMembers?.();
      appendAssistantMessage('같은 이름의 회원이 여러 명 있어요. 회원정보 목록에서 생년월일을 확인한 뒤 정확한 회원을 선택해 주세요.');
      return;
    }

    const member = matches[0];
    if ((intent === 'member-delete' || intent === 'pass-delete') && (member.role === '관리자' || member.name === '관리자')) {
      appendAssistantMessage('관리자 계정은 AI 요청으로 삭제할 수 없습니다.');
      return;
    }

    if (intent === 'pass-renew') {
      if (!onOpenReregister) {
        appendAssistantMessage('재등록 화면을 열 수 없습니다.', 'error');
        return;
      }
      onOpenReregister(member);
      appendAssistantMessage(`${member.name} 회원의 재등록 화면을 열었어요. 내용을 확인하고 화면에서 재등록을 확정해 주세요.`);
      return;
    }

    if (!onOpenMemberDetails) {
      onNavigateToMembers?.();
      appendAssistantMessage('회원정보 화면으로 이동했어요. 목록에서 회원을 선택해 주세요.');
      return;
    }
    onOpenMemberDetails(member);

    if (intent === 'member-delete') {
      appendAssistantMessage(`${member.name} 회원의 상세 화면을 열었어요. 삭제를 진행하려면 화면의 [삭제]를 누르고 확인해 주세요.`);
    } else if (intent === 'member-edit') {
      appendAssistantMessage(`${member.name} 회원의 상세 화면을 열었어요. 정보를 수정한 뒤 [수정]을 눌러 저장해 주세요.`);
    } else if (intent.startsWith('pass-')) {
      const instruction = intent === 'pass-add'
        ? '새 이용권을 추가한 뒤 [수정]을 눌러 저장해 주세요.'
        : intent === 'pass-edit'
          ? '이용권 횟수를 수정한 뒤 [수정]을 눌러 저장해 주세요.'
          : intent === 'pass-delete'
            ? '이용권의 삭제 버튼을 누른 뒤 [수정]을 눌러 변경을 확정해 주세요.'
            : '이용권 목록과 남은 횟수를 확인해 주세요.';
      appendAssistantMessage(`${member.name} 회원의 이용권이 포함된 상세 화면을 열었어요. ${instruction}`);
    } else {
      appendAssistantMessage(`${member.name} 회원의 상세 정보를 열었어요.`);
    }
  };

  const handleScheduleFeature = async (intent, text, initialInterpretation = null) => {
    const isNavigation = intent === 'schedule-navigation';
    const directMatches = findMentionedMembers(text, members);
    let interpreted = initialInterpretation;
    if (!isNavigation && !interpreted) {
      interpreted = await getRequestInterpretation(text, { intent });
      if (!interpreted) return;
    }

    const memberMatches = [
      ...directMatches,
      ...findMentionedMembers(interpreted?.memberName, members),
    ].filter((member, index, list) => list.findIndex((item) => String(item.id) === String(member.id)) === index);
    if (memberMatches.length > 1) {
      onNavigateToMembers?.();
      appendAssistantMessage('같은 이름의 회원이 여러 명 있어요. 회원정보 화면에서 정확한 회원을 확인해 주세요.');
      return;
    }
    const member = memberMatches[0] || null;
    const date = interpreted?.startDate || extractAssistantDate(text) || parseLessonDetails(text).startDate;
    const requestedMonth = extractAssistantMonth(text);
    const time = interpreted?.time || parseAssistantTime(text) || parseLessonDetails(text).lessons.find((lesson) => lesson.time)?.time || null;

    if (isNavigation) {
      if (date && onOpenScheduleDate) {
        onOpenScheduleDate(date, member?.name || '');
        appendAssistantMessage(`${date} 스케줄표를 열었어요${member ? ` (${member.name} 회원)` : ''}.`);
      } else {
        const month = extractAssistantMonth(text);
        onNavigateToSchedules?.(month);
        appendAssistantMessage(`${month ? `${month} ` : ''}스케줄표로 이동했어요. 월 이동, 회원 필터, 달력/리스트 보기로 일정을 확인해 주세요.`);
      }
      return;
    }

    if (intent === 'schedule-add') {
      if (!onOpenScheduleEditor) {
        onNavigateToSchedules?.(requestedMonth);
        appendAssistantMessage('스케줄표로 이동했어요. 날짜를 선택하고 [일정 추가]를 눌러 주세요.');
        return;
      }
      const scheduledDate = date || localDateString();
      onOpenScheduleEditor({
        date: scheduledDate,
        time: time || '10:30',
        name: member?.name || '',
        status: '예약',
        note: '',
      });
      appendAssistantMessage(
        `일정 입력 화면을 열었어요. ${member ? `${member.name} 회원, ` : '회원 선택, '}${scheduledDate} ${time || '10:30'}로 채웠습니다. 내용을 확인한 뒤 저장해 주세요.`
      );
      return;
    }

    let candidates = schedules || [];
    if (member) candidates = candidates.filter((schedule) => schedule.name === member.name);
    if (date) candidates = candidates.filter((schedule) => schedule.date === date);
    else if (requestedMonth) candidates = candidates.filter((schedule) => String(schedule.date || '').startsWith(requestedMonth));
    if (time) candidates = candidates.filter((schedule) => schedule.time === time);
    if (member && date && !time) {
      candidates = candidates.filter((schedule) => schedule.date === date);
    }
    if ((member || date) && candidates.length === 1 && onOpenScheduleEditor) {
      onOpenScheduleEditor(candidates[0]);
      const actionLabel = intent === 'schedule-delete'
        ? '삭제 확인 화면에서 다시 확정해 주세요.'
        : intent === 'lesson-start'
          ? '레슨 시작을 누르고 확인해 주세요.'
          : intent === 'lesson-finish'
            ? '레슨 종료를 누르고 확인해 주세요.'
            : '일정 내용을 수정한 뒤 저장해 주세요.';
      appendAssistantMessage(`${candidates[0].name} 회원의 ${candidates[0].date} ${candidates[0].time} 일정을 열었어요. ${actionLabel}`);
      return;
    }

    if (date && onOpenScheduleDate) {
      onOpenScheduleDate(date, member?.name || '');
      appendAssistantMessage(
        candidates.length
          ? `${date} 일정 목록을 열었어요. 수정할 일정을 선택해 주세요.`
          : `${date} 스케줄표를 열었어요. 해당 날짜에 요청한 일정이 있는지 확인해 주세요.`
      );
    } else {
      if (member && onOpenMemberSchedule) onOpenMemberSchedule(member.name);
      else onNavigateToSchedules?.(requestedMonth);
      appendAssistantMessage(member
        ? `${member.name} 회원의 일정을 찾으려면 날짜나 시간을 더 알려 주세요. 회원 필터를 적용해 스케줄표로 이동했어요.`
        : '일정을 특정할 수 없어요. 회원 이름과 날짜를 포함해 다시 요청해 주세요. 스케줄표로 이동했습니다.');
    }
  };

  const handleSettlementFeature = async (intent, text, initialInterpretation = null) => {
    const isNavigation = intent === 'settlement-navigation';
    const directMatches = findMentionedMembers(text, members);
    let interpreted = initialInterpretation;
    if (!isNavigation && !interpreted) {
      interpreted = await getRequestInterpretation(text, { intent });
      if (!interpreted) return;
    }
    const memberMatches = [
      ...directMatches,
      ...findMentionedMembers(interpreted?.memberName, members),
    ].filter((member, index, list) => list.findIndex((item) => String(item.id) === String(member.id)) === index);
    if (memberMatches.length > 1) {
      onNavigateToSettlements?.();
      appendAssistantMessage('같은 이름의 회원이 여러 명 있어요. 회원정보 화면에서 정확한 회원을 확인해 주세요.');
      return;
    }

    const member = memberMatches[0] || null;
    const explicitDate = interpreted?.startDate || extractAssistantDate(text);
    const requestedMonth = extractAssistantMonth(text);
    const date = explicitDate || `${requestedMonth || localDateString().slice(0, 7)}-01`;
    const hasSpecificTarget = Boolean(explicitDate || requestedMonth);
    if (intent === 'settlement-add') {
      const entryDate = explicitDate || localDateString();
      onOpenSettlement?.({ date: entryDate, memberId: member?.id, openEditor: true });
      appendAssistantMessage(`${entryDate} 정산 입력 화면을 열었어요${member ? ` (${member.name} 회원)` : ''}. 금액과 내용을 확인한 뒤 저장해 주세요.`);
      return;
    }

    if (intent === 'settlement-edit' || intent === 'settlement-delete') {
      let candidates = (settlements || []).filter((entry) => entry.type === '일별정산');
      if (member) candidates = candidates.filter((entry) => String(entry.member_id) === String(member.id));
      if (explicitDate) candidates = candidates.filter((entry) => entry.date === explicitDate);
      else if (requestedMonth) candidates = candidates.filter((entry) => String(entry.date || '').startsWith(requestedMonth));
      if (hasSpecificTarget && candidates.length === 1) {
        onOpenSettlement?.({ date, memberId: member?.id, entry: candidates[0], openEditor: true });
        appendAssistantMessage(
          intent === 'settlement-delete'
            ? `${date} 정산 내역을 열었어요. 삭제 버튼을 눌러 삭제해 주세요.`
            : `${date} 정산 내역을 열었어요. 내용을 수정한 뒤 저장해 주세요.`
        );
        return;
      }
    }

    onOpenSettlement?.({ date, memberId: member?.id });
    appendAssistantMessage(
      /(월\s*레슨비)/.test(text)
        ? `${date.slice(0, 7)} 정산 화면을 열었어요. 월 레슨비 내역은 조회할 수 있지만 이 화면에서 수정할 수는 없습니다.`
        : `${date.slice(0, 7)} 정산 화면으로 이동했어요${member ? ` (${member.name} 회원 필터)` : ''}. 달력/리스트에서 내역을 확인해 주세요.`
    );
  };

  const handleDataFeature = (intent) => {
    if (intent === 'archive-navigation') {
      onOpenArchive?.();
      appendAssistantMessage('과거 기록 화면을 열었어요. 연도를 선택해 보관 자료를 조회해 주세요.');
      return;
    }
    if (intent === 'clear-data') {
      onOpenClearData?.();
      appendAssistantMessage('전체 자료 삭제 확인 화면을 열었어요. 관리자 비밀번호 확인과 최종 절차 없이는 자료가 삭제되지 않습니다.');
      return;
    }
    if (intent === 'manual') {
      onOpenManual?.();
      appendAssistantMessage('사용설명서를 열었어요.');
      return;
    }
    onOpenDataManager?.();
    const task = intent === 'data-import'
      ? '불러오기'
      : intent === 'data-export'
        ? '내려받기'
        : '빈 양식 다운로드';
    appendAssistantMessage(`자료 관리 메뉴를 열었어요. 회원 또는 스케줄 항목에서 [${task}]를 선택해 주세요. 파일 선택과 가져오기/교체는 화면에서 직접 확인해야 합니다.`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setDraft('');

    if (duplicateRegistration) {
      if (isAssistantCancellation(content)) {
        setDuplicateRegistration(null);
        appendAssistantMessage('신규 회원 추가를 취소했어요. 데이터는 변경되지 않았습니다.');
      } else if (isAssistantConfirmation(content)) {
        if (!onOpenMemberRegister) {
          appendAssistantMessage('회원등록 화면을 열 수 없습니다.', 'error');
          return;
        }
        onOpenMemberRegister(duplicateRegistration.name);
        setDuplicateRegistration(null);
        appendAssistantMessage(`${duplicateRegistration.name}님의 신규 회원등록 화면을 열었어요. 다른 분인지 확인한 뒤 필요한 정보를 입력하고 저장해 주세요.`);
      } else {
        appendAssistantMessage("새 회원으로 추가할지 확인이 필요해요. '등록' 또는 '취소'라고 답해 주세요.");
      }
      return;
    }

    if (memberRegistrationWaitingForName) {
      setMemberRegistrationWaitingForName(false);
      await handleMemberRegistration(content);
      return;
    }

    if (lessonDraft) {
      if (isAssistantCancellation(content)) {
        setLessonDraft(null);
        appendAssistantMessage('레슨 등록을 취소했어요. 데이터는 변경되지 않았습니다.');
        return;
      }

      if (lessonDraft.awaitingConfirmation && isAssistantConfirmation(content)) {
        setIsSending(true);
        try {
          if (!onAddMemberLessons) throw new Error('레슨 등록 기능을 사용할 수 없습니다.');
          const result = await onAddMemberLessons({
            action: 'appendMemberLessons',
            memberId: lessonDraft.member.id,
            lessons: lessonDraft.lessons,
            startDate: lessonDraft.startDate,
          });
          setLessonDraft(null);
          appendAssistantMessage(
            `${lessonDraft.member.name}님의 레슨 등록이 완료됐어요. ${result.passId ? `새 이용권 ${lessonDraft.frequency * 4}회와 4주 일정 ${lessonDraft.frequency * 4}개를 저장했습니다.` : '서버 저장 결과를 확인했습니다.'}`
          );
        } catch (error) {
          appendAssistantMessage(error.message || '레슨 등록에 실패했습니다. 데이터는 저장되지 않았습니다.', 'error');
        } finally {
          setIsSending(false);
        }
        return;
      }

      if (lessonDraft.awaitingConfirmation) {
        const details = parseLessonDetails(content);
        const mentioned = findMentionedMembers(content, members);
        if (!details.lessons.length && !details.frequency && !details.lessonType && !details.startDate && !mentioned.length) {
          appendAssistantMessage("등록 내용을 바꾸거나 '확정' 또는 '취소'라고 입력해 주세요.");
          return;
        }
      }

      await handleLessonDraft(content, lessonDraft);
      return;
    }

    let intent = classifyAssistantIntent(content);
    let interpretedRequest = null;
    if (intent === 'chat' && isAppRequestLanguage(content)) {
      interpretedRequest = await getRequestInterpretation(content);
      if (!interpretedRequest) return;
      intent = interpretedRequest.intent;
    }
    if (intent === 'help') {
      appendAssistantMessage(assistantFeatureHelp);
      return;
    }
    if (intent === 'member-count') {
      const count = members.filter((member) => member.role !== '관리자').length;
      appendAssistantMessage(`현재 등록된 회원은 ${count}명입니다.`);
      return;
    }
    if (intent === 'schedule-summary') {
      const month = extractAssistantMonth(content) || selectedMonth;
      const monthSchedules = schedules.filter((schedule) => String(schedule.date || '').startsWith(month));
      const completed = monthSchedules.filter((schedule) => schedule.status === '완료').length;
      const memberCount = new Set(monthSchedules.map((schedule) => schedule.name).filter(Boolean)).size;
      appendAssistantMessage(`${month} 레슨 현황은 완료 ${completed}회 / 전체 ${monthSchedules.length}회, 회원 ${memberCount}명입니다.`);
      return;
    }
    if (intent === 'settlement-summary') {
      const month = extractAssistantMonth(content) || selectedMonth;
      const memberMatches = findMentionedMembers(content, members);
      if (memberMatches.length > 1) {
        appendAssistantMessage('같은 이름의 회원이 여러 명 있어요. 회원 이름을 더 정확히 알려 주세요.');
        return;
      }
      const selectedMember = memberMatches[0];
      const monthEntries = settlements.filter((entry) => String(entry.date || '').startsWith(month));
      const entries = selectedMember
        ? monthEntries.filter((entry) => String(entry.member_id) === String(selectedMember.id))
        : monthEntries;
      const total = entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
      appendAssistantMessage(
        `${month}${selectedMember ? ` ${selectedMember.name} 회원` : ''} 정산 합계는 ${total.toLocaleString('ko-KR')}원입니다. (${entries.length}건)`
      );
      return;
    }
    if (['manual', 'archive-navigation', 'clear-data', 'data-import', 'data-export', 'data-template'].includes(intent)) {
      handleDataFeature(intent);
      return;
    }
    if (intent === 'member-registration') {
      await handleMemberRegistration(content, interpretedRequest);
      return;
    }
    if ([
      'member-lookup',
      'member-navigation',
      'member-edit',
      'member-delete',
      'pass-add',
      'pass-edit',
      'pass-delete',
      'pass-view',
      'pass-renew',
    ].includes(intent)) {
      await handleMemberFeature(intent, content, interpretedRequest);
      return;
    }
    if (intent === 'lesson-change') {
      if (extractAssistantDate(content) || parseAssistantTime(content)) {
        await handleScheduleFeature('schedule-edit', content, interpretedRequest);
        return;
      }
      await handleLessonChange(content, interpretedRequest);
      return;
    }
    if (intent === 'lesson-registration') {
      await handleLessonDraft(content, null, interpretedRequest);
      return;
    }
    if ([
      'schedule-navigation',
      'schedule-add',
      'schedule-edit',
      'schedule-delete',
      'lesson-start',
      'lesson-finish',
    ].includes(intent)) {
      await handleScheduleFeature(intent, content, interpretedRequest);
      return;
    }
    if ([
      'settlement-navigation',
      'settlement-add',
      'settlement-edit',
      'settlement-delete',
    ].includes(intent)) {
      await handleSettlementFeature(intent, content, interpretedRequest);
      return;
    }
    if (intent === 'unsupported') {
      appendAssistantMessage('요청하신 작업은 현재 앱에서 직접 처리할 수 있는 기능 범위를 벗어납니다. 지원되는 화면에서 진행하거나 요청 내용을 바꿔 주세요.');
      return;
    }

    setIsSending(true);

    try {
      const recentMessages = nextMessages.filter((message) => message.role !== 'error').slice(-12);
      const boundedMessages = [];
      let totalCharacters = 0;
      for (const message of recentMessages.reverse()) {
        if (totalCharacters + message.content.length > 12000) {
          if (message.role === 'user' && boundedMessages.length === 0) {
            boundedMessages.unshift({ role: message.role, content: message.content.slice(-12000) });
          }
          break;
        }
        boundedMessages.unshift({ role: message.role, content: message.content });
        totalCharacters += message.content.length;
      }
      const reply = await sendAssistantMessage(boundedMessages);
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: 'error', content: error.message || 'AI 응답에 실패했습니다. 다시 시도해 주세요.' },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className={`ai-assistant${isOpen ? ' ai-assistant--open' : ''}`}>
      {isOpen ? (
        <section className="ai-assistant__panel" role="dialog" aria-modal="false" aria-labelledby="ai-assistant-title">
          <header className="ai-assistant__header">
            <div className="ai-assistant__heading">
              <span className="ai-assistant__mark" aria-hidden="true"><Sparkles size={18} /></span>
              <div>
                <h2 id="ai-assistant-title">AI에게 물어보기</h2>
                <p>이 기기에서 실행</p>
              </div>
            </div>
            <button
              className="ai-assistant__icon-button"
              type="button"
              onClick={() => appendAssistantMessage(assistantFeatureHelp)}
              aria-label="사용 가능한 기능 보기"
              title="사용 가능한 기능"
            >
              <CircleHelp size={18} />
            </button>
            <button className="ai-assistant__icon-button" type="button" onClick={() => setIsOpen(false)} aria-label="AI 채팅 닫기">
              <X size={20} />
            </button>
          </header>

          {modelState === 'ready' ? (
            <div className="ai-assistant__messages" aria-live="polite" aria-relevant="additions text">
              {messages.map((message, index) => (
                <div
                  className={`ai-assistant__message ai-assistant__message--${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <p>{message.content}</p>
                </div>
              ))}
              {isSending && (
                <div className="ai-assistant__message ai-assistant__message--assistant" role="status">
                  <p>기기에서 답변을 작성하고 있어요…</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="ai-assistant__model-setup">
              <span className="ai-assistant__model-icon" aria-hidden="true"><Download size={22} /></span>
              <h3>
                {modelState === 'checking'
                  ? '저장된 모델 확인 중...'
                  : modelState === 'checking-error'
                    ? '저장된 모델 상태를 확인하지 못했습니다'
                    : hasCachedModel
                      ? '이 기기에 저장된 모델이 있습니다'
                      : '처음 한 번 AI 모델을 준비해 주세요'}
              </h3>
              {modelState === 'checking' ? (
                <p>이 기기에 다운로드된 모델이 있는지 확인하고 있어요.</p>
              ) : modelState === 'checking-error' ? (
                <p>저장 상태를 확인하지 못해 모델 다운로드 여부를 판단할 수 없습니다.</p>
              ) : hasCachedModel ? (
                <p>저장된 모델을 다시 불러올 수 있어요. 추가 다운로드는 필요하지 않습니다.</p>
              ) : (
                <p>모델 파일 약 {ON_DEVICE_MODEL_SIZE}. 첫 다운로드에는 인터넷이 필요하며, 이후 질문은 이 기기에서 처리돼 API 사용료가 없습니다.</p>
              )}
              <p className="ai-assistant__model-requirement">
                호환 GPU와 약 {ON_DEVICE_GPU_MEMORY}의 GPU 메모리가 필요합니다. 전용 VRAM이 부족한 경우 공유 GPU 메모리와 WebGPU 지원에 따라 실행 여부가 달라질 수 있어요.
              </p>
              {modelState === 'checking' ? (
                <p role="status" aria-live="polite">저장 상태를 확인하고 있습니다…</p>
              ) : modelState === 'checking-error' ? (
                <>
                  {modelError && <p className="ai-assistant__model-error" role="alert">{modelError}</p>}
                  <button className="ai-assistant__download-button" type="button" onClick={() => setModelState('checking')}>
                    다시 확인
                  </button>
                </>
              ) : modelState === 'loading' ? (
                <div className="ai-assistant__download-progress" role="status" aria-live="polite">
                  <div className="ai-assistant__progress-track">
                    <div className="ai-assistant__progress-value" style={{ width: `${modelProgress}%` }} />
                  </div>
                  <p>{hasCachedModel ? '저장된 모델 준비 중…' : '모델 다운로드 및 준비 중…'} {modelProgress}%</p>
                  <p className="ai-assistant__model-requirement">다운로드 중에는 창을 닫지 말아 주세요.</p>
                </div>
              ) : (
                <>
                  {modelError && <p className="ai-assistant__model-error" role="alert">{modelError}</p>}
                  <button className="ai-assistant__download-button" type="button" onClick={prepareModel}>
                    <Download size={17} />
                    {modelState === 'error'
                      ? '다시 시도'
                      : hasCachedModel
                        ? '저장된 모델 불러오기'
                        : '모델 다운로드 및 시작'}
                  </button>
                </>
              )}
            </div>
          )}

          {modelState === 'ready' && (
            <form className="ai-assistant__form" onSubmit={handleSubmit}>
              <label className="ai-assistant__sr-only" htmlFor="ai-assistant-input">AI에게 보낼 질문</label>
              <textarea
                id="ai-assistant-input"
                ref={inputRef}
                rows={1}
                maxLength={4000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="궁금한 점을 입력하세요"
                disabled={isSending}
              />
              <button type="submit" aria-label="질문 보내기" disabled={isSending || !draft.trim()}>
                <Send size={18} />
              </button>
            </form>
          )}
          <p className="ai-assistant__notice">
            {modelState === 'ready'
              ? '대화 내용은 외부로 전송되지 않고 이 기기에서 처리됩니다.'
              : `${ON_DEVICE_MODEL_NAME} · 약 ${ON_DEVICE_MODEL_SIZE} 다운로드 · GPU 메모리 약 ${ON_DEVICE_GPU_MEMORY} 필요`}
          </p>
        </section>
      ) : (
        <button className="ai-assistant__launcher" type="button" onClick={() => setIsOpen(true)}>
          <MessageCircle size={20} aria-hidden="true" />
          <span>AI에게 물어보기</span>
        </button>
      )}
    </div>
  );
}
