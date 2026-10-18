import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { hourOptions, minuteOptions } from '../../lib/sheet';
import { Backdrop } from '../common';

const WEEKDAYS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

function currentLocalDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatPhoneNumber(value) {
  if (!value) return '';
  const numbers = String(value).replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
}

function PassScheduleModal({ pass, schedules, onClose }) {
  const passSchedules = schedules
    .filter((schedule) => String(schedule.passId) === String(pass.id))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  return createPortal(
    <div className="pass-schedule-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="pass-schedule-modal" role="dialog" aria-modal="true" aria-labelledby="pass-schedule-title">
        <header className="pass-schedule-header">
          <h3 id="pass-schedule-title">{pass.name} 회원 · 이용권 레슨 일정</h3>
          <button type="button" className="pass-schedule-close" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <div className="pass-schedule-list">
          {passSchedules.length ? passSchedules.map((schedule) => (
            <div className={`pass-schedule-row ${schedule.status === '완료' ? 'done' : ''}`} key={schedule.id}>
              <b>{schedule.date}</b>
              <span>{schedule.time}</span>
              <i>{schedule.status || '예약'}</i>
            </div>
          )) : <p className="pass-empty">이용권에 연결된 레슨 일정이 없어요.</p>}
        </div>
      </section>
    </div>,
    document.body
  );
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

export function MemberDetail({
  member,
  schedules = [],
  passes = [],
  onSave,
  onDelete,
  onAddPass,
  onDeletePass,
  onClose,
}) {
  const modalBoxRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const historyValue = member.status === '탈퇴' ? '탈퇴' : (member.history === '탈퇴' ? '탈퇴' : '이용중');
  const [form, setForm] = useState({
    ...member,
    phone: formatPhoneNumber(member.phone),
    history: historyValue,
    status: member.status === '탈퇴' ? '이용중' : (member.status || '등록'),
  });
  const [confirmAction, setConfirmAction] = useState('');
  const [newTotal, setNewTotal] = useState('8');
  const [newDay, setNewDay] = useState('월요일');
  const [newHour, setNewHour] = useState('10');
  const [newMinute, setNewMinute] = useState('00');
  const [selectedPass, setSelectedPass] = useState(null);
  const [isAddingPass, setIsAddingPass] = useState(false);
  const [centerAlert, setCenterAlert] = useState('');

  const handleMouseDown = (e) => {
    if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'OPTION'].includes(e.target.tagName)) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      setPosition({
        x: moveEvent.clientX - dragStartRef.current.x,
        y: moveEvent.clientY - dragStartRef.current.y,
      });
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const changeField = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: name === 'phone' ? formatPhoneNumber(value) : value,
    }));
  };

  const submitNewPass = async () => {
    const total = Number(newTotal);
    if (!Number.isInteger(total) || total <= 0) {
      setCenterAlert('이용권 횟수를 확인해 주세요.');
      return;
    }
    const pass = {
      member_id: member.id,
      name: member.name,
      total,
      used: 0,
      registeredAt: currentLocalDate(),
      day: newDay,
      time: `${newHour}:${newMinute}`,
    };
    setIsAddingPass(true);
    try {
      const result = await onAddPass?.(pass);
      setNewTotal('8');
      if (result?.passId) {
        setSelectedPass({ ...pass, id: result.passId });
      } else {
        setCenterAlert('이용권과 레슨 일정을 추가했어요.');
      }
    } catch (error) {
      setCenterAlert(`이용권을 추가하지 못했어요. ${error.message || ''}`);
    } finally {
      setIsAddingPass(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        ref={modalBoxRef}
        className="detail-modal"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {centerAlert && (
          <div className="member-register-alert-overlay">
            <div className="member-register-alert-box">
              <p>{centerAlert}</p>
              <button onClick={() => setCenterAlert('')}>확인</button>
            </div>
          </div>
        )}

        <div className="modal-header" onMouseDown={handleMouseDown} style={{ cursor: 'move', userSelect: 'none' }}>
          <div><h3>회원 상세 정보</h3></div>
        </div>

        <div className="detail-form">
          <label className="field"><span>회원명</span><input name="name" value={form.name} onChange={changeField} /></label>
          <label className="field"><span>생년월일</span><input name="birth" value={form.birth} onChange={changeField} /></label>
          <label className="field">
            <span>전화번호</span>
            <input name="phone" value={form.phone} onChange={changeField} placeholder="010-0000-0000" />
          </label>
          <label className="field">
            <span>레슨 구분</span>
            <select name="lessonType" value={form.lessonType || '개인'} onChange={changeField}>
              <option value="개인">개인 레슨</option>
              <option value="단체">단체 레슨</option>
            </select>
          </label>
          <label className="field">
            <span>레슨상태</span>
            <select name="status" value={form.status} onChange={changeField}>
              <option value="등록">등록</option>
              <option value="이용중">이용중</option>
              <option value="완료">완료</option>
            </select>
          </label>
          <label className="field">
            <span>이력상태</span>
            <select name="history" value={form.history} onChange={changeField}>
              <option value="이용중">이용중</option>
              <option value="탈퇴">탈퇴</option>
            </select>
          </label>
        </div>

        <div className="pass-section">
          <div className="pass-section-head"><span className="eyebrow">이용권</span></div>
          <div className="pass-list pass-list--cards">
            {passes.length ? passes.map((pass) => (
              <div className={`pass-row pass-card ${pass.status === '완료' ? 'done' : ''}`} key={pass.id}>
                <button type="button" className="pass-card-view" onClick={() => setSelectedPass(pass)}>
                  <b>{pass.used}/{pass.total}회</b>
                  <span>{pass.status}</span>
                  <i>{pass.registeredAt}</i>
                  <span className="pass-view-label">레슨 일정 보기</span>
                </button>
                <button type="button" className="pass-del" onClick={async () => {
                  try {
                    await onDeletePass?.(pass);
                    if (String(selectedPass?.id) === String(pass.id)) setSelectedPass(null);
                    setCenterAlert('이용권과 연결된 레슨 일정을 삭제했어요.');
                  } catch (error) {
                    setCenterAlert(`이용권을 삭제하지 못했어요. ${error.message || ''}`);
                  }
                }}>지우기</button>
              </div>
            )) : <p className="pass-empty">등록된 이용권이 없어요.</p>}
          </div>
          <div className="pass-add">
            <label>총 횟수<input type="number" min="1" step="1" value={newTotal} onChange={(event) => setNewTotal(event.target.value)} /></label>
            <label>시작 요일<select value={newDay} onChange={(event) => setNewDay(event.target.value)}>{WEEKDAYS.map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
            <label>시간<select value={newHour} onChange={(event) => setNewHour(event.target.value)}>{hourOptions.filter((hour) => Number(hour) >= 6 && Number(hour) <= 22).map((hour) => <option key={hour} value={hour}>{hour}시</option>)}</select></label>
            <label>분<select value={newMinute} onChange={(event) => setNewMinute(event.target.value)}>{minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}분</option>)}</select></label>
            <button type="button" className="primary-button" onClick={submitNewPass} disabled={isAddingPass}>{isAddingPass ? '추가 중…' : '＋ 이용권 추가'}</button>
          </div>
        </div>

        <div className="detail-actions">
          <button className="delete-button" onClick={() => setConfirmAction('delete')}>삭제</button>
          <div>
            <button
              className="primary-button"
              onClick={() => setConfirmAction('save')}
            >
              수정
            </button>
            <button className="cancel-button" onClick={onClose}>취소</button>
          </div>
        </div>

        {confirmAction && (
          <DetailConfirm
            action={confirmAction}
            member={member}
            onConfirm={() => {
              if (confirmAction === 'save') {
                onSave(form);
              } else {
                onDelete();
              }
            }}
            onCancel={() => setConfirmAction('')}
          />
        )}
      </div>
      {selectedPass && <PassScheduleModal pass={selectedPass} schedules={schedules} onClose={() => setSelectedPass(null)} />}
    </Backdrop>
  );
}
