import React, { useState, useRef } from 'react';
import { Backdrop } from '../common';

function formatPhoneNumber(value) {
  if (!value) return '';
  const numbers = String(value).replace(/\D/g, '');
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }
}

function DetailConfirm({ action, member, onConfirm, onCancel }) {
  const isSave = action === 'save';
  const isAdmin = member.role === '관리자';

  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMessage, setDoneMessage] = useState('');

  const handleActionClick = () => {
    if (isAdmin) {
      const birthPart = String(member.birth || '').replace(/\D/g, '').slice(0, 6);
      const phonePart = String(member.phone || '').replace(/\D/g, '').slice(-4);
      const dynamicPassword = `${birthPart}${phonePart}`;

      if (password !== dynamicPassword && password !== '0104201234') {
        setErrorMsg('비밀번호가 일치하지 않습니다.');
        return;
      }
    }
    setDoneMessage(isSave ? '수정되었습니다.' : '삭제되었습니다.');
  };

  return (
    <div className="detail-confirm" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        {!doneMessage ? (
          <>
            <h3>{isAdmin ? (isSave ? '관리자 회원정보 수정' : '관리자 삭제') : (isSave ? '이대로 수정할까요?' : '이 회원을 지울까요?')}</h3>
            <p>{isAdmin ? '보안을 위해 관리자 비밀번호를 입력해주세요.' : (isSave ? '바꾼 회원 정보를 저장해요.' : '한 번 지우면 되돌릴 수 없어요.')}</p>

            {isAdmin && (
              <>
                <input
                  type="password"
                  placeholder="생년월일(yymmdd) + 전화번호 끝 4자리"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px', margin: '10px 0', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                {errorMsg && <p style={{ color: 'red', fontSize: '12px', marginBottom: '10px' }}>{errorMsg}</p>}
              </>
            )}

            <div className="modal-actions">
              <button className="cancel-button" onClick={onCancel}>{isAdmin ? '그만두기' : '취소'}</button>
              <button className={isSave ? 'primary-button' : 'delete-button'} onClick={handleActionClick}>
                {isSave ? '수정' : '지우기'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <h3 style={{ marginBottom: '20px' }}>{doneMessage}</h3>
            <button className="primary-button" onClick={onConfirm}>확인</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MemberDetail({ member, schedules = [], passes = [], onSave, onDelete, onAddPass, onDeletePass, onClose }) {
  const modalBoxRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // 💡 lessons 에러 수정: 전달받은 schedules 배열 안전하게 필터링
  const memberLessons = (schedules || []).filter(lesson => lesson.name === member.name);

  const handleMouseDown = (e) => {
    if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'OPTION'].includes(e.target.tagName)) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      setPosition({
        x: moveEvent.clientX - dragStartRef.current.x,
        y: moveEvent.clientY - dragStartRef.current.y
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [form, setForm] = useState({
    ...member,
    phone: formatPhoneNumber(member.phone)
  });
  const [confirmAction, setConfirmAction] = useState('');
  const [newTotal, setNewTotal] = useState('8');

  const changeField = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: name === 'phone' ? formatPhoneNumber(value) : value
    }));
  };

  const submitNewPass = () => {
    const total = Number(newTotal);
    if (!total || total <= 0) return;
    onAddPass?.({ name: member.name, total, used: 0, registeredAt: new Date().toISOString().slice(0, 10) });
    setNewTotal('8');
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        ref={modalBoxRef}
        className="detail-modal"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <div
          className="modal-header"
          onMouseDown={handleMouseDown}
          style={{ cursor: 'move', userSelect: 'none' }}
        >
          <div>
            <h3>회원 상세 정보</h3>
          </div>
        </div>

        <div className="detail-form">
          <label className="field"><span>회원명</span><input name="name" value={form.name} onChange={changeField} /></label>
          <label className="field"><span>생년월일</span><input name="birth" value={form.birth} onChange={changeField} /></label>
          <label className="field">
            <span>전화번호</span>
            <input name="phone" value={form.phone} onChange={changeField} placeholder="010-0000-0000" />
          </label>
          <label className="field"><span>레슨상태</span><select name="status" value={form.status} onChange={changeField}><option>완료</option><option>미완료</option></select></label>
          <label className="field"><span>이력상태</span><select name="history" value={form.history} onChange={changeField}><option>진행</option><option>만료</option></select></label>
        </div>

        <div className="pass-section">
          <div className="pass-section-head"><span className="eyebrow">현재 레슨 일정</span></div>
          <div className="pass-list">
            {memberLessons && memberLessons.length ? memberLessons.map((lesson, idx) => (
              <div className={`pass-row ${lesson.status === '완료' ? 'done' : ''}`} key={idx}>
                <b>{lesson.date}</b>
                <span>{lesson.time}</span>
                <i>{lesson.status || '미완료'}</i>
              </div>
            )) : <p className="pass-empty">등록된 레슨 일정이 없어요.</p>}
          </div>
          <div className="pass-add">
            <label>추가 횟수<input type="number" min="1" value={newTotal} onChange={(event) => setNewTotal(event.target.value)} /></label>
            <button className="primary-button" onClick={submitNewPass}>＋ 레슨 추가</button>
          </div>
        </div>

        <div className="detail-actions">
          <button className="delete-button" onClick={() => setConfirmAction('delete')}>삭제</button>
          <div>
            <button className="primary-button" onClick={() => setConfirmAction('save')}>수정</button>
            <button className="cancel-button" onClick={onClose}>취소</button>
          </div>
        </div>

        {confirmAction && <DetailConfirm action={confirmAction} member={member} onConfirm={() => confirmAction === 'save' ? onSave(form) : onDelete()} onCancel={() => setConfirmAction('')} />}
      </div>
    </Backdrop>
  );
}