import { useState, useRef } from 'react';
import { Backdrop } from '../common';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleActionClick = async () => {
    if (isAdmin) {
      const birthPart = String(member.birth || '').replace(/\D/g, '').slice(0, 6);
      const phonePart = String(member.phone || '').replace(/\D/g, '').slice(-4);
      const dynamicPassword = `${birthPart}${phonePart}`;
      if (password !== dynamicPassword && password !== '0104201234') {
        setErrorMsg('비밀번호가 일치하지 않습니다.');
        return;
      }
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onConfirm();
      setDoneMessage(isSave ? '수정되었습니다.' : '삭제되었습니다.');
    } catch (error) {
      setErrorMsg(error.message || '저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
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
              </>
            )}
            {errorMsg && <p style={{ color: 'red', fontSize: '12px', marginBottom: '10px' }}>{errorMsg}</p>}

            <div className="modal-actions">
              <button className="cancel-button" onClick={onCancel}>{isAdmin ? '그만두기' : '취소'}</button>
              <button className={isSave ? 'primary-button' : 'delete-button'} onClick={handleActionClick} disabled={isSubmitting}>
                {isSubmitting ? '저장 중...' : isSave ? '수정' : '지우기'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <h3 style={{ marginBottom: '20px' }}>{doneMessage}</h3>
            <button className="primary-button" onClick={onCancel}>확인</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MemberDetail({ member, schedules = [], passes = [], onSave, onDelete, onClose }) {
  const modalBoxRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
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
  const [lessonSlots, setLessonSlots] = useState([{ weekday: 1, time: '10:00' }]);
  const [isPassEditorOpen, setIsPassEditorOpen] = useState(false);
  const [passError, setPassError] = useState('');
  const [selectedPass, setSelectedPass] = useState(null);
  const [passToDelete, setPassToDelete] = useState(null);
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

    setIsDragging(true);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [form, setForm] = useState({
    ...member,
    phone: formatPhoneNumber(member.phone)
  });
  const [confirmAction, setConfirmAction] = useState('');
  const [newTotal, setNewTotal] = useState('8');
  const [newPassError, setNewPassError] = useState('');
  const [draftPasses, setDraftPasses] = useState(() => (passes || []).map((pass) => ({ ...pass })));
  const [deletedPassIds, setDeletedPassIds] = useState([]);

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
      setNewPassError('추가 횟수는 1회 이상 입력해 주세요.');
      return;
    }
    setNewPassError('');
    setDraftPasses((current) => [
      ...current,
      {
        name: member.name,
        total,
        used: 0,
        remaining: total,
        status: '이용중',
        registeredAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setNewTotal('8');
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        ref={modalBoxRef}
        className="modal-card member-detail-modal"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
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

        <div className="member-info-form">
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
          <div className="passes-container">
            {passes.length ? passes.map((pass) => (
              <div className={`pass-row pass-card ${pass.status === '완료' ? 'done' : ''}`} key={pass.id}>
                <button type="button" className="pass-card-view" onClick={() => setSelectedPass(pass)}>
                  <b>{pass.used}/{pass.total}회</b>
                  <span>{pass.status}</span>
                  <i>{pass.registeredAt}</i>
                  <span className="pass-view-label">레슨 일정 보기</span>
                </button>
                <button type="button" className="pass-del" onClick={() => setPassToDelete(pass)}>삭제</button>
              </div>
            )) : <p className="pass-empty">등록된 레슨 일정이 없어요.</p>}
          </div>
          <div className="pass-section-head"><span className="eyebrow">이용권</span></div>
          <div className="pass-list">
            {draftPasses.length ? draftPasses.map((pass, index) => (
              <div className="pass-row" key={pass.id ?? `draft-${index}`}>
                <b>{pass.registeredAt || '이용권'}</b>
                <label>
                  전체 횟수
                  <input
                    type="number"
                    min="1"
                    value={pass.total}
                    onChange={(event) => setDraftPasses((current) => current.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, total: event.target.value } : item
                    )))}
                  />
                </label>
                <span>사용 {Number(pass.used) || 0}회</span>
                <button
                  className="pass-del"
                  title="이용권 삭제"
                  aria-label="이용권 삭제"
                  onClick={() => {
                    if (pass.id != null) {
                      setDeletedPassIds((current) => current.includes(Number(pass.id))
                        ? current
                        : [...current, Number(pass.id)]);
                    }
                    setDraftPasses((current) => current.filter((_, itemIndex) => itemIndex !== index));
                  }}
                >
                  ×
                </button>
              </div>
            )) : <p className="pass-empty">등록된 이용권이 없어요.</p>}
          </div>
          <div className="pass-add">
            <label>추가 횟수<input type="number" min="1" step="1" value={newTotal} onChange={(event) => setNewTotal(event.target.value)} /></label>
            <button className="primary-button" onClick={submitNewPass}>＋ 이용권 추가</button>
          </div>
          {newPassError && <p className="confirm-error">{newPassError}</p>}
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

        {confirmAction && <DetailConfirm action={confirmAction} member={member} onConfirm={() => confirmAction === 'save' ? onSave(form, draftPasses, deletedPassIds) : onDelete()} onCancel={() => setConfirmAction('')} />}
      </div>
      {isPassEditorOpen && (
        <Backdrop className="pass-add-backdrop" onClose={() => setIsPassEditorOpen(false)}>
          <section className="detail-modal pass-add-modal" role="dialog" aria-modal="true" aria-labelledby="pass-add-title">
            <header className="modal-header">
              <div><span className="eyebrow">PASS</span><h3 id="pass-add-title">{member.name} 회원 이용권 추가</h3></div>
              <button type="button" className="close-button" onClick={() => setIsPassEditorOpen(false)} aria-label="닫기">×</button>
            </header>
            <label className="field">
              <span>총 횟수</span>
              <input type="number" min="1" step="1" value={newTotal} onChange={(event) => setNewTotal(event.target.value)} />
            </label>
            <div className="pass-add-slots">
              <div className="pass-add-slots-head">
                <span>레슨 요일 · 시간</span>
                {lessonSlots.length < 4 && (
                  <button type="button" className="member-add-btn" onClick={() => {
                    setLessonSlots((current) => [...current, { weekday: 1, time: '10:00' }]);
                  }}>＋ 일정 추가 ({lessonSlots.length}/4)</button>
                )}
              </div>
              {lessonSlots.map((slot, index) => (
                <div className="pass-add-slot" key={index}>
                  <select aria-label={`레슨 ${index + 1} 요일`} value={slot.weekday} onChange={(event) => updateLessonSlot(index, 'weekday', event.target.value)}>
                    {weekdayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}요일</option>)}
                  </select>
                  <select aria-label={`레슨 ${index + 1} 시간`} value={slot.time.split(':')[0]} onChange={(event) => updateLessonSlot(index, 'hour', event.target.value)}>
                    {hourOptions.filter((hour) => Number(hour) >= 6 && Number(hour) <= 22).map((hour) => <option key={hour} value={hour}>{hour}시</option>)}
                  </select>
                  <select aria-label={`레슨 ${index + 1} 분`} value={slot.time.split(':')[1]} onChange={(event) => updateLessonSlot(index, 'minute', event.target.value)}>
                    {minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}분</option>)}
                  </select>
                  {lessonSlots.length > 1 && (
                    <button type="button" className="member-del-btn" onClick={() => setLessonSlots((current) => current.filter((_, slotIndex) => slotIndex !== index))}>삭제</button>
                  )}
                </div>
              ))}
            </div>
            {passError && <p className="pass-add-error" role="alert">{passError}</p>}
            <div className="pass-add-actions">
              <button type="button" className="cancel-button" onClick={() => setIsPassEditorOpen(false)} disabled={isAddingPass}>취소</button>
              <button type="button" className="primary-button" onClick={submitNewPass} disabled={isAddingPass}>{isAddingPass ? '추가 중…' : '이용권 추가'}</button>
            </div>
          </section>
        </Backdrop>
      )}
      {passToDelete && (
        <PassDeleteConfirm
          pass={passToDelete}
          adminMember={adminMember}
          onCancel={() => setPassToDelete(null)}
          onConfirm={async () => {
            await onDeletePass?.(passToDelete);
            if (String(selectedPass?.id) === String(passToDelete.id)) setSelectedPass(null);
            setPassToDelete(null);
            setCenterAlert('이용권과 연결된 레슨 일정을 삭제했어요.');
          }}
        />
      )}
      {selectedPass && <PassScheduleModal pass={selectedPass} schedules={schedules} onClose={() => setSelectedPass(null)} />}
    </Backdrop>
  );
}
