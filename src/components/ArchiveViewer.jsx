import { useEffect, useRef, useState } from 'react';
import { requestServer } from '../lib/client';
import { useDraggable } from '../lib/useDraggable';
import { Backdrop } from './common';

const COLUMN_LABELS = {
  id: 'ID',
  member_id: '회원 ID',
  name: '이름',
  date: '날짜',
  time: '시간',
  amount: '금액',
  type: '구분',
  note: '비고',
  status: '상태',
  use_flag: '사용 여부',
  registeredAt: '등록일',
  createdAt: '생성일',
};

export function ArchiveViewer({ onClose }) {
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { dragHandleProps, style } = useDraggable();
  const requestId = useRef(0);

  useEffect(() => {
    let isCurrent = true;
    requestServer('/archives')
      .then(({ years: availableYears }) => {
        if (!isCurrent) return;
        const yearOptions = availableYears.map(String);
        setYears(yearOptions);
        if (yearOptions.length) setSelectedYear(yearOptions[0]);
      })
      .catch((caught) => {
        if (isCurrent) setError(caught.message || '아카이브 연도를 불러오지 못했어요.');
      });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    if (!selectedYear || !years.includes(selectedYear)) return undefined;
    const currentRequest = ++requestId.current;
    Promise.resolve()
      .then(() => {
        if (currentRequest !== requestId.current) return null;
        setIsLoading(true);
        setError('');
        return requestServer(`/archives?year=${encodeURIComponent(selectedYear)}`);
      })
      .then((result) => {
        if (result && currentRequest === requestId.current) setTables(result.tables);
      })
      .catch((caught) => {
        if (currentRequest === requestId.current) {
          setTables([]);
          setError(caught.message || '아카이브 자료를 불러오지 못했어요.');
        }
      })
      .finally(() => {
        if (currentRequest === requestId.current) setIsLoading(false);
      });
    return () => { requestId.current += 1; };
  }, [selectedYear, years]);

  const totalRows = tables.reduce((total, table) => total + table.rows.length, 0);

  return (
    <Backdrop onClose={onClose}>
      <div className="schedule-modal modal-card archive-modal archive-viewer" style={style}>
        <div className="modal-header modal-drag-handle" {...dragHandleProps}>
          <span className="eyebrow">과거 기록 보기 · 읽기 전용</span>
          <button className="modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <h3>과거 기록 보기</h3>
        <p className="archive-hint">
          아카이브 자료는 조회만 할 수 있으며 현재 자료를 변경하지 않습니다.
          회원 기본정보는 해당 회원의 마지막 활동 연도 자료와 함께 표시됩니다.
        </p>
        <div className="archive-actions">
          <label htmlFor="archive-year-select">연도</label>
          <select
            id="archive-year-select"
            className="archive-year-select"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            disabled={!years.length}
          >
            {years.map((year) => <option key={year} value={year}>{year}년</option>)}
          </select>
          <span className="archive-row-count">{totalRows}건</span>
        </div>
        {error && <p className="confirm-error" role="alert">{error}</p>}
        {isLoading && <p className="archive-empty">불러오는 중...</p>}
        {!isLoading && !error && totalRows === 0 && (
          <p className="archive-empty">{selectedYear}년 보관 자료가 없습니다.</p>
        )}
        {!isLoading && !error && tables.length > 0 && (
          <div className="archive-table-wrap">
            {tables.filter((table) => table.rows.length > 0).map((table) => (
              <section className="archive-table-section" key={table.name}>
                <h4>{table.label} ({table.rows.length}건)</h4>
                <table className="archive-table">
                  <thead>
                    <tr>
                      {table.columns.map((column) => (
                        <th key={column}>{COLUMN_LABELS[column] || column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, index) => (
                      <tr key={row.id || `${table.name}-${index}`}>
                        {table.columns.map((column) => <td key={column}>{row[column]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
      </div>
    </Backdrop>
  );
}
