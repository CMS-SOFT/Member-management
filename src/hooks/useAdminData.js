import { useEffect, useState } from 'react';
import { clearAllData, collectArchivableSchedules, removeSchedulesByIds, requestBootstrap } from '../lib/db';
import { schedulesToCsv, downloadCsv } from '../lib/csv';

const isSameSchedule = (a, b) =>
  (a.id != null && String(a.id) === String(b.id)) ||
  (a.rowNumber != null && String(a.rowNumber) === String(b.rowNumber));

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

    // 날짜가 특정된 경우(모달창 등): 해당 레슨의 전체 일정 중 순번(1~12) 반환
    if (targetDate) {
      let index = memberLessons.findIndex((l) => l.date === targetDate && (!targetTime || l.time === targetTime));
      if (index === -1) {
        index = memberLessons.findIndex((l) => l.date === targetDate);
      }
      let seq = index !== -1 ? index + 1 : 1;
      seq = Math.min(Math.max(seq, 1), totalCount);
      return {
        used: seq,
        total: totalCount
      };
    }

    // 날짜가 없는 경우(일반 목록 테이블 등): 완료된 레슨 수 반환
    const completedCount = memberLessons.filter((l) => l.status === '완료').length;
    const usedCount = Math.min(Math.max(completedCount, 0), totalCount);

    return {
      used: usedCount,
      total: totalCount
    };
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

  const notifyPassChange = (changedPass) => {
    if (!changedPass) return;
    if (changedPass.status === '완료') setToast(`${changedPass.name} 회원의 이용권을 다 썼어요. '완료'로 바뀌었어요.`);
    else if (Number(changedPass.remaining) <= 1) setToast(`${changedPass.name} 회원의 이용권이 ${changedPass.remaining}회 남았어요.`);
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
    await apiRequest({ action: 'deleteMember', originalName: selectedMember.name, member: selectedMember });
    setMembers((currentMembers) => currentMembers.filter((item) => item.name !== selectedMember.name));
    setSelectedMember(null);
  };

  const registerMember = async (newMember) => {
    const { schedules = [], ...memberData } = newMember;

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

    await apiRequest({ action: 'appendMember', member: memberData });
    setMembers((currentMembers) => [...currentMembers, memberData]);

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
              status: '예약'
            });
          }
        });
      }
    }

    const totalLessonCount = generatedLessons.length > 0 ? generatedLessons.length : 8;
    const newPass = {
      name: memberData.name,
      total: totalLessonCount,
      used: 0,
      remaining: totalLessonCount,
      status: '이용중',
      registeredAt: new Date().toISOString().slice(0, 10)
    };
    await addPass(newPass);

    for (const lesson of generatedLessons) {
      await apiRequest({ action: 'updateSchedule', schedule: lesson });
    }

    const refreshed = await requestBootstrap();
    if (refreshed && refreshed.schedules) {
      onSchedulesChange(refreshed.schedules);
    }

    setIsRegisterOpen(false);
    setToast(`${memberData.name} 회원을 등록하고 미래 일정을 자동 생성했어요.`);
  };

  const addPass = async (pass) => {
    const result = await apiRequest({ action: 'appendPass', pass });
    if (result.passes) onPassesChange(result.passes);
    setToast(`${pass.name} 회원의 이용권(${pass.total}회)을 추가했어요.`);
  };

  const removePass = async (pass) => {
    const result = await apiRequest({ action: 'deletePass', pass });
    if (result.passes) onPassesChange(result.passes);
  };

  const submitReregister = async (payload) => {
    try {
      const result = await apiRequest({ action: 'reregister', ...payload });
      if (result.passes) onPassesChange(result.passes);
      if (result.schedules) onSchedulesChange(result.schedules);
      setReregisterMember(null);
      setToast(`${payload.name} 회원을 다시 등록하고 레슨 ${payload.schedules.length}개를 잡았어요.`);
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
      const fresh = await clearAllData();
      setMembers(fresh.members || []);
      onSchedulesChange(fresh.schedules || []);
      onPassesChange(fresh.passes || []);
      setToast('모든 자료를 지웠어요.');
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
    filteredLessons, monthLessons, stats,
    passSummaryOf, memberPassSummary, canSchedule,
    updateMember, deleteMember, registerMember,
    addPass, removePass, submitReregister,
    saveSchedule, deleteSchedule,
    confirmClearData,
    moveMonth,
  };
}