import { weekDays, isCompletedLesson } from '../../lib/sheet';

export function AdminCalendar({ month, lessons, onSelectDate, onSelectLesson, onAdd }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const startOffset = firstDay.getDay();
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const cellCount = Math.ceil((startOffset + dayCount) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => new Date(year, monthNumber - 1, index - startOffset + 1));
  return <div className="admin-calendar">
    <div className="calendar-weekdays">{weekDays.map((day) => <b key={day}>{day}</b>)}</div>
    <div className="calendar-grid">{cells.map((date) => {
      const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const outside = date.getMonth() !== monthNumber - 1;
      const dayLessons = lessons.filter((lesson) => lesson.date === fullDate).sort((a, b) => a.time.localeCompare(b.time));
      // 이번 달 날짜는 일정 유무와 관계없이 클릭 가능(빈 날에도 새 일정 추가 팝업).
      return <button className={`admin-calendar-day ${outside ? 'outside' : ''} ${dayLessons.length ? 'has-lessons' : ''}`} key={fullDate} onClick={() => { if (!outside) onSelectDate(fullDate); }}>
        <strong>{date.getDate()}</strong>
        {dayLessons.map((lesson, index) => {
          const completed = isCompletedLesson(lesson);
          return <span className={completed ? 'completed' : 'incomplete'} role="button" tabIndex={0} key={`${lesson.name}-${lesson.time}-${index}`} onClick={(event) => { event.stopPropagation(); onSelectLesson(lesson); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onSelectLesson(lesson); } }}><em>{lesson.time}</em>{lesson.name || '회원'}</span>;
        })}
      </button>;
    })}</div>
    <button className="floating-add" onClick={onAdd}>＋ 일정 추가</button>
  </div>;
}
