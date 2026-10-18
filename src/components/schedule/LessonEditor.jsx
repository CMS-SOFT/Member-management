import { useState } from 'react';
import { hourOptions, minuteOptions, snapToTwentyMinutes, isCompletedLesson, lessonOverlapMessage } from '../../lib/sheet';
import { useDraggable } from '../../lib/useDraggable';
import { Backdrop } from '../common';

export function LessonEditor({ lesson, members, lessons = [], passSummaryOf, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...lesson, time: snapToTwentyMinutes(lesson.time) });
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState('');
  const [overlapWarning, setOverlapWarning] = useState('');
  const { dragHandleProps, style } = useDraggable();
  const changeField = (event) => setForm((currentForm) => ({ ...currentForm, [event.target.name]: event.target.value }));
  const changeTimePart = (part, value) => {
    const [hour, minute] = form.time.split(':');
    setForm((currentForm) => ({
      ...currentForm,
      time: part === 'hour' ? `${value}:${minute}` : `${hour}:${value}`,
    }));
  };
  const isExisting = Boolean(form.id || form.rowNumber);

  // 레슨 상태 판정
  const started = form.status === '진행중';
  const finished = isCompletedLesson(form);

  // 미래 날짜 판정 (시작/종료 버튼 제한용)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isFuture = String(form.date || '') > todayStr;

  const requestSave = () => {
    if (finished) return;
    const selected = members.find((item) => item.name === form.name);
    const overlap = lessonOverlapMessage({
      date: form.date,
      time: form.time,
      newLessonType: selected?.lessonType || '개인',
      newMemberName: form.name,
      existing: lessons,
      members,
      excludeId: form.id,
      excludeName: form.name,
    });
    if (overlap) { setOverlapWarning(overlap); return; }
    setConfirm('save');
  };

  const [doneCloses, setDoneCloses] = useState(true);

  const runConfirm = () => {
    if (confirm === 'save') { onSave(form); setDoneCloses(true); setDone('일정을 수정했어요.'); }
    else if (confirm === 'delete') { onDelete(form); setDoneCloses(true); setDone('일정을 지웠어요.'); }
    else if (confirm === 'start') { const next = { ...form, status: '진행중' }; setForm(next); onSave(next); }
    else if (confirm === 'finish') { const next = { ...form, status: '완료' }; setForm(next); onSave(next); setDoneCloses(false); setDone('레슨을 마쳤어요.'); }
    setConfirm('');
  };

  const confirmText = {
    save: { title: '이대로 수정할까요?', desc: '바꾼 일정을 저장해요.' },
    delete: { title: '이 일정을 지울까요?', desc: '한 번 지우면 되돌릴 수 없어요.' },
    start: { title: '레슨을 시작할까요?', desc: '레슨을 진행중으로 바꿔요.' },
    finish: { title: '레슨을 끝낼까요?', desc: '레슨을 완료로 바꾸고 이용권을 1회 써요.' },
  }[confirm];

  return <Backdrop onClose={onClose}><div className="schedule-modal editor-modal" style={style}>
    <div className="modal-drag-handle" {...dragHandleProps}>
      <span className="eyebrow" />
      <button className="modal-close" onClick={onClose}>×</button>
    </div>
    <h3>{form.name || '회원'} 회원의 일정</h3>

    <div className="editor-actions editor-actions--top">
      {isExisting && onDelete ? (
        <button className="delete-button" onClick={() => setConfirm('delete')} disabled={finished} style={{ opacity: finished ? 0.4 : 1, cursor: finished ? 'not-allowed' : 'pointer' }}>
          일정삭제
        </button>
      ) : <span />}
      <div>
        <button className="cancel-button" onClick={onClose}>닫기</button>
        <button className="primary-button" onClick={requestSave} disabled={finished} style={{ opacity: finished ? 0.4 : 1, cursor: finished ? 'not-allowed' : 'pointer' }}>
          일정수정
        </button>
      </div>
    </div>

    {/* 완료(finished)된 레슨만 전체 필드 비활성화, 미래 날짜라고 흐리게 만들지 않음 */}
    <fieldset disabled={finished} style={{ border: 'none', padding: 0, margin: 0 }}>
      <div className="editor-card">
        <label className="editor-date">날짜<input type="date" name="date" value={form.date} onChange={changeField} /></label>
        <label className="editor-hour">시간<select value={form.time.split(':')[0]} onChange={(event) => changeTimePart('hour', event.target.value)}>{hourOptions.map((hour) => <option key={hour} value={hour}>{hour}시</option>)}</select></label>
        <label className="editor-minute">분<select value={form.time.split(':')[1]} onChange={(event) => changeTimePart('minute', event.target.value)}>{minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}분</option>)}</select></label>
        <label className="editor-member">회원<select name="name" value={form.name} onChange={changeField} disabled={isExisting}><option value="">회원을 골라 주세요</option>{members.map((member) => <option key={member.name}>{member.name}</option>)}</select></label>
        <label className="editor-status">상태<select name="status" value={form.status} onChange={changeField}><option>예약</option><option>진행중</option><option>완료</option><option>취소</option></select></label>
        <label className="editor-note">
          레슨 진행횟수 / 총 레슨횟수
          <div className="editor-pass">
            {(() => {
              // 🌟 모달창에서 사용중인 날짜 상태값을 직접 넣어줍니다. (예: form.date)
              const targetDate = form ? form.date : undefined;

              const s = form.name && passSummaryOf ? passSummaryOf(form.name, targetDate) : null;
              return s ? `${s.used} / ${s.total}회` : '이용권 없음';
            })()}
          </div>
        </label>
        {isExisting && <div className="lesson-run-actions">
          <button className="run-start" disabled={started || finished || isFuture} onClick={() => setConfirm('start')}>레슨 시작</button>
          <button className="run-finish" disabled={!started || finished || isFuture} onClick={() => setConfirm('finish')}>레슨 종료</button>
        </div>}
        {isExisting && isFuture && <p className="lesson-future-note">아직 오지 않은 레슨이에요. 레슨 시작/종료는 당일부터 할 수 있어요.</p>}
      </div>
    </fieldset>

    {finished && (
      <p style={{ color: '#800020', fontSize: '12px', marginTop: '10px', textAlign: 'center', fontWeight: 'bold' }}>
        * 완료된 레슨 일정은 수정하거나 삭제할 수 없습니다.
      </p>
    )}

    {confirm && <div className="detail-confirm"><div className="confirm-modal"><h3>{confirmText.title}</h3><p>{confirmText.desc}</p><div className="modal-actions"><button className="cancel-button" onClick={() => setConfirm('')}>취소</button><button className={confirm === 'delete' ? 'delete-button' : 'primary-button'} onClick={runConfirm}>확인</button></div></div></div>}
    {done && <div className="detail-confirm"><div className="confirm-modal confirm-modal--result"><h3>{done}</h3><div className="modal-actions modal-actions--single"><button className="primary-button" onClick={() => (doneCloses ? onClose() : setDone(''))}>확인</button></div></div></div>}
    {overlapWarning && <div className="detail-confirm"><div className="confirm-modal confirm-modal--result"><h3>이 시간에 일정을 넣을 수 없어요</h3><p style={{ whiteSpace: 'pre-line' }}>{overlapWarning}</p><div className="modal-actions modal-actions--single"><button className="primary-button" onClick={() => setOverlapWarning('')}>확인</button></div></div></div>}
  </div></Backdrop>;
}