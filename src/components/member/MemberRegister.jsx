import { useState, useRef, useEffect } from 'react';
import { Backdrop } from '../common';
import '../../styles/MemberRegister.css';

export function MemberRegister({ isOpen, onClose, onSave, member }) {
  const [form, setForm] = useState({
    name: '',
    birth: '',
    phone: '',
    gender: '남',
    level: '중',
    lessonType: '개인',
    lessonStatus: '등록',
    history: '이용중',
    startDate: new Date().toISOString().split('T')[0]
  });

  const [lessonSchedules, setLessonSchedules] = useState([
    { dayOfWeek: '월요일', time: '10:00' }
  ]);

  const [centerAlert, setCenterAlert] = useState('');
  const birthInputRef = useRef(null);
  const phoneInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const initialDate = member?.startDate || new Date().toISOString().split('T')[0];
      if (member) {
        setForm({
          name: member.name || '',
          birth: member.birth || '',
          phone: member.phone || '',
          gender: member.gender || '남',
          level: member.level || '중',
          lessonType: member.lessonType || '개인',
          lessonStatus: member.lessonStatus || '등록',
          history: member.history || '이용중',
          startDate: initialDate
        });
        setLessonSchedules(member.lessons || member.schedules || [{ dayOfWeek: '월요일', time: '10:00' }]);
      } else {
        setForm({
          name: '',
          birth: '',
          phone: '',
          gender: '남',
          level: '중',
          lessonType: '개인',
          lessonStatus: '등록',
          history: '이용중',
          startDate: initialDate
        });
        setLessonSchedules([{ dayOfWeek: '월요일', time: '10:00' }]);
      }
      setCenterAlert('');
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
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const isValidBirth = (birthStr) => {
    const clean = birthStr.replace(/\D/g, '');
    if (clean.length !== 6) return false;

    const yy = parseInt(clean.slice(0, 2), 10);
    const mm = parseInt(clean.slice(2, 4), 10);
    const dd = parseInt(clean.slice(4, 6), 10);

    if (mm < 1 || mm > 12) return false;

    const lastDays = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (dd < 1 || dd > lastDays[mm]) return false;

    if (mm === 2 && dd === 29) {
      const fullYear = yy + (yy > 50 ? 1900 : 2000);
      const isLeap = (fullYear % 4 === 0 && fullYear % 100 !== 0) || (fullYear % 400 === 0);
      if (!isLeap) return false;
    }

    return true;
  };

  // 시작일 다음 날부터 요일을 찾아 날짜를 계산하는 함수
  const calculateScheduleDate = (startDateStr, dayOfWeekStr) => {
    const daysMap = { '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6 };
    const targetDay = daysMap[dayOfWeekStr];
    if (targetDay === undefined) return startDateStr;

    const validStartDate = startDateStr || form.startDate || new Date().toISOString().split('T')[0];
    const [year, month, day] = validStartDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // 시작일 다음 날부터 시작
    date.setDate(date.getDate() + 1);

    while (date.getDay() !== targetDay) {
      date.setDate(date.getDate() + 1);
    }

    const rYear = date.getFullYear();
    const rMonth = String(date.getMonth() + 1).padStart(2, '0');
    const rDay = String(date.getDate()).padStart(2, '0');
    return `${rYear}-${rMonth}-${rDay}`;
  };

  const changeField = (event) => {
    const { name, value } = event.target;
    if (name === 'phone') {
      if (!isValidBirth(form.birth)) {
        setCenterAlert('생년월일 확인하세요.');
        birthInputRef.current?.focus();
        return;
      }
      setForm((curr) => ({ ...curr, phone: formatPhoneNumber(value) }));
    } else if (name === 'birth') {
      const newBirth = value.replace(/\D/g, '').slice(0, 6);
      setForm((curr) => ({ ...curr, birth: newBirth }));
    } else {
      setForm((curr) => ({ ...curr, [name]: value }));
    }
  };

  const handleBirthBlur = () => {
    if (form.birth.length > 0 && !isValidBirth(form.birth)) {
      setCenterAlert('생년월일 확인하세요.');
    }
  };

  const handlePhoneFocus = (e) => {
    if (!isValidBirth(form.birth)) {
      e.target.blur();
      setCenterAlert('생년월일 확인하세요.');
      birthInputRef.current?.focus();
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      setCenterAlert('회원명을 입력해주세요.');
      return;
    }
    if (!isValidBirth(form.birth)) {
      setCenterAlert('생년월일 확인하세요.');
      birthInputRef.current?.focus();
      return;
    }
    if (form.phone.replace(/\D/g, '').length < 10) {
      setCenterAlert('전화번호를 올바르게 입력해주세요.');
      return;
    }

    const lessonCheckSet = new Set();
    for (const sch of lessonSchedules) {
      const day = sch.dayOfWeek;
      const time = sch.time;
      const key = `${day}_${time}`;

      if (lessonCheckSet.has(key)) {
        setCenterAlert('레슨일정이 중복되었습니다.');
        return;
      }
      lessonCheckSet.add(key);
    }

    if (onSave) {
      const finalizedSchedules = lessonSchedules.map(sch => ({
        ...sch,
        date: calculateScheduleDate(form.startDate, sch.dayOfWeek)
      }));

      const savedData = {
        ...form,
        lessons: finalizedSchedules,
        schedules: finalizedSchedules
      };

      onSave(savedData);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        ref={modalBoxRef}
        className="member-register-modal"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {centerAlert && (
          <div className="member-register-alert-overlay">
            <div className="member-register-alert-box">
              <p>{centerAlert}</p>
              <button
                onClick={() => {
                  setCenterAlert('');
                  birthInputRef.current?.focus();
                }}
              >
                확인
              </button>
            </div>
          </div>
        )}

        <div className="modal-header" onMouseDown={handleMouseDown}>
          <h3>{member ? '회원 상세 정보' : '회원 등록'}</h3>
        </div>

        <div className="detail-form">
          <div className="field">
            <span>회원명</span>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={changeField}
              placeholder="회원명을 입력하세요"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <span>생년월일</span>
            <input
              type="text"
              name="birth"
              ref={birthInputRef}
              value={form.birth}
              onChange={changeField}
              onBlur={handleBirthBlur}
              placeholder="yymmdd (6자리)"
              maxLength={6}
              autoComplete="off"
            />
          </div>

          <div className="field">
            <span>전화번호</span>
            <input
              type="text"
              name="phone"
              ref={phoneInputRef}
              value={form.phone}
              onChange={changeField}
              onFocus={handlePhoneFocus}
              placeholder="010-0000-0000"
              autoComplete="off"
              style={{ backgroundColor: !isValidBirth(form.birth) && form.birth.length > 0 ? '#f5f5f5' : '#fff' }}
            />
          </div>

          <div className="field">
            <span>성별</span>
            <select name="gender" value={form.gender} onChange={changeField}>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </div>

          <div className="field">
            <span>등급</span>
            <select name="level" value={form.level} onChange={changeField}>
              <option value="상">상</option>
              <option value="중">중</option>
              <option value="하">하</option>
            </select>
          </div>

          <div className="field">
            <span>레슨 구분</span>
            <select name="lessonType" value={form.lessonType} onChange={changeField}>
              <option value="개인">개인 레슨</option>
              <option value="단체">단체 레슨</option>
            </select>
          </div>

          <div className="field">
            <span>회원 상태</span>
            <select name="history" value={form.history} onChange={changeField}>
              <option value="이용중">이용 중 (정상)</option>
              <option value="만료됨">종료됨 (만료)</option>
            </select>
          </div>

          {/* 레슨 일정 영역 */}
          <div className="full-width member-schedule-container schedule-section">
            <div className="member-schedule-header">
              <span className="schedule-title">레슨 일정 등록 (주 최대 4회)</span>

              <div className="schedule-controls">
                <div className="start-date-wrapper">
                  <span className="start-date-label">시작일:</span>
                  <input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={changeField}
                    className="start-date-input"
                  />
                </div>

                {lessonSchedules.length < 4 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (lessonSchedules.length >= 4) {
                        setCenterAlert('레슨은 주 최대 4회까지 등록할 수 있습니다.');
                        return;
                      }
                      setLessonSchedules([...lessonSchedules, { dayOfWeek: '수요일', time: '10:00' }]);
                    }}
                    className="member-add-btn"
                  >
                    + 일정 추가 ({lessonSchedules.length}/4)
                  </button>
                )}
              </div>
            </div>

            {lessonSchedules.map((schedule, index) => (
              <div key={index} className="member-schedule-row">
                <select
                  value={schedule.dayOfWeek}
                  onChange={(e) => {
                    const updated = [...lessonSchedules];
                    updated[index].dayOfWeek = e.target.value;
                    setLessonSchedules(updated);
                  }}
                >
                  <option value="월요일">월요일</option>
                  <option value="화요일">화요일</option>
                  <option value="수요일">수요일</option>
                  <option value="목요일">목요일</option>
                  <option value="금요일">금요일</option>
                  <option value="토요일">토요일</option>
                  <option value="일요일">일요일</option>
                </select>

                <select
                  value={schedule.time ? schedule.time.split(':')[0] : '10'}
                  onChange={(e) => {
                    const hour = e.target.value;
                    const minute = schedule.time ? schedule.time.split(':')[1] : '00';
                    const updated = [...lessonSchedules];
                    updated[index].time = `${hour}:${minute}`;
                    setLessonSchedules(updated);
                  }}
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
                >
                  {['00', '10', '20', '30', '40', '50'].map((m) => (
                    <option key={m} value={m}>{m}분</option>
                  ))}
                </select>

                {lessonSchedules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (lessonSchedules.length === 1) return;
                      setLessonSchedules(lessonSchedules.filter((_, i) => i !== index));
                    }}
                    className="member-del-btn"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>

        </div>

        <div className="modal-footer">
          <button onClick={handleSave} className="btn btn-save">{member ? '수정' : '등록'}</button>
          <button onClick={onClose} className="btn btn-cancel">취소</button>
        </div>
      </div>
    </Backdrop>
  );
}