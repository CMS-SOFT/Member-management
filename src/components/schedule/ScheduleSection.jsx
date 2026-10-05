import { AdminCalendar } from './AdminCalendar';

// 스케줄표 탭: 상단 컨트롤(회원 필터 / 월 이동 / 보기 전환) + 달력보기 또는 리스트보기.
export function ScheduleSection({
  members, filteredLessons, monthLessons, selectedMonth,
  scheduleFilter, onFilterChange,
  scheduleView, onViewChange,
  onMoveMonth, onSelectDate, onSelectLesson, onAddLesson,
  memberPassSummary,
}) {
  return <section className="admin-section schedule-section">
    <div className="schedule-controls">
      <select className="schedule-member-filter" value={scheduleFilter} onChange={(event) => onFilterChange(event.target.value)}>
        <option value="전체">전체 회원</option>
        {members.filter((item) => item.role !== '관리자').map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
      </select>
      <div className="month-switcher">
        <button aria-label="이전 달" onClick={() => onMoveMonth(-1)}>‹</button>
        <strong>{selectedMonth.slice(0, 4)}년 {Number(selectedMonth.slice(5))}월</strong>
        <button aria-label="다음 달" onClick={() => onMoveMonth(1)}>›</button>
      </div>
      <select className="schedule-view-select" value={scheduleView} onChange={(event) => onViewChange(event.target.value)}>
        <option value="calendar">달력 보기</option>
        <option value="list">리스트 보기</option>
      </select>
    </div>
    {scheduleView === 'calendar'
      ? <AdminCalendar month={selectedMonth} lessons={filteredLessons} onSelectDate={onSelectDate} onSelectLesson={onSelectLesson} onAdd={onAddLesson} />
      : <div className="schedule-listview">
        {monthLessons.length ? monthLessons.map((lesson) => {
          const summary = memberPassSummary(lesson.name);
          return <button className="schedule-list-item" key={lesson.id} onClick={() => onSelectLesson(lesson)}>
            <b>{lesson.date.slice(5).replace('-', '.')}</b><span>{lesson.time}</span><strong>{lesson.name}</strong>{summary ? <em className="pass-count">{summary.used}/{summary.total}</em> : null}<i>{lesson.status}</i>
          </button>;
        }) : <p className="empty-lessons">{selectedMonth.slice(0, 4)}년 {Number(selectedMonth.slice(5))}월에 표시할 일정이 없습니다.</p>}
      </div>}
  </section>;
}
