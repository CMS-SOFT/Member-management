// src/components/ArchiveViewer.jsx
import { useRef, useState } from "react";
import { csvToSchedules } from "../lib/csv";
import { useDraggable } from "../lib/useDraggable";
import { Backdrop } from "./common";

export function ArchiveViewer({ onClose }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const { dragHandleProps, style } = useDraggable();

  const openFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const text = await file.text();
      const parsed = csvToSchedules(text).sort((a, b) =>
        `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)
      );
      if (!parsed.length)
        throw new Error("파일에서 볼 수 있는 일정을 찾지 못했어요.");
      setRows(parsed);
      setFileName(file.name);
    } catch (caught) {
      setError(caught?.message || "파일을 열지 못했어요.");
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="schedule-modal archive-viewer" style={style}>
        <div className="modal-drag-handle" {...dragHandleProps}>
          <span className="eyebrow">지난 기록 보기 · 보기만 할 수 있어요</span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <h3>지난 기록 다시 보기</h3>
        <p className="archive-hint">
          예전에 저장해 둔 일정 파일을 열어서 지난 일정을 확인할 수 있어요.
          <br />
          여기서는 <b>보기만</b> 할 수 있고, 지금 쓰고 있는 자료는 바뀌지 않아요.
        </p>
        <div className="archive-actions">
          <button className="square-button" onClick={() => fileInput.current?.click()}>
            파일 열기
          </button>
          {fileName && <span className="archive-filename">{fileName}</span>}
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={openFile}
          />
        </div>
        {error && <p className="confirm-error">{error}</p>}
        {rows && (
          <div className="archive-table-wrap">
            <table className="archive-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>시간</th>
                  <th>회원명</th>
                  <th>상태</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.date}-${row.time}-${index}`}>
                    <td>{row.date}</td>
                    <td>{row.time}</td>
                    <td>{row.name}</td>
                    <td>{row.status}</td>
                    <td>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Backdrop>
  );
}