import { useState } from 'react';
import { Backdrop } from './common';
import { useDraggable } from '../lib/useDraggable';
import { weekDays } from '../lib/sheet';

function formatWon(value) {
  return `${(Number(value) || 0).toLocaleString('ko-KR')}원`;
}

function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function SettlementEditor({ members, entry, date, onClose, onSave, onDelete }) {
  const [memberId, setMemberId] = useState(String(entry?.member_id || ''));
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [note, setNote] = useState(entry?.note || '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { dragHandleProps, style } = useDraggable();

  const submit = async (event) => {
    event.preventDefault();
    const numericAmount = Number(String(amount).replace(/\D/g, ''));
    if (!memberId) {
      setError('회원을 선택해 주세요.');
      return;
    }
    if (!Number.isSafeInteger(numericAmount) || numericAmount < 0) {
      setError('금액을 확인해 주세요.');
      return;
    }
    if (note.length > 500) {
      setError('메모는 500자 이내로 입력해 주세요.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await onSave({
        ...(entry?.id ? { id: entry.id } : {}),
        member_id: Number(memberId),
        amount: numericAmount,
        date,
        note: note.trim(),
      });
      onClose();
    } catch (saveError) {
      setError(`저장하지 못했어요. ${saveError.message || ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (isSaving || !entry?.id) return;
    setError('');
    setIsSaving(true);
    try {
      await onDelete(entry.id);
      onClose();
    } catch (deleteError) {
      setError(`삭제하지 못했어요. ${deleteError.message || ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <form className="modal-card settlement-editor settlement-popup" style={style} onSubmit={submit}>
        <header className="settlement-editor-header modal-header" {...dragHandleProps}>
          <h3>{entry ? '정산 내역 수정' : '정산 내역 추가'}</h3>
          <button type="button" className="close-button" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <p className="settlement-editor-date">{date}</p>
        <label>
          회원
          <select className="member-select" value={memberId} onChange={(event) => setMemberId(event.target.value)} required>
            <option value="">회원을 선택해 주세요</option>
            {members.filter((member) => member.role !== '관리자' && member.name !== '관리자').map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>
        <label>
          금액
          <div className="settlement-editor-amount">
            <input
              type="text"
              className="number-input"
              inputMode="numeric"
              value={amount ? Number(amount).toLocaleString('ko-KR') : ''}
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
              placeholder="금액 입력 (비우면 0원)"
            />
            <span>원</span>
          </div>
        </label>
        <label>
          메모
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="선택 입력" />
        </label>
        {error && <p className="settlement-editor-error" role="alert">{error}</p>}
        <footer className="settlement-editor-actions">
          {entry && <button type="button" className="delete-button" onClick={remove} disabled={isSaving}>삭제</button>}
          <button type="button" className="cancel-button" onClick={onClose} disabled={isSaving}>취소</button>
          <button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? '저장 중…' : '저장'}</button>
        </footer>
      </form>
    </Backdrop>
  );
}

export function SettlementSection({ members, settlements, selectedMonth, onMoveMonth, onSave, onDelete }) {
  const [view, setView] = useState('calendar');
  const [editor, setEditor] = useState(null);
  const [memberFilter, setMemberFilter] = useState('all');
  const monthEntries = (settlements || [])
    .filter((item) => String(item.date || '').startsWith(selectedMonth))
    .sort((a, b) => a.date.localeCompare(b.date)
      || a.name.localeCompare(b.name, 'ko')
      || Number(a.amount) - Number(b.amount)
      || String(a.note || '').localeCompare(String(b.note || ''), 'ko'));
  const entries = memberFilter === 'all'
    ? monthEntries
    : monthEntries.filter((item) => String(item.member_id) === memberFilter);
  const total = monthEntries.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const people = (members || []).filter((member) => member.role !== '관리자' && member.name !== '관리자');
  const [year, monthNumber] = selectedMonth.split('-').map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((firstDay.getDay() + dayCount) / 7) * 7 },
    (_, index) => new Date(year, monthNumber - 1, index - firstDay.getDay() + 1)
  );
  const visibleEntries = entries.filter((entry) => entry.type !== '월레슨비');

  const openNewEntry = (date) => setEditor({ date, entry: null });
  const openEntry = (entry) => setEditor({ date: entry.date, entry });

  return (
    <section className="admin-section settlement-section">
      <div className="schedule-controls">
        <select
          className="schedule-member-filter"
          value={memberFilter}
          onChange={(event) => setMemberFilter(event.target.value)}
          aria-label="정산 회원 필터"
        >
          <option value="all">전체 회원</option>
          {people.map((member) => <option key={member.id} value={String(member.id)}>{member.name}</option>)}
        </select>
        <div className="month-switcher">
          <button type="button" aria-label="이전 달" onClick={() => onMoveMonth(-1)}>‹</button>
          <strong>{year}년 {monthNumber}월</strong>
          <button type="button" aria-label="다음 달" onClick={() => onMoveMonth(1)}>›</button>
        </div>
        <select className="schedule-view-select" value={view} onChange={(event) => setView(event.target.value)}>
          <option value="calendar">달력 보기</option>
          <option value="list">리스트 보기</option>
        </select>
      </div>
      {view === 'calendar' ? (
        <div className="admin-calendar">
          <div className="calendar-weekdays">{weekDays.map((day) => <b key={day}>{day}</b>)}</div>
          <div className="calendar-grid">
            {cells.map((date) => {
              const fullDate = toDateString(date);
              const outside = date.getMonth() !== monthNumber - 1;
              const dayEntries = visibleEntries.filter((entry) => entry.date === fullDate);
              const archivedRows = entries.filter((entry) => entry.date === fullDate && entry.type === '월레슨비');
              const cellEntryCount = dayEntries.length + archivedRows.length;
              const dayTotal = dayEntries.concat(archivedRows).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
              return (
                <button
                  type="button"
                  className={`admin-calendar-day ${outside ? 'outside' : ''}`}
                  key={fullDate}
                  onClick={() => { if (!outside) openNewEntry(fullDate); }}
                >
                  <strong>{date.getDate()}</strong>
                  {cellEntryCount > 0 && <span>{cellEntryCount}건 · {formatWon(dayTotal)}</span>}
                  {dayEntries.map((entry) => (
                    <span key={entry.id}>{entry.name} {formatWon(entry.amount)}</span>
                  ))}
                  {archivedRows.map((entry) => (
                    <span key={entry.id}>{entry.name} · 월 레슨비 {formatWon(entry.amount)}</span>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="settlement-list-wrap">
          {entries.length ? (
            <table className="settlement-list-table">
              <thead><tr><th>일자</th><th>회원명</th><th>정산 금액</th><th>비고</th></tr></thead>
              <tbody>
                {entries.map((entry) => {
                  const editable = entry.type === '일별정산';
                  return (
                    <tr
                      key={entry.id}
                      className={editable ? 'editable' : 'read-only'}
                      onClick={() => { if (editable) openEntry(entry); }}
                      onKeyDown={(event) => {
                        if (editable && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          openEntry(entry);
                        }
                      }}
                      tabIndex={editable ? 0 : undefined}
                    >
                      <td>{entry.date}</td>
                      <td>{entry.name}</td>
                      <td>{formatWon(entry.amount)}</td>
                      <td>{entry.note || (entry.type === '월레슨비' ? '기존 월 레슨비' : entry.type || '')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="empty-lessons">{year}년 {monthNumber}월에 등록된 정산 내역이 없습니다.</p>}
        </div>
      )}
      <div className="settlement-month-total">
        <span>합계</span>
        <b>{formatWon(total)}</b>
      </div>

      {editor && (
        <SettlementEditor
          key={editor.entry?.id || editor.date}
          members={people}
          date={editor.date}
          entry={editor.entry}
          onClose={() => setEditor(null)}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}
