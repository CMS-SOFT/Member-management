import React, { useState, useRef } from 'react';
import {
  membersToCsv, csvToMembers,
  passesToCsv, csvToPasses,
  memberTemplateCsv, passTemplateCsv,
  downloadCsv,
} from '../lib/csv';
import {
  requestBootstrap,
  replaceAllMembers, replaceAllPasses,
  // SQLite3에서 전체 데이터를 가져오는 함수가 있다면 여기서 임포트합니다.
} from '../lib/db';

// 1. 관리자 비밀번호 확인 및 완료 모달 컴포넌트
function ClearConfirmModal({ members = [], onConfirm, onCancel }) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDone, setIsDone] = useState(false);

  const handleClearConfirm = () => {
    const adminMember = members.find(m => m.role === '관리자' || m.name === '관리자');
    let validPassword = '0104201234';

    if (adminMember) {
      const birthPart = String(adminMember.birth || '').replace(/\D/g, '').slice(0, 6);
      const phonePart = String(adminMember.phone || '').replace(/\D/g, '').slice(-4);
      if (birthPart && phonePart) {
        validPassword = `${birthPart}${phonePart}`;
      }
    }

    if (password !== validPassword) {
      setErrorMsg('관리자 비밀번호가 일치하지 않습니다.');
      return;
    }

    onConfirm();
    setIsDone(true);
  };

  return (
    <div className="detail-confirm" onClick={!isDone ? onCancel : undefined}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        {!isDone ? (
          <>
            <h3>모든 자료를 지울까요?</h3>
            <p>
              회원·스케줄·이용권이 전부 지워져요. (관리자 계정은 그대로 있고, 한 번 지우면 되돌릴 수 없어요.)
              걱정되면 먼저 '자료 관리 → 내려받기'로 파일에 저장해 두세요.
            </p>

            <div style={{ margin: '15px 0 5px 0' }}>
              <input
                type="password"
                placeholder="관리자 비밀번호 입력 (생년월일 + 전화번호 뒷 4자리)"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  fontSize: '12px'
                }}
              />
              {errorMsg && (
                <p style={{ color: 'red', fontSize: '12px', marginTop: '5px', textAlign: 'left' }}>
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="cancel-button" onClick={onCancel} style={{ flex: 1 }}>그만두기</button>
              <button className="delete-button" onClick={handleClearConfirm} style={{ flex: 1 }}>모두 지우기</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '15px 0' }}>
            <h3 style={{ marginBottom: '15px' }}>초기화되었습니다.</h3>
            <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>
              모든 데이터가 지워졌습니다.
            </p>
            <div className="modal-actions" style={{ display: 'flex', gap: '10px' }}>
              <button
                className="primary-button"
                onClick={onCancel}
                style={{ width: '100%', padding: '10px', background: '#800020', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 2. 메인 자료 관리 도구 컴포넌트 (스케줄 관련 항목 제외)
export function CsvTools({ members, passes, onImported, onError, onArchiveExport, onArchiveView, onClearData }) {
  const [open, setOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const memberInput = useRef(null);
  const passInput = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  // 파일 업로드 (가져오기) 처리
  const importFile = async (event, parse, replace) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      let parsed = [];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        parsed = parse(csvText);
      } else {
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder('euc-kr');
        const text = decoder.decode(buffer);
        parsed = parse(text);
      }

      const hasContent = Array.isArray(parsed)
        ? parsed.length > 0
        : (parsed && Object.keys(parsed).length > 0);

      if (!hasContent) throw new Error('파일에서 불러올 내용을 찾지 못했어요.');

      if (!parsed.length) throw new Error('파일에서 불러올 내용을 찾지 못했어요.');
      console.log('replace에 전달되는 데이터:', parsed);
      await replace(parsed);
      const fresh = await requestBootstrap();
      onImported(fresh);
    } catch (error) {
      console.error("업로드 에러 발생:", error);
      onError?.(`파일 불러오기에 실패했어요. ${error.message || ''}`);
    }
  };

  // SQLite DB 기반 최신 데이터를 반영하여 내려받기 실행
  const handleDownload = async (type) => {
    try {
      const currentData = await requestBootstrap();

      if (type === 'pass') {
        const dataToExport = currentData?.passes || passes;
        downloadCsv(`이용권-${today}.csv`, passesToCsv(dataToExport));
      } else if (type === 'member') {
        const dataToExport = currentData?.members || members;
        downloadCsv(`회원-${today}.csv`, membersToCsv(dataToExport));
      }
    } catch (err) {
      console.error("내려받기 중 오류 발생:", err);
      downloadCsv(
        `${type === 'pass' ? '이용권' : '회원'}-${today}.csv`,
        type === 'pass' ? passesToCsv(passes) : membersToCsv(members)
      );
    }
  };

  return (
    <div className="csv-tools">
      <button className="csv-button" onClick={() => setOpen((value) => !value)}>자료 관리 ▾</button>
      {open && (
        <div className="csv-menu" onMouseLeave={() => setOpen(false)}>
          <div className="csv-menu-row">
            <b>이용권</b>
            <button onClick={() => handleDownload('pass')}>내려받기</button>
            <button onClick={() => passInput.current?.click()}>불러오기</button>
            <button onClick={() => downloadCsv('이용권-빈양식.csv', passTemplateCsv())}>빈 양식</button>
          </div>
          <div className="csv-menu-row">
            <b>회원</b>
            <button onClick={() => handleDownload('member')}>내려받기</button>
            <button onClick={() => memberInput.current?.click()}>불러오기</button>
            <button onClick={() => downloadCsv('회원-빈양식.csv', memberTemplateCsv())}>빈 양식</button>
          </div>
          <div className="csv-menu-row csv-menu-row--archive">
            <b>지난 기록</b>
            <button onClick={() => { setOpen(false); onArchiveExport?.(); }}>보관하기</button>
            <button onClick={() => { setOpen(false); onArchiveView?.(); }}>다시 보기</button>
            <span />
          </div>
          <div className="csv-menu-row csv-menu-row--archive">
            <b>전체 지우기</b>
            <button className="csv-danger" onClick={() => { setOpen(false); setIsClearConfirmOpen(true); }}>모두 지우기</button>
            <span /><span />
          </div>
        </div>
      )}
      <input
        ref={memberInput}
        type="file"
        accept=".csv, .xls, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        hidden
        onChange={(event) => importFile(event, csvToMembers, replaceAllMembers)}
      />
      <input
        ref={passInput}
        type="file"
        accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        hidden
        onChange={(event) => importFile(event, csvToPasses, replaceAllPasses)}
      />
      {isClearConfirmOpen && (
        <ClearConfirmModal
          members={members}
          onConfirm={async () => {
            try {
              const adminMembers = (members || []).filter(m => m.role === '관리자' || m.name === '관리자');

              if (typeof replaceAllPasses === 'function') await replaceAllPasses([]);
              if (typeof replaceAllMembers === 'function') await replaceAllMembers(adminMembers);

              if (typeof onClearData === 'function') {
                await onClearData();
              }

              const fresh = await requestBootstrap();
              if (typeof onImported === 'function') {
                onImported(fresh);
              }
            } catch (err) {
              console.error("데이터 초기화 중 에러 발생:", err);
            }
          }}
          onCancel={() => setIsClearConfirmOpen(false)}
        />
      )}
    </div>
  );
}