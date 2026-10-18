import { useState } from 'react';
import { mergeSheetMembers } from '../lib/sheet';

const isSameSchedule = (a, b) =>
  (a.id != null && String(a.id) === String(b.id)) ||
  (a.rowNumber != null && String(a.rowNumber) === String(b.rowNumber));

export function useAdminData({
  initialMembers,
  schedules,
  onSchedulesChange,
  passes,
  onPassesChange,
  settlements,
  onSettlementsChange,
  apiRequest,
}) {
  const [members, setMembers] = useState(initialMembers || []);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [syncError, setSyncError] = useState('');

  // 💡 토스트 대신 중앙 팝업 알림용 상태로 활용할 수 있습니다.
  const [centerAlert, setCenterAlert] = useState('');

  const [scheduleFilter, setScheduleFilter] = useState('전체');
  const [scheduleView, setScheduleView] = useState('calendar');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [reregisterMember, setReregisterMember] = useState(null);
  const [isClearConfirm, setIsClearConfirm] = useState(false);
  const [isClearDoneModal, setIsClearDoneModal] = useState(false);

  const lessons = schedules || [];
  const passList = passes || [];
  const settlementList = settlements || [];

  const passSummaryOf = (name, lessonDate, lessonTime) => {
    if (!name) return { used: 0, total: 4 };

    const cleanName = (n) => String(n || '').trim();
    const targetDate = lessonDate || editingLesson?.date;
    const targetTime = lessonTime || editingLesson?.time;

    const owned = passList
      .filter((pass) => cleanName(pass.name) === cleanName(name))
      .sort((a, b) => Number(b.id) - Number(a.id));

    const totalCount = owned.length > 0 ? (Number(owned[0].total) || 12) : 12;

    const memberLessons = lessons
      .filter((l) => cleanName(l.name) === cleanName(name))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    if (targetDate) {
      let index = memberLessons.findIndex((l) => l.date === targetDate && (!targetTime || l.time === targetTime));
      if (index === -1) {
        index = memberLessons.findIndex((l) => l.date === targetDate);
      }
      let seq = index !== -1 ? index + 1 : 1;
      seq = Math.min(Math.max(seq, 1), totalCount);
      return { used: seq, total: totalCount };
    }

    const completedCount = memberLessons.filter((l) => l.status === '완료').length;
    const usedCount = Math.min(Math.max(completedCount, 0), totalCount);

    return { used: usedCount, total: totalCount };
  };

  const memberPassSummary = (name) => {
    const active = passSummaryOf(name);
    const owned = passList.filter((pass) => pass.name === name);
    if (!owned.length) return null;
    const latest = owned.slice().sort((a, b) => Number(b.id) - Number(a.id))[0];
    return {
      used: Number(active.used),
      total: Number(active.total),
      done: latest.status === '완료' || active.used >= active.total
    };
  };

  const canSchedule = (name) => passList.some((pass) => pass.name === name && pass.status !== '완료' && Number(pass.remaining) > 0);

  // 💡 토스트 메시지 대신 팝업(알림) 상태로 변경
  const notifyPassChange = (changedPass) => {
    if (!changedPass) return;
    if (changedPass.status === '완료') {
      setCenterAlert(`${changedPass.name} 회원의 이용권을 다 썼어요. '완료'로 바뀌었어요.`);
    } else if (Number(changedPass.remaining) <= 1) {
      setCenterAlert(`${changedPass.name} 회원의 이용권이 ${changedPass.remaining}회 남았어요.`);
    }
  };

  const applyLessons = (nextLessons) => { onSchedulesChange(nextLessons); };

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const updateMember = async (updatedMember) => {
    await apiRequest({ action: 'updateMember', originalName: selectedMember.name, member: updatedMember });
    setMembers((currentMembers) => currentMembers.map((item) => item.name === selectedMember.name ? updatedMember : item));
    setSelectedMember(null);
  };

  const deleteMember = async () => {
    // 1. 서버로 삭제 요청을 보내고 최신 데이터(result)를 받아옵니다.
    const result = await apiRequest({
      action: 'deleteMember',
      originalName: selectedMember.name,
      member: selectedMember
    });

    // 2. 서버가 반환한 최신 멤버 목록으로 상태를 확실하게 업데이트합니다.
    if (result && result.members) {
      setMembers(result.members);
    } else {
      // 만약 목록이 안 오면 기존 필터링 방식으로 보완
      setMembers((currentMembers) => currentMembers.filter((item) => item.name !== selectedMember.name));
    }

    // 3. 연관된 스케줄이나 이용권 정보도 최신화가 필요하다면 함께 갱신
    if (result && result.schedules) {
      onSchedulesChange(result.schedules);
    }
    if (result && result.passes) {
      onPassesChange(result.passes);
    }
    if (result && result.settlements) {
      onSettlementsChange(result.settlements);
    }

    // 4. 모달 닫기 및 선택 해제
    setSelectedMember(null);
  };

  const registerMember = async (savedData) => {
    const payload = {
      action: 'appendMember',
      member: {
        name: savedData.name,
        birth: savedData.birth,
        phone: savedData.phone,
        gender: savedData.gender,
        level: savedData.level,
        lessonType: savedData.lessonType,
        status: savedData.status,
        includePass: savedData.includePass,
        startDate: savedData.startDate,
        lessons: savedData.lessons
      }
    };

    console.log('📌 [Frontend] 서버로 전송하는 회원 등록 페이로드:', JSON.stringify(payload, null, 2));

    // 💡 try...catch로 감싸지 말고 에러를 그대로 상위로 던지게 둡니다!
    const response = await apiRequest(payload);

    if (response && response.success) {
      setIsRegisterOpen(false);
      // 서버가 반환한 최신 데이터로 상태를 직접 갱신 (화면 이동 없음)
      if (response.members) setMembers(response.members);
      if (response.schedules) onSchedulesChange(response.schedules);
      if (response.passes) onPassesChange(response.passes);
      setCenterAlert('회원이 성공적으로 등록되었습니다.');
    } else if (response && (response.error || response.message)) {
      throw new Error(response.error || response.message);
    }

    return response;
  };

  const addPass = async (pass) => {
    const result = await apiRequest({ action: 'appendPass', pass });
    if (result.passes) onPassesChange(result.passes);
    if (result.schedules) onSchedulesChange(result.schedules);
    return result;
  };

  const removePass = async (pass) => {
    const result = await apiRequest({ action: 'deletePass', pass });
    if (result.passes) onPassesChange(result.passes);
    if (result.schedules) onSchedulesChange(result.schedules);
    return result;
  };

  const handleImported = async () => {
    const fresh = await apiRequest({ action: 'bootstrap' });
    setMembers(mergeSheetMembers(fresh.members || [], fresh.histories || []));
    onSchedulesChange(fresh.schedules || []);
    onPassesChange(fresh.passes || []);
    onSettlementsChange(fresh.settlements || []);
  };

  const saveSettlement = async (settlement) => {
    setSyncError('');
    const fresh = await apiRequest({ action: 'saveSettlement', settlement });
    onSettlementsChange(fresh.settlements || []);
    return fresh;
  };

  const deleteSettlement = async (id) => {
    setSyncError('');
    const fresh = await apiRequest({ action: 'deleteSettlement', id });
    onSettlementsChange(fresh.settlements || []);
    return fresh;
  };

  const submitReregister = async (payload) => {
    try {
      const result = await apiRequest({ action: 'reregister', ...payload });
      if (result.passes) onPassesChange(result.passes);
      if (result.schedules) onSchedulesChange(result.schedules);
      setReregisterMember(null);
      setCenterAlert(`${payload.name} 회원을 다시 등록했어요.`);
    } catch (error) {
      setSyncError(`다시 등록하지 못했어요. ${error.message || ''}`);
    }
  };

  const saveSchedule = (schedule) => {
    const previous = lessons;
    const isExisting = lessons.some((item) => isSameSchedule(item, schedule));
    const nextLessons = isExisting
      ? lessons.map((item) => isSameSchedule(item, schedule) ? { ...item, ...schedule } : item)
      : [...lessons, schedule];
    applyLessons(nextLessons);
    if (schedule.date) setSelectedMonth(schedule.date.slice(0, 7));
    setSyncError('');
    apiRequest({ action: 'updateSchedule', schedule })
      .then((result) => {
        if (result.passes) onPassesChange(result.passes);
        notifyPassChange(result.changedPass);
        if (!result.schedule) return;
        applyLessons(nextLessons.map((item) => isSameSchedule(item, result.schedule) ? { ...item, ...result.schedule } : item));
      })
      .catch((error) => { applyLessons(previous); setSyncError(`저장하지 못해서 이전 내용으로 되돌렸어요. ${error.message || ''}`); });
  };

  const deleteSchedule = (schedule) => {
    const previous = lessons;
    applyLessons(lessons.filter((item) => !isSameSchedule(item, schedule)));
    setSyncError('');
    apiRequest({ action: 'deleteSchedule', schedule })
      .catch((error) => { applyLessons(previous); setSyncError(`지우지 못해서 이전 내용으로 되돌렸어요. ${error.message || ''}`); });
  };

  const confirmClearData = async () => {
    try {
      const fresh = await apiRequest({ action: 'clear' });
      setMembers(fresh.members || []);
      onSchedulesChange(fresh.schedules || []);
      onPassesChange(fresh.passes || []);
      onSettlementsChange(fresh.settlements || []);
      setIsClearDoneModal(true);
    } catch (error) {
      setSyncError(`자료를 지우지 못했어요. ${error.message || ''}`);
    } finally {
      setIsClearConfirm(false);
    }
  };

  const moveMonth = (offset) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const filteredLessons = scheduleFilter === '전체' ? lessons : lessons.filter((lesson) => lesson.name === scheduleFilter);
  const monthLessons = [...filteredLessons]
    .filter((lesson) => String(lesson.date || '').slice(0, 7) === selectedMonth)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const monthAll = lessons.filter((lesson) => String(lesson.date || '').slice(0, 7) === selectedMonth);

  const completedCount = monthAll.filter((lesson) => lesson.status === '완료').length;
  const totalLessonCount = monthAll.length;

  const stats = {
    total: totalLessonCount,
    completed: completedCount,
    lessonCountText: `${completedCount}/${totalLessonCount}회`,
    remaining: monthAll.filter((lesson) => lesson.status !== '완료').length,
    memberCount: new Set(monthAll.map((lesson) => lesson.name).filter(Boolean)).size,
    label: `${Number(selectedMonth.slice(5))}월`,
  };

  return {
    members, lessons, passList, settlementList,
    selectedMember, setSelectedMember,
    isRegisterOpen, setIsRegisterOpen,
    selectedDate, setSelectedDate,
    editingLesson, setEditingLesson,
    syncError, setSyncError,
    toast: centerAlert, // 기존 토스트 참조를 팝업 상태로 연결
    setToast: setCenterAlert,
    scheduleFilter, setScheduleFilter,
    scheduleView, setScheduleView,
    archiveTarget, setArchiveTarget,
    isArchiveOpen, setIsArchiveOpen,
    reregisterMember, setReregisterMember,
    isClearConfirm, setIsClearConfirm,
    isClearDoneModal, setIsClearDoneModal,
    selectedMonth,
    filteredLessons, monthLessons, stats,
    passSummaryOf, memberPassSummary, canSchedule,
    updateMember, deleteMember, registerMember,
    addPass, removePass, handleImported, saveSettlement, deleteSettlement, submitReregister,
    saveSchedule, deleteSchedule,
    confirmClearData,
    moveMonth,
  };
}