import { useState } from 'react';
import { useDraggable } from '../../lib/useDraggable';
import { Backdrop } from '../common';
import '../../styles/LessonListModal.css';

export function LessonListModal({ date, lessons, members = [], canSchedule, onClose, onEdit, onDelete, onCreate }) {
  const dayName = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${date}T00:00:00`).getDay()];
  const [target, setTarget] = useState(null);
  const [done, setDone] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('10:00');
  const [blockMsg, setBlockMsg] = useState('');

  // 중복 스케줄 확인 팝업 상태
  const [duplicateConfirm, setDuplicateConfirm] = useState(null);

  const { dragHandleProps, style } = useDraggable();
  const runDelete = () => { onDelete(target); setTarget(null); setDone(true); };
  const selectableMembers = members.filter((item) => item.role !== '관리자');

  // 완료된 레슨 여부 판단 (DB 상태값 기준)
  const isCompletedLesson = (lesson) => {
    return lesson.status === '완료' || lesson.history === '만료됨';
  };

  const submitNew = () => {
    if (!newName) return;

    // 이용권이 '이용중'이 아니거나 잔여가 없으면 등록 차단.
    if (canSchedule && !canSchedule(newName)) {
      setBlockMsg(`${newName} 회원은 쓸 수 있는 이용권이 없어요. 다시 등록한 뒤에 일정을 잡아 주세요.`);
      return;
    }

    // 같은 일자, 같은 시간대에 이미 등록된 다른 스케줄이 있는지 검사
    const conflictLesson = lessons.find((item) => item.time === newTime);
    if (conflictLesson) {
      setDuplicateConfirm(conflictLesson);
      return;
    }

    executeCreateNew();
  };

  const executeCreateNew = () => {
    setDuplicateConfirm(null);
    onCreate({ date, time: newTime, name: newName, status: '예약', note: '' });
    onClose();
  };

  // 기본 시간 옵션 (DB 또는 표준 시간대)
  const timeOptions = [
    '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00'
  ];

  return (
    <Backdrop onClose={onClose}>
      {/* 💡 CSS 파일의 .lesson-list-modal 선택자와 일치시킴 */}
      <div className="schedule-modal lesson-list-modal" style={style}>
        <div className="modal-drag-handle" {...dragHandleProps}>
          <span className="eyebrow">{date.replaceAll('-', '.')} · {dayName}요일</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <h3>레슨 일정 잡기</h3>

        <div className="add-lesson-form">
          <label>회원
            <select value={newName} onChange={(event) => setNewName(event.target.value)}>
              <option value="">전체</option>
              {selectableMembers.map((item) => <option key={item.name || item.id} value={item.name}>{item.name}</option>)}
            </select>
          </label>
          <label>시간
            <select value={newTime} onChange={(event) => setNewTime(event.target.value)}>
              {timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
          </label>
          <button className="square-button solid" disabled={!newName} onClick={submitNew}>레슨추가</button>
        </div>

        <div className="lesson-list">
          {lessons.length ? lessons.map((lesson) => {
            const completed = isCompletedLesson(lesson);
            return (
              <div
                className={`lesson-list-item ${completed ? 'completed' : 'incomplete'}`}
                key={lesson.id || `${lesson.date}-${lesson.time}`}
              >
                {/* 💡 CSS 파일의 .lesson-item-info 선택자와 일치시킴 */}
                <div className="lesson-item-info">
                  <b className="lesson-item-date">{lesson.date.slice(-2)}일 ({dayName})</b>
                  <span className="lesson-item-time">{lesson.time}</span>
                  <strong className="lesson-item-name">{lesson.name || '회원'}</strong>
                  <i className={`lesson-item-status ${completed ? 'done' : ''}`}>{lesson.status || '예약'}</i>
                </div>
                <div className="lesson-item-actions">
                  <button className="square-button" disabled={completed} onClick={() => onEdit(lesson)}>수정</button>
                  <button className="square-button danger" disabled={completed} onClick={() => setTarget(lesson)}>삭제</button>
                </div>
              </div>
            );
          }) : <p className="empty-lessons">이 날에는 잡힌 일정이 없어요. 위에서 회원과 시간을 골라 추가해 보세요.</p>}
        </div>

        {/* 동일 시간대 중복 스케줄 등록 확인/취소 팝업 */}
        {duplicateConfirm && (
          <div className="detail-confirm">
            <div className="confirm-modal">
              <h3>같은 시간대 다른 회원 이용중입니다.</h3>
              <p>등록하시겠습니까?</p>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setDuplicateConfirm(null)}>취소</button>
                <button className="delete-button" onClick={executeCreateNew} style={{ background: 'var(--wine)', color: '#fff' }}>확인</button>
              </div>
            </div>
          </div>
        )}

        {target && <div className="detail-confirm"><div className="confirm-modal"><h3>이 일정을 지울까요?</h3><p>한 번 지우면 되돌릴 수 없어요.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setTarget(null)}>그만두기</button><button className="delete-button" onClick={runDelete}>지우기</button></div></div></div>}
        {done && <div className="detail-confirm"><div className="confirm-modal confirm-modal--result"><h3>일정을 지웠어요.</h3><div className="modal-actions modal-actions--single"><button className="primary-button" onClick={() => setDone(false)}>확인</button></div></div></div>}
        {blockMsg && <div className="detail-confirm"><div className="confirm-modal confirm-modal--result"><h3>이용권을 확인해 주세요</h3><p>{blockMsg}</p><div className="modal-actions modal-actions--single"><button className="primary-button" onClick={() => setBlockMsg('')}>확인</button></div></div></div>}
      </div>
    </Backdrop>
  );
}