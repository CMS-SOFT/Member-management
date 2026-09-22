import { useState, useRef, useEffect } from 'react';
import { Backdrop } from '../common';

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

  // 시작일과 요일이 같거나 앞서있으면 무조건 다음 주 해당 요일로 계산하는 함수
  const calculateScheduleDate = (startDateStr, dayOfWeekStr) => {
    const daysMap = { '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6 };
    const targetDay = daysMap[dayOfWeekStr];
    if (targetDay === undefined) return startDateStr;

    const [year, month, day] = startDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const currentDay = date.getDay();
    let diff = targetDay - currentDay;

    // 시작일 당일이거나 과거라면 무조건 다음 주(7일 뒤)로 설정
    if (diff <= 0) {
      diff += 7;
    }

    date.setDate(date.getDate() + diff);

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
      alert('회원명을 입력해주세요.');
      return;
    }
    if (!isValidBirth(form.birth)) {
      setCenterAlert('생년월일 확인하세요.');
      birthInputRef.current?.focus();
      return;
    }
    if (form.phone.replace(/\D/g, '').length < 10) {
      alert('전화번호를 올바르게 입력해주세요.');
      return;
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
        style={{
          backgroundColor: '#fff',
          width: '540px',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {/* 중앙 경고 팝업 */}
        {centerAlert && (
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
            zIndex: 100,
            borderRadius: '8px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              padding: '24px 32px',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              minWidth: '280px'
            }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>
                {centerAlert}
              </span>
              <button
                onClick={() => {
                  setCenterAlert('');
                  birthInputRef.current?.focus();
                }}
                style={{
                  backgroundColor: '#900020',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                확인
              </button>
            </div>
          </div>
        )}

        <div onMouseDown={handleMouseDown} style={{ padding: '20px', borderBottom: '1px solid #eee', cursor: 'move', userSelect: 'none' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#333' }}>{member ? '회원 상세 정보' : '회원 등록'}</h3>
        </div>

        {/* 메인 컨테이너 */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 1행: 회원명, 생년월일 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>회원명</span>
              <input type="text" name="name" value={form.name} onChange={changeField} placeholder="회원명을 입력하세요" autoComplete="off" style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', outline: 'none' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>생년월일</span>
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
                style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', outline: 'none' }}
              />
            </label>
          </div>

          {/* 2행: 전화번호 / 성별 / 등급 */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>전화번호</span>
              <input
                type="text"
                name="phone"
                ref={phoneInputRef}
                value={form.phone}
                onChange={changeField}
                onFocus={handlePhoneFocus}
                placeholder="010-0000-0000"
                autoComplete="off"
                style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', outline: 'none', backgroundColor: !isValidBirth(form.birth) && form.birth.length > 0 ? '#f5f5f5' : '#fff' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>성별</span>
              <select name="gender" value={form.gender} onChange={changeField} style={{ width: '100%', padding: '10px 8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: '#fff', outline: 'none' }}>
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>등급</span>
              <select name="level" value={form.level} onChange={changeField} style={{ width: '100%', padding: '10px 8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: '#fff', outline: 'none' }}>
                <option value="상">상</option>
                <option value="중">중</option>
                <option value="하">하</option>
              </select>
            </label>
          </div>

          {/* 3행: 레슨 구분, 회원 상태 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>레슨 구분</span>
              <select name="lessonType" value={form.lessonType} onChange={changeField} style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: '#fff', outline: 'none' }}>
                <option value="개인">개인 레슨</option>
                <option value="단체">단체 레슨</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>회원 상태</span>
              <select name="history" value={form.history} onChange={changeField} style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: '#fff', outline: 'none' }}>
                <option value="이용중">이용 중 (정상)</option>
                <option value="만료됨">종료됨 (만료)</option>
              </select>
            </label>
          </div>

          {/* 레슨 일정 영역 */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #eee', paddingTop: '16px' }}>

            {/* 타이틀, 시작일, 일정 추가 버튼 한 줄 배치 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>레슨 일정 등록 (주 최대 4회)</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>시작일:</span>
                  <input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={changeField}
                    style={{
                      padding: '5px 8px',
                      fontSize: '13px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      outline: 'none',
                      backgroundColor: '#fff'
                    }}
                  />
                </div>

                {lessonSchedules.length < 4 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (lessonSchedules.length >= 4) {
                        alert('레슨은 주 최대 4회까지 등록할 수 있습니다.');
                        return;
                      }
                      setLessonSchedules([...lessonSchedules, { dayOfWeek: '수요일', time: '10:00' }]);
                    }}
                    style={{ backgroundColor: '#555', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    + 일정 추가 ({lessonSchedules.length}/4)
                  </button>
                )}
              </div>
            </div>

            {/* 일정 목록 (요일, 시간 설정) */}
            {lessonSchedules.map((schedule, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%'
                }}
              >
                <select
                  value={schedule.dayOfWeek}
                  onChange={(e) => {
                    const updated = [...lessonSchedules];
                    updated[index].dayOfWeek = e.target.value;
                    setLessonSchedules(updated);
                  }}
                  style={{ flex: 2, padding: '10px 8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#fff', outline: 'none' }}
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
                  style={{ flex: 1.5, padding: '10px 8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#fff', outline: 'none' }}
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
                  style={{ flex: 1.5, padding: '10px 8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#fff', outline: 'none' }}
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
                    style={{
                      flex: '0 0 auto',
                      padding: '10px 12px',
                      backgroundColor: '#a94442',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* 모달 푸터 */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#f9f9f9', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
          <button onClick={handleSave} style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '600', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#900020', color: 'white' }}>{member ? '수정' : '등록'}</button>
          <button onClick={onClose} style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '600', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'white', color: '#333' }}>취소</button>
        </div>
      </div>
    </Backdrop>
  );
}