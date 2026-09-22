import { useState } from 'react';
import { isCompletedLesson, timeOptions } from '../../lib/sheet';
import { useDraggable } from '../../lib/useDraggable';
import { Backdrop } from '../common';

export function LessonListModal({ date, lessons, members = [], canSchedule, onClose, onEdit, onDelete, onCreate }) {
  const dayName = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${date}T00:00:00`).getDay()];
  const [target, setTarget] = useState(null);
  const [done, setDone] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('10:00');
  const [blockMsg, setBlockMsg] = useState('');
  const { dragHandleProps, style } = useDraggable();
  const runDelete = () => { onDelete(target); setTarget(null); setDone(true); };
  const selectableMembers = members.filter((item) => item.role !== '관리자');

  const submitNew = () => {
    if (!newName) return;
    // 이용권이 '이용중'이 아니거나 잔여가 없으면 등록 차단.
    if (canSchedule && !canSchedule(newName)) {
      setBlockMsg(`${newName} 회원은 쓸 수 있는 이용권이 없어요. 다시 등록한 뒤에 일정을 잡아 주세요.`);
      return;
    }
    onCreate({ date, time: newTime, name: newName, status: '예약', note: '' });
    onClose();
  };

  return <Backdrop onClose={onClose}><div className="schedule-modal" style={style}>
    <div className="modal-drag-handle" {...dragHandleProps}>
      <span className="eyebrow">{date.replaceAll('-', '.')} · {dayName}요일</span>
      <button className="modal-close" onClick={onClose}>×</button>
    </div>
    <h3>레슨 일정 잡기</h3>

    <div className="add-lesson-form">
      <label>회원
        <select value={newName} onChange={(event) => setNewName(event.target.value)}>
          <option value="">전체</option>
          {selectableMembers.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
        </select>
      </label>
      <label>시간
        <select value={newTime} onChange={(event) => setNewTime(event.target.value)}>
          {timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}
        </select>
      </label>
      <button className="square-button solid" disabled={!newName} onClick={submitNew}>레슨추가</button>
    </div>

    <div className="lesson-list">{lessons.length ? lessons.map((lesson) => {
      const completed = isCompletedLesson(lesson);
      return <div className={`lesson-list-item ${completed ? 'completed' : 'incomplete'}`} key={lesson.id || `${lesson.date}-${lesson.time}`}>
        <div><b>{lesson.date.slice(-2)}일 ({dayName})</b><span>◷ {lesson.time}</span><strong className="lesson-item-name">{lesson.name || '회원'}</strong><i className={completed ? 'done' : ''}>{lesson.status || '예약'}</i></div>
        <div><button className="square-button" disabled={completed} onClick={() => onEdit(lesson)}>수정</button><button className="square-button danger" disabled={completed} onClick={() => setTarget(lesson)}>삭제</button></div>
      </div>;
    }) : <p className="empty-lessons">이 날에는 잡힌 일정이 없어요. 위에서 회원과 시간을 골라 추가해 보세요.</p>}</div>

    {target && <div className="detail-confirm"><div className="confirm-modal"><h3>이 일정을 지울까요?</h3><p>한 번 지우면 되돌릴 수 없어요.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setTarget(null)}>그만두기</button><button className="delete-button" onClick={runDelete}>지우기</button></div></div></div>}
    {done && <div className="detail-confirm"><div className="confirm-modal confirm-modal--result"><h3>일정을 지웠어요.</h3><div className="modal-actions modal-actions--single"><button className="primary-button" onClick={() => setDone(false)}>확인</button></div></div></div>}
    {blockMsg && <div className="detail-confirm"><div className="confirm-modal confirm-modal--result"><h3>이용권을 확인해 주세요</h3><p>{blockMsg}</p><div className="modal-actions modal-actions--single"><button className="primary-button" onClick={() => setBlockMsg('')}>확인</button></div></div></div>}
  </div></Backdrop>;
}
