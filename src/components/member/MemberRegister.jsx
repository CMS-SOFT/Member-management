import { useState, useRef, useEffect } from 'react';
import { Backdrop } from '../common';
import '../../styles/MemberRegister.css';

export function MemberRegister({ isOpen, onClose, onSave, member }) {
  const [form, setForm] = useState({
    name: '',
    birth: '',
    phone: '',
    gender: '남',
    lessonType: '개인',
    lessonStatus: '등록',
    history: '이용중'
  });

  const [lessonSchedules, setLessonSchedules] = useState([
    { dayOfWeek: '월요일', time: '10:00' }
  ]);

  const [touched, setTouched] = useState({
    name: false,
    birth: false,
    phone: false
  });

  // 커스텀 알림 팝업 메시지 상태 관리
  const [alertMsg, setAlertMsg] = useState('');
  const [focusTarget, setFocusTarget] = useState(null);

  // 생년월일 인풋 제어용 Ref
  const birthInputRef = useRef(null);

  // 💡 DB에서 읽어온 데이터(member)를 그대로 바인딩하고, 신규 등록일 때만 초기값 세팅
  useEffect(() => {
    if (isOpen) {
      if (member) {
        setForm({
          name: member.name || '',
          birth: member.birth || '',
          phone: member.phone || '',
          gender: member.gender || '남',
          lessonType: member.lessonType || '개인',
          lessonStatus: member.lessonStatus || '등록',
          history: member.history || '이용중'
        });
        setLessonSchedules(member.lessons || member.schedules || [{ dayOfWeek: '월요일', time: '10:00' }]);
      } else {
        // 완전 신규 등록 폼 초기값
        setForm({
          name: '',
          birth: '',
          phone: '',
          gender: '남',
          lessonType: '개인',
          lessonStatus: '등록',
          history: '이용중'
        });
        setLessonSchedules([{ dayOfWeek: '월요일', time: '10:00' }]);
      }
      setTouched({ name: false, birth: false, phone: false });
      setAlertMsg('');
    }
  }, [isOpen, member]);

  const modalBoxRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'OPTION'].includes(e.target.tagName)) {
      return;
    }
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

  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const isValidBirth = (birthStr) => {
    const clean = birthStr.replace(/\D/g, '');
    if (clean.length !== 6) return false;

    const mm = parseInt(clean.slice(2, 4), 10);
    const dd = parseInt(clean.slice(4, 6), 10);

    if (mm < 1 || mm > 12) return false;
    if (dd < 1 || dd > 31) return false;

    return true;
  };

  const changeField = (event) => {
    const { name, value } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    if (name === 'phone') {
      const formatted = formatPhoneNumber(value);
      setForm((currentForm) => ({ ...currentForm, phone: formatted }));
    } else if (name === 'birth') {
      const numbers = value.replace(/\D/g, '').slice(0, 6);
      setForm((currentForm) => ({ ...currentForm, birth: numbers }));
    } else {
      setForm((currentForm) => ({ ...currentForm, [name]: value }));
    }
  };

  const handleAddScheduleSlot = () => {
    if (lessonSchedules.length >= 4) {
      setAlertMsg('레슨은 주 최대 4회까지 등록할 수 있습니다.');
      return;
    }
    setLessonSchedules([...lessonSchedules, { dayOfWeek: '수요일', time: '10:00' }]);
  };

  const handleRemoveScheduleSlot = (index) => {
    if (lessonSchedules.length === 1) return;
    const updated = lessonSchedules.filter((_, i) => i !== index);
    setLessonSchedules(updated);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      setAlertMsg('회원명을 입력해주세요.');
      return;
    }
    if (!isValidBirth(form.birth)) {
      setAlertMsg('생년월일 형식이 맞지 않습니다.');
      setFocusTarget('birth');
      return;
    }
    if (form.phone.replace(/\D/g, '').length < 10) {
      setAlertMsg('전화번호를 올바르게 입력해주세요.');
      return;
    }

    if (onSave) {
      onSave({
        ...form,
        lessons: lessonSchedules,
        schedules: lessonSchedules
      });
    }
  };

  const handleAlertConfirm = () => {
    setAlertMsg('');
    if (focusTarget === 'birth') {
      setTimeout(() => {
        if (birthInputRef.current) {
          birthInputRef.current.focus();
        }
      }, 0);
      setFocusTarget(null);
    }
  };

  const isNameValid = form.name.trim().length > 0;
  const isBirthValid = isValidBirth(form.birth);
  const isPhoneValid = form.phone.replace(/\D/g, '').length >= 10;

  return (
    <Backdrop onClose={onClose}>
      <div
        ref={modalBoxRef}
        className="detail-modal modal-content member-register-modal"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
          position: 'relative'
        }}
      >
        {alertMsg && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            borderRadius: '8px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              width: '320px',
              textAlign: 'center'
            }}>
              <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                {alertMsg}
              </p>
              <button
                type="button"
                onClick={handleAlertConfirm}
                style={{
                  backgroundColor: '#900020',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                확인
              </button>
            </div>
          </div>
        )}

        <div
          className="modal-header draggable-header"
          onMouseDown={handleMouseDown}
        >
          <div>
            <h3>{member ? '회원 상세 정보' : '회원 등록'}</h3>
          </div>
        </div>

        <div className="detail-form">
          {/* 회원명 */}
          <label className="field">
            <span>회원명</span>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={changeField}
              placeholder="회원명을 입력하세요"
              autoComplete="off"
              className={isNameValid ? 'valid-input' : ''}
            />
          </label>

          {/* 생년월일 */}
          <label className="field">
            <span>생년월일</span>
            <input
              type="text"
              name="birth"
              ref={birthInputRef}
              value={form.birth}
              onChange={changeField}
              placeholder="yymmdd (6자리)"
              maxLength={6}
              autoComplete="off"
              className={
                form.birth.length === 0
                  ? ''
                  : (isBirthValid ? 'valid-input' : 'invalid-input')
              }
            />
          </label>

          {/* 전화번호 */}
          <label className="field">
            <span>전화번호</span>
            <input
              type="text"
              name="phone"
              value={form.phone}
              onChange={changeField}
              onFocus={() => {
                if (form.birth.length > 0 && !isValidBirth(form.birth)) {
                  setAlertMsg('생년월일 형식이 맞지 않습니다.');
                  setFocusTarget('birth');
                }
              }}
              placeholder="010-0000-0000"
              autoComplete="off"
              className={
                form.phone.length === 0
                  ? ''
                  : (isPhoneValid ? 'valid-input' : 'invalid-input')
              }
            />
          </label>

          {/* 성별 */}
          <label className="field">
            <span>성별</span>
            <select name="gender" value={form.gender} onChange={changeField}>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </label>

          {/* 레슨 구분 */}
          <label className="field">
            <span>레슨 구분</span>
            <select name="lessonType" value={form.lessonType} onChange={changeField}>
              <option value="개인">개인 레슨</option>
              <option value="단체">단체 레슨</option>
            </select>
          </label>

          {/* 레슨 상태 */}
          <label className="field">
            <span>레슨상태</span>
            <select name="lessonStatus" value={form.lessonStatus} onChange={changeField}>
              <option value="등록">등록</option>
              <option value="완료">완료</option>
            </select>
          </label>

          {/* 회원 상태 */}
          <label className="field">
            <span>회원 상태</span>
            <select name="history" value={form.history} onChange={changeField}>
              <option value="이용중">이용 중 (정상)</option>
              <option value="만료됨">종료됨 (만료)</option>
            </select>
          </label>

          {/* 레슨 일정 영역 */}
          <div className="field full-width schedule-section-container">
            <div className="schedule-header">
              <span>레슨 일정 등록 (주 최대 4회)</span>
              {lessonSchedules.length < 4 && (
                <button
                  type="button"
                  className="add-schedule-btn"
                  onClick={handleAddScheduleSlot}
                >
                  + 일정 추가 ({lessonSchedules.length}/4)
                </button>
              )}
            </div>

            {lessonSchedules.map((schedule, index) => (
              <div key={index} className="schedule-row">
                <select
                  value={schedule.dayOfWeek}
                  onChange={(e) => {
                    const updated = [...lessonSchedules];
                    updated[index].dayOfWeek = e.target.value;
                    setLessonSchedules(updated);
                  }}
                  className="schedule-select"
                >
                  <option value="월요일">월요일</option>
                  <option value="화요일">화요일</option>
                  <option value="수요일">수요일</option>
                  <option value="목요일">목요일</option>
                  <option value="금요일">금요일</option>
                  <option value="토요일">토요일</option>
                  <option value="일요일">일요일</option>
                </select>

                , <select
                  value={schedule.time ? schedule.time.split(':')[0] : '10'}
                  onChange={(e) => {
                    const hour = e.target.value;
                    const minute = schedule.time ? schedule.time.split(':')[1] : '00';
                    const updated = [...lessonSchedules];
                    updated[index].time = `${hour}:${minute}`;
                    setLessonSchedules(updated);
                  }}
                  className="schedule-select"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const h = String(i).padStart(2, '0');
                    return <option key={h} value={h}>{h}시</option>;
                  })}
                </select>

                <select
                  value={schedule.time ? schedule.time.split(':')[1] : '00'}
                  onChange={(e) => {
                    const hour = schedule.time ? schedule.time.split(':')[0] : '10';
                    const minute = e.target.value;
                    const updated = [...lessonSchedules];
                    updated[index].time = `${hour}:${minute}`;
                    setLessonSchedules(updated);
                  }}
                  className="schedule-select"
                >
                  {['00', '10', '20', '30', '40', '50'].map((m) => (
                    <option key={m} value={m}>{m}분</option>
                  ))}
                </select>

                {lessonSchedules.length > 1 && (
                  <button
                    type="button"
                    className="schedule-delete-btn"
                    onClick={() => handleRemoveScheduleSlot(index)}
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>

        </div>
        <div className="modal-footer">
          <button className="btn btn-save" onClick={handleSave}>{member ? '수정' : '등록'}</button>
          <button className="btn btn-cancel" onClick={onClose}>취소</button>
        </div>
      </div>
    </Backdrop>
  );
}