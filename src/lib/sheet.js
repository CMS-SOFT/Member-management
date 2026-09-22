// 데이터 정규화 및 화면 표시용 순수 유틸리티 모음. (네트워크 의존성 없음)

export const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

// 회원에 이력(이용권) 상태를 병합해 목록 표시용 status/history 필드를 만듭니다.
export function mergeSheetMembers(members, histories) {
  return members.map((member) => {
    const history = histories.find((item) => item.name === member.name);
    return { ...member, status: history?.lessonStatus || member.status, history: history?.historyStatus || '' };
  });
}

// 생년월일에서 로그인 코드(yymmdd)를 추출합니다.
export function birthCode(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 8 ? digits.slice(2) : digits.slice(0, 6);
}

function normalizeScheduleDate(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  const dateDigits = digits.match(/^(\d{4})(\d{2})(\d{2})/);
  if (dateDigits) return `${dateDigits[1]}-${dateDigits[2]}-${dateDigits[3]}`;
  return raw.replace(/[./]/g, '-').replace(/\s+/g, '');
}

export function normalizeScheduleTime(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 3 || digits.length === 4) return `${digits.slice(0, -2).padStart(2, '0')}:${digits.slice(-2)}`;
  return raw;
}

export function normalizeSchedules(schedules) {
  return (schedules || []).map((schedule) => ({ ...schedule, name: String(schedule.name || '').trim(), date: normalizeScheduleDate(schedule.date), time: normalizeScheduleTime(schedule.time) }));
}

export function isCompletedLesson(lesson) {
  return ['완료', '정상', '출석', '퇴실'].includes(String(lesson.status || '').trim());
}

// 30분 단위 시간 옵션 및 스냅 헬퍼
export const timeOptions = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`);
export function snapToHalfHour(value) {
  const time = normalizeScheduleTime(value);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return '10:00';
  return `${match[1]}:${Number(match[2]) < 30 ? '00' : '30'}`;
}

// 요일 라벨(0=일 ~ 6=토). 반복 스케줄 요일 선택 UI에서 사용합니다.
export const weekdayOptions = [
  { value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' },
  { value: 4, label: '목' }, { value: 5, label: '금' }, { value: 6, label: '토' }, { value: 0, label: '일' },
];

function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 요일·시간 슬롯 목록과 시작일, 생성 횟수(count)로 향후 레슨 날짜/시간 배열을 만듭니다.
// slots: [{ weekday: 0~6, time: 'HH:MM' }], startDate: 'YYYY-MM-DD'(포함), count: 생성 개수
// 반환: [{ date, time }] (날짜·시간 오름차순), count개.
export function generateRecurringLessons(slots, startDate, count) {
  const validSlots = (slots || []).filter((slot) => slot && slot.time && Number.isInteger(Number(slot.weekday)));
  if (!validSlots.length || !count || count <= 0) return [];
  const start = new Date(`${startDate}T00:00:00`);
  const results = [];
  // 최대 52주까지 탐색하며 필요한 개수를 채웁니다.
  for (let week = 0; week < 52 && results.length < count; week += 1) {
    for (let day = 0; day < 7 && results.length < count; day += 1) {
      const cursor = new Date(start);
      cursor.setDate(start.getDate() + week * 7 + day);
      if (cursor < start) continue;
      const matched = validSlots.filter((slot) => Number(slot.weekday) === cursor.getDay());
      matched.sort((a, b) => a.time.localeCompare(b.time)).forEach((slot) => {
        if (results.length < count) results.push({ date: toDateString(cursor), time: slot.time });
      });
    }
  }
  return results.slice(0, count).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}
