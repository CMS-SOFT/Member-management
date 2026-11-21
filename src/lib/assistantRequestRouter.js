const weekdayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const weekdayPattern = /(일요일|월요일|화요일|수요일|목요일|금요일|토요일|일|월|화|수|목|금|토)/g;
const weekdayNumbers = {
  일: 0, 일요일: 0,
  월: 1, 월요일: 1,
  화: 2, 화요일: 2,
  수: 3, 수요일: 3,
  목: 4, 목요일: 4,
  금: 5, 금요일: 5,
  토: 6, 토요일: 6,
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

export function classifyAssistantIntent(text) {
  const content = String(text || '').replace(/\s+/g, ' ').trim();
  const asksToOpen = /(보여|보고\s*싶|조회|열어|이동|확인|찾아|있어|있나요|있습니까|있니|존재|알려|몇\s*명)/.test(content);
  const mentionsMember = /회원/.test(content);
  const mentionsPass = /(이용권|패스)/.test(content);
  const mentionsSchedule = /(스케줄|일정|예약)/.test(content);

  if (/(도움말|기능\s*(?:목록|안내)|무슨\s*기능|할\s*수\s*있는\s*일)/.test(content)) return 'help';
  if (/(사용\s*설명서|사용설명서|매뉴얼|도움말\s*문서)/.test(content)) return 'manual';
  if (/(과거\s*기록|지난\s*기록|아카이브|보관\s*기록)/.test(content)) return 'archive-navigation';
  if (/(?:(?:전체|모든|모두|전부).*(?:자료|데이터)|(?:자료|데이터).*(?:전체|모든|모두|전부)).*(?:지우|삭제|초기화)/.test(content)) return 'clear-data';

  if (/(빈\s*양식|템플릿)/.test(content) && /(회원|스케줄|일정|파일|자료)/.test(content)) return 'data-template';
  if (/(불러오기|가져오기|업로드|읽어\s*들여)/.test(content) && /(파일|CSV|엑셀|자료)/i.test(content)) return 'data-import';
  if (/(내려받기|다운로드|내보내기|백업)/.test(content) && /(회원|스케줄|일정|파일|자료)/.test(content)) return 'data-export';

  if (mentionsPass) {
    if (/(재등록|갱신|연장|다시\s*등록)/.test(content)) return 'pass-renew';
    if (/(삭제|지워|제거)/.test(content)) return 'pass-delete';
    if (/(수정|변경|바꾸|늘려|줄여)/.test(content)) return 'pass-edit';
    if (/(추가|등록|충전)/.test(content)) return 'pass-add';
    if (asksToOpen || /(몇\s*회|잔여|남은|소진)/.test(content)) return 'pass-view';
  }

  if (/(정산|매출|월\s*레슨비)/.test(content)) {
    if (/(삭제|지워)/.test(content)) return 'settlement-delete';
    if (/(수정|변경|바꿔)/.test(content)) return 'settlement-edit';
    if (/(입력|추가|등록|기록)/.test(content) && !asksToOpen) return 'settlement-add';
    if (/(합계|총액|얼마|총\s*금액|금액\s*확인)/.test(content)) return 'settlement-summary';
    if (asksToOpen || /(내역|달력|리스트|목록|월별)/.test(content)) return 'settlement-navigation';
  }

  if (mentionsMember && /(회원\s*수|회원이?\s*몇\s*명|총\s*회원|몇\s*명의?\s*회원)/.test(content)) return 'member-count';
  if (mentionsMember && /(삭제|지워|제거)/.test(content)) return 'member-delete';
  if (mentionsMember && /(수정|변경|바꿔|고쳐)/.test(content)) return 'member-edit';

  const asksToChangeLesson = /(레슨|수업)/.test(content) && /(변경|수정|바꾸|고쳐)/.test(content);
  if (/(레슨|일정|스케줄)/.test(content) && /(몇\s*회|횟수|요약|현황|통계)/.test(content)) return 'schedule-summary';
  if (/(레슨|수업)/.test(content) && /(시작|진행\s*시작)/.test(content)) return 'lesson-start';
  if (/(레슨|수업)/.test(content) && /(종료|완료|마쳤|끝내)/.test(content)) return 'lesson-finish';
  if (/(레슨|수업|스케줄|일정|예약)/.test(content) && /(삭제|지워|제거)/.test(content)) return 'schedule-delete';
  if (mentionsSchedule && /(수정|변경|바꿔|고쳐)/.test(content)) return 'schedule-edit';

  const hasRecurringLesson = /(매주|주간|고정|정규|주\s*\d+\s*회|요일별)/.test(content);
  const asksToCreateSchedule = /(레슨|수업|일정|스케줄|예약)/.test(content) &&
    /(등록|추가|예약|잡아)/.test(content) &&
    !/(보여|조회|열어|이동|확인|찾아|알려|내역)/.test(content);
  if (asksToCreateSchedule && hasRecurringLesson) return 'lesson-registration';
  if (asksToCreateSchedule) return 'schedule-add';

  if (mentionsMember && /(등록|가입|추가|넣어)/.test(content) &&
    !/(등록(?:된|되어|돼|됐)|조회|확인|있는지|있어|방법|어떻게|알려)/.test(content)) {
    return 'member-registration';
  }

  const asksWhetherMemberExists =
    /회원\s*(?:중에|중에서|중)\s*.+(?:있어|있나요|있습니까|있니|존재)/.test(content) ||
    /.+\s회원(?:님)?\s*(?:있어|있나요|있습니까|있니|존재|등록되어\s*있어)/.test(content) ||
    /회원\s*(?:중에|중에서|중)\s*.+등록(?:되어|돼|됐)/.test(content);
  if (asksWhetherMemberExists) return 'member-lookup';
  if (mentionsMember && /(정보|목록|리스트|명단)/.test(content) && asksToOpen) return 'member-navigation';
  if (mentionsMember && asksToOpen && !/(등록|가입)/.test(content)) return 'member-navigation';

  if (mentionsSchedule && asksToOpen) return 'schedule-navigation';
  if (asksToChangeLesson) return 'lesson-change';
  if (/(스케줄|일정|레슨\s*예약)/.test(content) && asksToOpen) return 'schedule-navigation';
  return 'chat';
}

export function findMentionedMembers(text, members = []) {
  const normalizedText = normalizeText(text);
  const matches = members.filter((member) => {
    const name = normalizeText(member?.name);
    return name && normalizedText.includes(name);
  });
  if (!matches.length) return [];

  const longestNameLength = Math.max(...matches.map((member) => normalizeText(member.name).length));
  return matches.filter((member) => normalizeText(member.name).length === longestNameLength);
}

function parseTime(segment) {
  const meridianMatch = segment.match(/(오전|오후)\s*(\d{1,2})(?::(\d{2})|시(?:\s*(\d{1,2})\s*분?)?)/);
  if (meridianMatch) {
    let hour = Number(meridianMatch[2]);
    const minute = Number(meridianMatch[3] || meridianMatch[4] || 0);
    if (hour < 1 || hour > 12) return null;
    if (meridianMatch[1] === '오전') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
    if (![0, 20, 40].includes(minute)) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const clockMatch = segment.match(/(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  if (clockMatch) {
    const minute = Number(clockMatch[2]);
    if (![0, 20, 40].includes(minute)) return null;
    return `${String(Number(clockMatch[1])).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const twentyFourHourMatch = segment.match(/(?:^|\s)(1[3-9]|2[0-3])시(?:\s*(\d{1,2})\s*분?)?/);
  if (twentyFourHourMatch) {
    const minute = Number(twentyFourHourMatch[2] || 0);
    if (![0, 20, 40].includes(minute)) return null;
    return `${twentyFourHourMatch[1]}:${String(minute).padStart(2, '0')}`;
  }

  return null;
}

export function parseLessonDetails(text) {
  const content = String(text || '');
  const frequencyMatch = content.match(/주\s*(\d+)\s*회/);
  const typeMatch = content.match(/(개인|1\s*:\s*1|일대일|단체|그룹)/);
  const lessonType = typeMatch
    ? (/단체|그룹/.test(typeMatch[1]) ? '단체' : '개인')
    : null;
  const dateMatch = content.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
  let startDate = null;
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) {
      startDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dayMatches = [...content.matchAll(weekdayPattern)];
  const lessons = dayMatches.map((match, index) => {
    const segmentStart = match.index + match[0].length;
    const segmentEnd = dayMatches[index + 1]?.index ?? content.length;
    const day = weekdayNames[weekdayNumbers[match[0]]];
    return { day, time: parseTime(content.slice(segmentStart, segmentEnd)) || '' };
  });

  return {
    frequency: frequencyMatch ? Number(frequencyMatch[1]) : null,
    lessons,
    lessonType,
    startDate,
  };
}

export function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function extractAssistantDate(text, today = new Date()) {
  const content = String(text || '');
  const exactDate = content.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
  if (exactDate) {
    const [, year, month, day] = exactDate;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) {
      return localDateString(date);
    }
    return null;
  }

  const koreanDate = content.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanDate) {
    const [, month, day] = koreanDate;
    const date = new Date(today.getFullYear(), Number(month) - 1, Number(day));
    if (date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) {
      return localDateString(date);
    }
    return null;
  }

  const offset = /모레/.test(content) ? 2 : /내일/.test(content) ? 1 : /오늘/.test(content) ? 0 : null;
  if (offset === null) return null;
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return localDateString(date);
}

export function extractAssistantMonth(text, today = new Date()) {
  const content = String(text || '');
  const explicitMonth = content.match(/(20\d{2})년\s*(\d{1,2})월/);
  if (explicitMonth) {
    const month = Number(explicitMonth[2]);
    return month >= 1 && month <= 12 ? `${explicitMonth[1]}-${String(month).padStart(2, '0')}` : null;
  }

  const offset = /다음\s*달|다음달|익월/.test(content)
    ? 1
    : /지난\s*달|지난달|저번\s*달|저번달/.test(content)
      ? -1
      : /이번\s*달|이번달|이달|금월/.test(content)
        ? 0
        : null;
  if (offset === null) return null;
  const monthDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  return `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
}

export function parseAssistantTime(text) {
  return parseTime(String(text || ''));
}

export function formatMemberBirth(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }
  if (digits.length === 6) {
    const shortYear = Number(digits.slice(0, 2));
    const year = shortYear > 50 ? 1900 + shortYear : 2000 + shortYear;
    return `${year}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`;
  }
  return '';
}

export function isAssistantConfirmation(text) {
  const content = String(text || '').trim().replace(/[,.!?，。]/g, ' ').replace(/\s+/g, ' ');
  return /^(네|예|응|확정|확정해줘|확인|확인해줘|등록|등록해|등록하자|등록하겠습니다|등록할게|등록할께|등록할게요|등록할께요|등록할래요|등록할래|진행|좋아요|맞아요|그대로)(\s*(등록|등록해|등록하자|등록하겠습니다|등록할게|등록할께|등록할게요|등록할께요|등록해줘|진행해줘|해주세요|해줘|할게요|할께요|할게|할께|그렇게 해))?$/.test(content);
}

export function isAssistantCancellation(text) {
  const content = String(text || '').trim().replace(/[,.!?，。]/g, ' ').replace(/\s+/g, ' ');
  return /^(취소|아니오|아니요|그만|중단|안 할래요|안할래요|취소할게요)$/.test(content);
}
