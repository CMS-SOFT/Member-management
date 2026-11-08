import { weekDays, isCompletedLesson } from '../../lib/sheet';

export function AdminCalendar({ month, lessons, onSelectDate, onSelectLesson, onAdd }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const startOffset = firstDay.getDay();
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const cellCount = Math.ceil((startOffset + dayCount) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => new Date(year, monthNumber - 1, index - startOffset + 1));
  return <div className="admin-calendar-grid">
    {weekDays.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
    {cells.map((date) => {
      const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const outside = date.getMonth() !== monthNumber - 1;
      const dayLessons = lessons.filter((lesson) => lesson.date === fullDate).sort((a, b) => a.time.localeCompare(b.time));
      // 이번 달 날짜는 일정 유무와 관계없이 클릭 가능(빈 날에도 새 일정 추가 팝업).
      // 전후 달 날짜는 클릭 이벤트 원천 비활성화.
      return <div
        className={`calendar-date-cell ${outside ? 'other-month' : ''} ${dayLessons.length ? 'has-lessons' : ''}`}
        key={fullDate}
        onClick={() => { if (!outside) onSelectDate(fullDate); }}
        style={outside ? { pointerEvents: 'none' } : { cursor: 'pointer' }}
      >
        <strong>{date.getDate()}</strong>
        {dayLessons.map((lesson, index) => {
          const completed = isCompletedLesson(lesson);
          return <div
            className={`calendar-schedule-item ${completed ? 'completed' : 'incomplete'}`}
            role="button"
            tabIndex={outside ? -1 : 0}
            key={`${lesson.name}-${lesson.time}-${index}`}
            onClick={(event) => { event.stopPropagation(); onSelectLesson(lesson); }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onSelectLesson(lesson); } }}
          ><em>{lesson.time}</em>{lesson.name || '회원'}</div>;
        })}
      </div>;
    })}
    <button className="floating-add" onClick={onAdd}>＋ 일정 추가</button>
  </div>;
}
