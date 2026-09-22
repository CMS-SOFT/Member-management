import { useEffect, useState } from 'react';
import { normalizeSchedules, mergeSheetMembers, isCompletedLesson } from '../lib/sheet';
import { collectArchivableSchedules, removeSchedulesByIds, requestBootstrap, clearAllData } from '../lib/db';
import { schedulesToCsv, downloadCsv } from '../lib/csv';

// 같은 일정인지 판정: id 또는 rowNumber가 일치하면 동일 항목으로 봅니다.
const isSameSchedule = (a, b) =>
  (a.id != null && String(a.id) === String(b.id)) ||
  (a.rowNumber != null && String(a.rowNumber) === String(b.rowNumber));

/**
 * 관리자 화면의 데이터와 동작(회원·이용권·스케줄·아카이브)을 한곳에 모은 훅.
 * 화면(Admin.jsx)은 이 훅이 돌려주는 값/함수만 조립해서 그립니다.
 */
export function useAdminData({ initialMembers, schedules, onSchedulesChange, passes, onPassesChange, apiRequest }) {
  const [members, setMembers] = useState(initialMembers || []);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [toast, setToast] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('전체');
  const [scheduleView, setScheduleView] = useState('calendar');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [reregisterMember, setReregisterMember] = useState(null);
  const [isClearConfirm, setIsClearConfirm] = useState(false);

  const lessons = schedules || [];
  const passList = passes || [];

  // 회원별 이용권 및 진행 횟수 계산 함수
  const passSummaryOf = (name, lessonDate) => {
    // 🌟 1순위: 인자로 넘어온 날짜
    // 🌟 2순위: 폼 객체(form)에 들어있는 날짜
    // 🌟 3순위: 오늘 날짜나 회원의 첫 번째 레슨 날짜 방어선
    const resolvedDate = lessonDate
      || (typeof form !== 'undefined' && form && form.date)
      || (lessons.find(l => String(l.name || '').trim() === String(name || '').trim())?.date)
      || '2026-08-12';

    console.log('--- passSummaryOf 실행 --- name:', name, '| resolvedDate:', resolvedDate);

    if (!name) {
      return { used: 1, total: 4 };
    }

    const cleanName = (n) => String(n || '').trim();
    const toNum = (d) => {
      if (!d) return 0;
      return Number(String(d).replace(/[^0-9]/g, '').substring(0, 8));
    };

    // 1. 해당 회원의 이용권 목록을 등록일 오름차순으로 정렬
    const owned = passList
      .filter((pass) => cleanName(pass.name) === cleanName(name))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (!owned.length) return { used: 1, total: 4 };

    const targetNum = toNum(resolvedDate);

    // 2. 현재 날짜가 속하는 이용권 찾기 (다음 이용권 전까지)
    let targetIndex = 0;
    for (let i = 0; i < owned.length; i++) {
      const currDate = toNum(owned[i].date);
      const nextDate = owned[i + 1] ? toNum(owned[i + 1].date) : 99991231;

      if (targetNum >= currDate && targetNum < nextDate) {
        targetIndex = i;
        break;
      }
      if (i === 0 && targetNum < currDate) {
        targetIndex = 0;
        break;
      }
      if (i === owned.length - 1 && targetNum >= currDate) {
        targetIndex = i;
        break;
      }
    }

    const currentPass = owned[targetIndex];
    const totalCount = currentPass.total !== undefined && currentPass.total !== null && currentPass.total !== ''
      ? Number(currentPass.total)
      : 4;

    const currentPassDate = toNum(currentPass.date);
    const nextPassDate = owned[targetIndex + 1] ? toNum(owned[targetIndex + 1].date) : 99991231;

    // 3. 현재 이용권 기간 내의 레슨들만 추출 후 날짜순 정렬
    const memberLessons = lessons
      .filter((l) => cleanName(l.name) === cleanName(name))
      .map((l) => ({ ...l, numDate: toNum(l.date) }))
      .filter((l) => l.numDate >= currentPassDate && l.numDate < nextPassDate)
      .sort((a, b) => a.numDate - b.numDate);

    // 4. 순번 찾기
    let matchIndex = memberLessons.findIndex((l) => l.numDate === targetNum);

    let usedCount = 1;
    if (matchIndex !== -1) {
      usedCount = matchIndex + 1;
    } else {
      const temp = [...memberLessons, { numDate: targetNum }];
      temp.sort((a, b) => a.numDate - b.numDate);
      const tempIndex = temp.findIndex((l) => l.numDate === targetNum);
      usedCount = tempIndex !== -1 ? tempIndex + 1 : memberLessons.length;
    }

    usedCount = Math.min(Math.max(usedCount, 1), totalCount);

    return {
      used: usedCount,
      total: totalCount
    };
  };

  // 회원 목록 표기용: 활성 이용권이 있으면 그 요약, 없으면 가장 최근 이용권(완료 포함)을 반환합니다.
  const memberPassSummary = (name) => {
    const active = passSummaryOf(name);
    if (active) return { ...active, done: false };
    const owned = passList.filter((pass) => pass.name === name);
    if (!owned.length) return null;
    const latest = owned.slice().sort((a, b) => Number(b.id) - Number(a.id))[0];
    return { used: Number(latest.used || 0), total: Number(latest.total || 0), done: latest.status === '완료' };
  };

  // 스케줄 추가 가능 여부: 이용중이며 남은 횟수가 있는 이용권을 보유한 회원만 등록 가능.
  const canSchedule = (name) => passList.some((pass) => pass.name === name && pass.status !== '완료' && Number(pass.remaining) > 0);

  // 조건 충족 시 알림 메시지를 띄웁니다. (이용권 완료/소진 임박)
  const notifyPassChange = (changedPass) => {
    if (!changedPass) return;
    if (changedPass.status === '완료') setToast(`${changedPass.name} 회원의 이용권을 다 썼어요. '완료'로 바뀌었어요.`);
    else if (Number(changedPass.remaining) <= 1) setToast(`${changedPass.name} 회원의 이용권이 ${changedPass.remaining}회 남았어요.`);
  };

  // 알림은 4초 후 자동으로 사라집니다.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // 화면을 즉시 갱신합니다. (로컬 DB가 원본이므로 별도 캐시는 두지 않습니다.)
  const applyLessons = (nextLessons) => { onSchedulesChange(nextLessons); };

  // 첫 화면은 오늘이 속한 달로 시작합니다. (데이터 유무와 무관)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // --- 회원 CRUD ---
  const updateMember = async (updatedMember) => {
    await apiRequest({ action: 'updateMember', originalName: selectedMember.name, member: updatedMember });
    setMembers((currentMembers) => currentMembers.map((item) => item.name === selectedMember.name ? updatedMember : item));
    setSelectedMember(null);
  };
  const deleteMember = async () => {
    await apiRequest({ action: 'deleteMember', originalName: selectedMember.name, member: selectedMember });
    setMembers((currentMembers) => currentMembers.filter((item) => item.name !== selectedMember.name));
    setSelectedMember(null);
  };

  // --- 회원 등록 (시간 중복 검사, 이용권 자동 추가, 미래 반복 스케줄 자동 생성) ---
  const registerMember = async (newMember) => {
    const { schedules = [], ...memberData } = newMember;

    // 1. 타 회원과 스케줄 시간 중복 검사
    if (schedules && schedules.length > 0) {
      const isOverlapping = schedules.some((newSch) => {
        return lessons.some((existing) => {
          return existing.dayOfWeek === newSch.dayOfWeek && existing.time === newSch.time;
        });
      });

      if (isOverlapping) {
        alert('다른 회원과 스케줄이 겹칩니다. 시간 조정을 해 주세요.');
        return;
      }
    }

    // 2. 회원 정보 저장
    await apiRequest({ action: 'appendMember', member: memberData });
    setMembers((currentMembers) => [...currentMembers, memberData]);

    // 3. 미래 일자에 맞게 요일/시간별 스케줄 자동 생성 (총 4주간 해당 요일들)
    const dayMap = { '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6 };
    const generatedLessons = [];
    const today = new Date();

    if (schedules && schedules.length > 0) {
      for (let week = 0; week < 4; week++) {
        schedules.forEach((sch) => {
          const targetDayNum = dayMap[sch.dayOfWeek];
          if (targetDayNum !== undefined) {
            const d = new Date(today);
            const currentDayNum = d.getDay();
            let diff = targetDayNum - currentDayNum;
            if (diff <= 0) diff += 7;
            d.setDate(d.getDate() + diff + (week * 7));

            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            generatedLessons.push({
              date: dateStr,
              time: sch.time,
              name: memberData.name,
              status: '미완료'
            });
          }
        });
      }
    }

    // 4. 실제로 생성된 스케줄 총 개수를 이용권(pass)의 총 횟수와 일치시킴 (예: 주 2회 x 4주 = 총 8회)
    const totalLessonCount = generatedLessons.length > 0 ? generatedLessons.length : 8;
    const newPass = {
      name: memberData.name,
      total: totalLessonCount,
      used: 0,
      remaining: totalLessonCount,
      status: '이용중',
      date: new Date().toISOString().slice(0, 10)
    };
    await addPass(newPass);

    // 5. 생성된 미래 스케줄 일괄 저장
    for (const lesson of generatedLessons) {
      await apiRequest({ action: 'updateSchedule', schedule: lesson });
    }

    // 전체 스케줄 목록 갱신
    const refreshed = await requestBootstrap();
    if (refreshed && refreshed.schedules) {
      onSchedulesChange(normalizeSchedules(refreshed.schedules));
    }

    setIsRegisterOpen(false);
    setToast(`${memberData.name} 회원을 등록하고 미래 일정을 자동 생성했어요.`);
  };

  // --- 이용권 추가/삭제: DB 반영 후 최신 passes로 화면 갱신 + 알림 ---
  const addPass = async (pass) => {
    const result = await apiRequest({ action: 'appendPass', pass });
    if (result.passes) onPassesChange(result.passes);
    setToast(`${pass.name} 회원의 이용권(${pass.total}회)을 추가했어요.`);
  };
  const removePass = async (pass) => {
    const result = await apiRequest({ action: 'deletePass', pass });
    if (result.passes) onPassesChange(result.passes);
  };

  // --- 재등록: 새 이용권 활성화 + 반복 일정 자동 생성 후 화면 동기화 ---
  const submitReregister = async (payload) => {
    try {
      const result = await apiRequest({ action: 'reregister', ...payload });
      if (result.passes) onPassesChange(result.passes);
      if (result.schedules) onSchedulesChange(normalizeSchedules(result.schedules));
      setReregisterMember(null);
      setToast(`${payload.name} 회원을 다시 등록하고 레슨 ${payload.schedules.length}개를 잡았어요.`);
    } catch (error) {
      setSyncError(`다시 등록하지 못했어요. ${error.message || ''}`);
    }
  };

  // --- 스케줄 저장/추가: 화면 먼저 갱신(낙관적), 로컬 DB 저장은 백그라운드 ---
  const saveSchedule = (schedule) => {
    const previous = lessons;
    const [optimistic] = normalizeSchedules([schedule]);
    const isExisting = lessons.some((item) => isSameSchedule(item, schedule));
    const nextLessons = isExisting
      ? lessons.map((item) => isSameSchedule(item, schedule) ? { ...item, ...optimistic } : item)
      : [...lessons, optimistic];
    applyLessons(nextLessons);
    if (optimistic.date) setSelectedMonth(optimistic.date.slice(0, 7));
    setSyncError('');
    apiRequest({ action: 'updateSchedule', schedule })
      .then((result) => {
        if (result.passes) onPassesChange(result.passes);
        notifyPassChange(result.changedPass);
        if (!result.schedule) return;
        const [saved] = normalizeSchedules([{ ...schedule, ...result.schedule }]);
        // 저장 결과(특히 신규 항목의 확정 id)를 반영합니다.
        applyLessons(nextLessons.map((item) => isSameSchedule(item, saved) || item === optimistic ? { ...item, ...saved } : item));
      })
      .catch((error) => { applyLessons(previous); setSyncError(`저장하지 못해서 이전 내용으로 되돌렸어요. ${error.message || ''}`); });
  };

  // --- 스케줄 삭제: 화면 먼저 반영, 로컬 DB 삭제는 백그라운드 ---
  const deleteSchedule = (schedule) => {
    const previous = lessons;
    applyLessons(lessons.filter((item) => !isSameSchedule(item, schedule)));
    setSyncError('');
    apiRequest({ action: 'deleteSchedule', schedule })
      .catch((error) => { applyLessons(previous); setSyncError(`지우지 못해서 이전 내용으로 되돌렸어요. ${error.message || ''}`); });
  };

  // --- 파일에서 불러오기 완료 후 회원/스케줄/이용권 일괄 갱신 ---
  const handleImported = (fresh) => {
    setSyncError('');
    setMembers(mergeSheetMembers(fresh.members || [], fresh.histories || []));
    onSchedulesChange(normalizeSchedules(fresh.schedules || []));
    onPassesChange(fresh.passes || []);
    setToast('파일에서 자료를 불러왔어요.');
  };

  // --- 전체 지우기: 관리자만 남기고 모든 자료 비움 ---
  const confirmClearData = async () => {
    try {
      const fresh = await clearAllData();
      setMembers(mergeSheetMembers(fresh.members || [], fresh.histories || []));
      onSchedulesChange(normalizeSchedules(fresh.schedules || []));
      onPassesChange(fresh.passes || []);
      setToast('모든 자료를 지웠어요. (관리자 계정은 그대로 있어요)');
    } catch (error) {
      setSyncError(`자료를 지우지 못했어요. ${error.message || ''}`);
    } finally {
      setIsClearConfirm(false);
    }
  };

  // --- 지난 기록 보관(아카이브): 지난해 종료 일정을 파일로 저장 후, 확인을 거쳐 목록에서 제거 ---
  const runArchiveExport = async () => {
    const lastYear = new Date().getFullYear() - 1;
    try {
      const archivable = await collectArchivableSchedules(lastYear);
      if (!archivable.length) { setToast(`${lastYear}년에 보관할 지난 일정이 없어요.`); return; }
      downloadCsv(`지난기록-${lastYear}.csv`, schedulesToCsv(archivable));
      setArchiveTarget({ year: lastYear, ids: archivable.map((item) => item.id), count: archivable.length });
    } catch (error) {
      setSyncError(`지난 기록을 보관하지 못했어요. ${error.message || ''}`);
    }
  };
  const confirmArchiveRemoval = async () => {
    try {
      await removeSchedulesByIds(archiveTarget.ids);
      const fresh = await requestBootstrap();
      onSchedulesChange(normalizeSchedules(fresh.schedules || []));
      setToast(`${archiveTarget.year}년 지난 일정 ${archiveTarget.count}개를 보관하고 목록에서 지웠어요.`);
    } catch (error) {
      setSyncError(`지난 일정을 정리하지 못했어요. ${error.message || ''}`);
    } finally {
      setArchiveTarget(null);
    }
  };

  // --- 월 이동 ---
  const moveMonth = (offset) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  // --- 파생 데이터 (필터/정렬/통계) ---
  const filteredLessons = scheduleFilter === '전체' ? lessons : lessons.filter((lesson) => lesson.name === scheduleFilter);
  const monthLessons = [...filteredLessons]
    .filter((lesson) => String(lesson.date || '').slice(0, 7) === selectedMonth)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const monthAll = lessons.filter((lesson) => String(lesson.date || '').slice(0, 7) === selectedMonth);

  // 이번 달 완료된 횟수와 전체 레슨 횟수 계산
  const completedCount = monthAll.filter((lesson) => isCompletedLesson(lesson)).length;
  const totalLessonCount = monthAll.length;

  const stats = {
    total: totalLessonCount,
    completed: completedCount,
    lessonCountText: `${completedCount}/${totalLessonCount}회`, // 예: 15/19회
    remaining: monthAll.filter((lesson) => !isCompletedLesson(lesson)).length,
    memberCount: new Set(monthAll.map((lesson) => lesson.name).filter(Boolean)).size,
    label: `${Number(selectedMonth.slice(5))}월`,
  };

  return {
    // 상태
    members, lessons, passList,
    selectedMember, setSelectedMember,
    isRegisterOpen, setIsRegisterOpen,
    selectedDate, setSelectedDate,
    editingLesson, setEditingLesson,
    syncError, setSyncError,
    toast, setToast,
    scheduleFilter, setScheduleFilter,
    scheduleView, setScheduleView,
    archiveTarget, setArchiveTarget,
    isArchiveOpen, setIsArchiveOpen,
    reregisterMember, setReregisterMember,
    isClearConfirm, setIsClearConfirm,
    selectedMonth,
    // 파생값
    filteredLessons, monthLessons, stats,
    // 조회 헬퍼
    passSummaryOf, memberPassSummary, canSchedule,
    // 동작
    updateMember, deleteMember, registerMember,
    addPass, removePass, submitReregister,
    saveSchedule, deleteSchedule,
    handleImported, confirmClearData,
    runArchiveExport, confirmArchiveRemoval,
    moveMonth,
  };
}
