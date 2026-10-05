import { useState } from 'react';
import { timeOptions, weekdayOptions, generateRecurringLessons } from '../../lib/sheet';
import { Backdrop } from '../common';

// 재등록 팝업: 새 이용권(총 횟수)과 반복 요일/시간을 정하면 향후 일정을 자동 생성합니다.
export function ReregisterModal({ member, onClose, onSubmit }) {
  const [total, setTotal] = useState('8');
  const [slots, setSlots] = useState([{ weekday: 1, time: '18:00' }]);
  const today = new Date().toISOString().slice(0, 10);

  const updateSlot = (index, key, value) => {
    setSlots((current) => current.map((slot, i) => i === index ? { ...slot, [key]: key === 'weekday' ? Number(value) : value } : slot));
  };
  const addSlot = () => setSlots((current) => [...current, { weekday: 1, time: '18:00' }]);
  const removeSlot = (index) => setSlots((current) => current.filter((_, i) => i !== index));

  const count = Number(total) || 0;
  const preview = generateRecurringLessons(slots, today, count);

  const submit = () => {
    if (count <= 0 || !preview.length) return;
    onSubmit({ name: member.name, total: count, registeredAt: today, schedules: preview });
  };

  return <Backdrop onClose={onClose}><div className="detail-modal reregister-modal">
    <div className="modal-header"><div><span className="eyebrow">RE-REGISTER</span><h3>{member.name} 회원 재등록</h3></div></div>
    <div className="reregister-body">
      <label className="field"><span>총 횟수</span><input type="number" min="1" value={total} onChange={(event) => setTotal(event.target.value)} /></label>

      <div className="reregister-slots">
        <div className="reregister-slots-head"><span>레슨 요일 · 시간</span><button className="square-button" onClick={addSlot}>＋ 추가</button></div>
        {slots.map((slot, index) => (
          <div className="reregister-slot" key={index}>
            <select value={slot.weekday} onChange={(event) => updateSlot(index, 'weekday', event.target.value)}>
              {weekdayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}요일</option>)}
            </select>
            <select value={slot.time} onChange={(event) => updateSlot(index, 'time', event.target.value)}>
              {timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
            {slots.length > 1 && <button className="pass-del" onClick={() => removeSlot(index)}>✕</button>}
          </div>
        ))}
      </div>

      <p className="reregister-preview">오늘({today})부터 레슨 <b>{preview.length}</b>개가 자동으로 잡혀요.{preview.length ? ` 첫 레슨: ${preview[0].date} ${preview[0].time}` : ''}</p>
    </div>
    <div className="detail-actions detail-actions--register">
      <button className="primary-button" disabled={count <= 0 || !preview.length} onClick={submit}>재등록 확정</button>
      <button className="cancel-button" onClick={onClose}>취소</button>
    </div>
  </div></Backdrop>;
}
