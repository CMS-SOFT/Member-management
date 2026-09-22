import { useState, useRef } from 'react';
import { Backdrop } from '../common';

export function MemberRegister({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', birth: '', phone: '', status: '미완료', history: '진행' });

  // 레슨 일정 목록 상태 (기본 1개 제공, 최대 4회)
  const [lessonSchedules, setLessonSchedules] = useState([
    { dayOfWeek: '월요일', time: '10:00' }
  ]);

  // 팝업창 드래그 이동을 위한 상태 및 레프
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

  // 전화번호 자동 하이픈 포맷팅 함수
  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length <= 11) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const changeField = (event) => {
    const { name, value } = event.target;
    if (name === 'phone') {
      const formatted = formatPhoneNumber(value);
      setForm((currentForm) => ({ ...currentForm, phone: formatted }));
    } else {
      setForm((currentForm) => ({ ...currentForm, [name]: value }));
    }
  };

  // 생년월일 6자리 유효성 검사 함수 (YYMMDD)
  const isValidBirth = (birthStr) => {
    const clean = birthStr.replace(/\D/g, '');
    if (clean.length !== 6) return false;

    const mm = parseInt(clean.slice(2, 4), 10);
    const dd = parseInt(clean.slice(4, 6), 10);

    if (mm < 1 || mm > 12) return false;
    const daysInMonth = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (dd < 1 || dd > daysInMonth[mm]) return false;

    return true;
  };

  // 일정 칸 추가 함수 (최대 4회 제한)
  const handleAddScheduleSlot = () => {
    if (lessonSchedules.length >= 4) {
      alert('레슨은 주 최대 4회까지 등록할 수 있습니다.');
      return;
    }
    setLessonSchedules([...lessonSchedules, { dayOfWeek: '수요일', time: '10:00' }]);
  };

  // 일정 칸 삭제 함수
  const handleRemoveScheduleSlot = (index) => {
    if (lessonSchedules.length === 1) return;
    const updated = lessonSchedules.filter((_, i) => i !== index);
    setLessonSchedules(updated);
  };

  // 저장 버튼 클릭 시 유효성 검사 및 저장
  const handleSave = () => {
    if (!form.name.trim()) {
      alert('회원명을 입력해주세요.');
      return;
    }
    if (!isValidBirth(form.birth)) {
      alert('올바른 생년월일 6자리(예: 740607)를 입력해주세요.');
      return;
    }
    if (form.phone.replace(/\D/g, '').length < 10) {
      alert('전화번호를 올바르게 입력해주세요.');
      return;
    }

    onSave({
      ...form,
      schedules: lessonSchedules
    });
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        ref={modalBoxRef}
        className="detail-modal"
        style={{
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* 상단 헤더 영역 (불필요한 문구 제거, 마우스 드래그 이동 기능은 유지) */}
        <div
          className="modal-header"
          onMouseDown={handleMouseDown}
          style={{ cursor: 'move', userSelect: 'none' }}
        >
          <div>
            <h3>회원 등록</h3>
          </div>
        </div>

        <div className="detail-form">
          <label className="field">
            <span>회원명</span>
            <input name="name" value={form.name} onChange={changeField} placeholder="회원명을 입력하세요" />
          </label>
          <label className="field">
            <span>생년월일</span>
            <input name="birth" value={form.birth} onChange={changeField} placeholder="yymmdd" />
          </label>
          <label className="field">
            <span>전화번호</span>
            <input name="phone" value={form.phone} onChange={changeField} placeholder="010-0000-0000" />
          </label>
          <label className="field">
            <span>레슨상태</span>
            <select name="status" value={form.status} onChange={changeField}>
              <option>완료</option>
              <option>미완료</option>
            </select>
          </label>
          <label className="field">
            <span>이력상태</span>
            <select name="history" value={form.history} onChange={changeField}>
              <option>진행</option>
              <option>만료</option>
            </select>
          </label>

          {/* 레슨 일정 요일 및 시간 동적 입력 영역 (주 최대 4회) */}
          <div className="field" style={{ gridColumn: '1 / -1', marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>레슨 일정 등록 (주 최대 4회)</span>
              {lessonSchedules.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddScheduleSlot}
                  style={{ padding: '4px 10px', fontSize: '12px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  + 일정 추가 ({lessonSchedules.length}/4)
                </button>
              )}
            </div>

            {lessonSchedules.map((schedule, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <select
                  value={schedule.dayOfWeek}
                  onChange={(e) => {
                    const updated = [...lessonSchedules];
                    updated[index].dayOfWeek = e.target.value;
                    setLessonSchedules(updated);
                  }}
                  style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="월요일">월요일</option>
                  <option value="화요일">화요일</option>
                  <option value="수요일">수요일</option>
                  <option value="목요일">목요일</option>
                  <option value="금요일">금요일</option>
                  <option value="토요일">토요일</option>
                  <option value="일요일">일요일</option>
                </select>

                <input
                  type="time"
                  value={schedule.time}
                  onChange={(e) => {
                    const updated = [...lessonSchedules];
                    updated[index].time = e.target.value;
                    setLessonSchedules(updated);
                  }}
                  style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />

                {lessonSchedules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveScheduleSlot(index)}
                    style={{ padding: '8px 12px', background: '#a94442', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>

        </div>
        <div className="detail-actions detail-actions--register">
          <button className="primary-button" onClick={handleSave}>등록</button>
          <button className="cancel-button" onClick={onClose}>취소</button>
        </div>
      </div>
    </Backdrop>
  );
}