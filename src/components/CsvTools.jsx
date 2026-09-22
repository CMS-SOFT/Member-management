import React, { useState, useRef } from 'react';
import {
  schedulesToCsv, csvToSchedules,
  membersToCsv, csvToMembers,
  passesToCsv, csvToPasses,
  scheduleTemplateCsv, memberTemplateCsv, passTemplateCsv,
  downloadCsv,
} from '../lib/csv';
import {
  requestBootstrap,
  replaceAllSchedules, replaceAllMembers, replaceAllPasses,
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
              관리자 계정을 제외한 모든 회원, 스케줄, 이용권 데이터가 안전하게 지워졌습니다.
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

// 2. 메인 자료 관리 도구 컴포넌트
export function CsvTools({ members, schedules, passes, onImported, onError, onArchiveExport, onArchiveView, onClearData }) {
  const [open, setOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const scheduleInput = useRef(null);
  const memberInput = useRef(null);
  const passInput = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  const importFile = async (event, parse, replace) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      let parsed = [];
      const fileName = file.name.toLowerCase();

      // 엑셀 파일(.xlsx, .xls)인 경우 처리
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // xlsx 라이브러리를 동적으로 불러옵니다 (설치되어 있어야 합니다)
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        // 첫 번째 시트 이름을 가져옵니다
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 엑셀 시트 데이터를 CSV 문자열 형태로 변환하여 기존 parse 함수에 태웁니다
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        parsed = parse(csvText);
      } else {
        // 기존 CSV 파일 처리 방식
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder('euc-kr');
        const text = decoder.decode(buffer);
        parsed = parse(text);
      }

      if (!parsed.length) throw new Error('파일에서 불러올 내용을 찾지 못했어요.');
      await replace(parsed);
      const fresh = await requestBootstrap();
      onImported(fresh);
    } catch (error) {
      console.error("업로드 에러 발생:", error);
      onError?.(`파일 불러오기에 실패했어요. ${error.message || ''}`);
    }
  };

  return (
    <div className="csv-tools">
      <button className="csv-button" onClick={() => setOpen((value) => !value)}>자료 관리 ▾</button>
      {open && (
        <div className="csv-menu" onMouseLeave={() => setOpen(false)}>
          <div className="csv-menu-row">
            <b>스케줄</b>
            <button onClick={() => downloadCsv(`스케줄-${today}.csv`, schedulesToCsv(schedules))}>내려받기</button>
            <button onClick={() => scheduleInput.current?.click()}>불러오기</button>
            <button onClick={() => downloadCsv('스케줄-빈양식.csv', scheduleTemplateCsv())}>빈 양식</button>
          </div>
          <div className="csv-menu-row">
            <b>이용권</b>
            <button onClick={() => downloadCsv(`이용권-${today}.csv`, passesToCsv(passes))}>내려받기</button>
            <button onClick={() => passInput.current?.click()}>불러오기</button>
            <button onClick={() => downloadCsv('이용권-빈양식.csv', passTemplateCsv())}>빈 양식</button>
          </div>
          <div className="csv-menu-row">
            <b>회원</b>
            <button onClick={() => downloadCsv(`회원-${today}.csv`, membersToCsv(members))}>내려받기</button>
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
        ref={scheduleInput}
        type="file"
        accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        hidden
        onChange={(event) => importFile(event, csvToSchedules, replaceAllSchedules)}
      />
      <input
        ref={memberInput}
        type="file"
        accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
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
              // 1. 관리자 계정은 보존하고 일반 회원만 골라내거나 비우기
              // members 배열에서 'role'이 '관리자'이거나 이름이 '관리자'인 계정만 필터링합니다.
              const adminMembers = (members || []).filter(m => m.role === '관리자' || m.name === '관리자');

              if (typeof replaceAllSchedules === 'function') await replaceAllSchedules([]);
              if (typeof replaceAllPasses === 'function') await replaceAllPasses([]);
              if (typeof replaceAllMembers === 'function') await replaceAllMembers(adminMembers); // 관리자만 남김

              if (typeof onClearData === 'function') {
                await onClearData();
              }

              // 최신 데이터를 다시 불러와서 화면에 반영 (로그인 튕김 방지)
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