import { useState, useRef, useEffect } from 'react';
import { useAdminData } from '../hooks/useAdminData';
import { PageTitle, Summary } from './common';
import { ArchiveViewer } from './ArchiveViewer';
import { MemberDetail } from './member/MemberDetail';
import { MemberRegister } from './member/MemberRegister';
import { ReregisterModal } from "./member/ReregisterModal";
import { MemberTable } from './member/MemberTable';
import { ScheduleSection } from './schedule/ScheduleSection';
import { LessonListModal } from './schedule/LessonListModal';
import { LessonEditor } from './schedule/LessonEditor';
import {
  passesToCsv, membersToCsv,
  downloadCsv, parsePassesCsv, parseMembersCsv
} from '../lib/csv';

// 관리자 비밀번호 확인 및 초기화 완료 모달
function AdminClearConfirmModal({ members = [], onConfirm, onCancel }) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  const handleVerifyPassword = () => {
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

    setIsPasswordVerified(true);
  };

  const handleFinalConfirm = () => {
    onConfirm();
    onCancel();
  };

  return (
    <div className="modal-backdrop" onClick={!isPasswordVerified ? onCancel : undefined}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        {!isPasswordVerified ? (
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
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', fontSize: '12px' }}
              />
              {errorMsg && <p style={{ color: 'red', fontSize: '12px', marginTop: '5px', textAlign: 'left' }}>{errorMsg}</p>}
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="cancel-button" onClick={onCancel} style={{ flex: 1 }}>그만두기</button>
              <button className="delete-button" onClick={handleVerifyPassword} style={{ flex: 1 }}>모두 지우기</button>
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
                onClick={handleFinalConfirm}
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

// 통합된 자료 관리 드롭다운 컴포넌트 (스케줄 CSV 관련 항목만 제외)
function IntegratedCsvTools({ passes, members, onImported, onError, onArchiveExport, onArchiveView, onClearData, apiRequest }) {
  const [isOpen, setIsOpen] = useState(false);
  const [importingType, setImportingType] = useState(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const importTypeRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (importingType) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [importingType]);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (importingType) {
        setTimeout(() => {
          setImportingType(null);
        }, 300);
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [importingType]);

  const handleExport = (type) => {
    try {
      if (type === 'pass') {
        const csv = passesToCsv(passes);
        downloadCsv(csv, `passes_${new Date().toISOString().slice(0, 10)}.csv`);
      } else if (type === 'member') {
        const csv = membersToCsv(members);
        downloadCsv(csv, `members_${new Date().toISOString().slice(0, 10)}.csv`);
      }
      setIsOpen(false);
    } catch (err) {
      onError?.(`내려받기 실패: ${err.message}`);
    }
  };

  const handleTemplate = (type) => {
    try {
      let csv = '';
      if (type === 'pass') {
        csv = 'name,total,used,remaining,status,registeredAt\n홍길동,12,0,12,이용중,2026-09-01';
      } else if (type === 'member') {
        csv = 'name,phone,birth,gender,role\n홍길동,010-1234-5678,900101,여,회원';
      }
      downloadCsv(csv, `${type}_template.csv`);
      setIsOpen(false);
    } catch (err) {
      onError?.(`양식 다운로드 실패: ${err.message}`);
    }
  };

  const triggerImport = (type) => {
    importTypeRef.current = type;
    setImportingType(type);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    const type = importTypeRef.current;

    if (!file) {
      setImportingType(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        let parsedData = [];

        if (type === 'pass') {
          parsedData = parsePassesCsv(text);
        } else if (type === 'member') {
          parsedData = parseMembersCsv(text);
        }

        if (apiRequest) {
          const listToSave = parsedData.passes || parsedData.members || parsedData;

          if (type === 'pass') {
            for (let i = 0; i < listToSave.length; i++) {
              await apiRequest({ action: 'appendPass', pass: listToSave[i] });
            }
          } else if (type === 'member') {
            for (let i = 0; i < listToSave.length; i++) {
              await apiRequest({ action: 'appendMember', member: listToSave[i] });
            }
          }
        }

        if (onImported) {
          await onImported(type, parsedData);
        }
      } catch (err) {
        onError?.(`파일을 읽지 못했어요: ${err.message}`);
      } finally {
        setImportingType(null);
        setIsOpen(false);
      }
    };

    reader.readAsText(file, 'utf-8');
  };

  const dropdownBtnStyle = {
    backgroundColor: '#fff',
    border: '1px solid #dcdcdc',
    borderRadius: '3px',
    padding: '4px 8px',
    fontSize: '11px',
    fontFamily: 'inherit',
    fontWeight: 'normal',
    cursor: 'pointer',
    color: '#333',
    outline: 'none'
  };

  const getImportBtnStyle = (type) => ({
    ...dropdownBtnStyle,
    backgroundColor: importingType === type ? '#dcdcdc' : '#fff',
    fontWeight: importingType === type ? 'bold' : 'normal',
  });

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".csv, application/vnd.ms-excel, text/csv"
        onChange={handleFileChange}
      />

      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: '#fff',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: '600',
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#333'
        }}
      >
        자료 관리 <span style={{ fontSize: '9px' }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '115%',
          width: '320px',
          backgroundColor: '#fff',
          border: '1px solid #ddd',
          borderRadius: '6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          padding: '16px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          textAlign: 'left'
        }}>
          {/* 이용권 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--wine)' }}>이용권</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => handleExport('pass')} style={dropdownBtnStyle}>내려받기</button>
              <button onClick={() => triggerImport('pass')} style={getImportBtnStyle('pass')}>불러오기</button>
              <button onClick={() => handleTemplate('pass')} style={dropdownBtnStyle}>빈 양식</button>
            </div>
          </div>

          {/* 회원 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--wine)' }}>회원</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => handleExport('member')} style={dropdownBtnStyle}>내려받기</button>
              <button onClick={() => triggerImport('member')} style={getImportBtnStyle('member')}>불러오기</button>
              <button onClick={() => handleTemplate('member')} style={dropdownBtnStyle}>빈 양식</button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '2px 0' }} />

          {/* 지난 기록 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>지난 기록</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => { onArchiveExport?.(); setIsOpen(false); }} style={dropdownBtnStyle}>보관하기</button>
              <button onClick={() => { onArchiveView?.(); setIsOpen(false); }} style={dropdownBtnStyle}>다시 보기</button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '2px 0' }} />

          {/* 전체 지우기 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d9534f' }}>전체 지우기</span>
            <button onClick={() => { onClearData?.(); setIsOpen(false); }} style={{ ...dropdownBtnStyle, color: '#d9534f', borderColor: '#d9534f' }}>
              모두 지우기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 관리자 대시보드 메인 컴포넌트
export function Admin({ initialMembers, schedules, onSchedulesChange, passes, onPassesChange, apiRequest, sheetLoadError }) {
  const [activeTab, setActiveTab] = useState('schedule');
  const [centerAlert, setCenterAlert] = useState(''); // 화면 중앙 팝업 상태 추가
  const data = useAdminData({ initialMembers, schedules, onSchedulesChange, passes, onPassesChange, apiRequest });
  const { members, lessons, passList, selectedMonth, filteredLessons, monthLessons, stats } = data;

  return (
    <div className="admin-dashboard">
      <PageTitle
        eyebrow=""
        title="관리자 코치님 반갑습니다."
        actions={
          <IntegratedCsvTools
            passes={passList}
            members={members}
            onImported={data.handleImported}
            onError={data.setSyncError}
            onArchiveExport={data.runArchiveExport}
            onArchiveView={() => data.setIsArchiveOpen(true)}
            onClearData={() => data.setIsClearConfirm(true)}
            apiRequest={apiRequest}
          />
        }
      />

      {sheetLoadError && <div className="sheet-warning" role="alert">저장된 자료를 불러오지 못했어요. {sheetLoadError}</div>}
      {data.syncError && <div className="sheet-warning" role="alert">{data.syncError}</div>}

      <div className="admin-summary">
        <Summary icon="♙" label="총 회원 수" value={`${members.filter(m => m.role !== '관리자').length}명`} />
        <Summary icon="▦" label={`${stats.label} 레슨 횟수(완료/전체)`} value={`${stats.lessonCountText}`} />
        <Summary icon="✣" label={`${stats.label} 레슨 회원수`} value={`${stats.memberCount}명`} />
      </div>

      <nav className="admin-tabs" aria-label="관리자 메뉴" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* 좌측 탭 메뉴 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}>
            ▦ <span>스케줄표</span>
          </button>
          <button className={activeTab === 'members' ? 'active' : ''} onClick={() => setActiveTab('members')}>
            ♙ <span>회원정보</span>
          </button>
        </div>

        {/* 우측에 항상 고정될 회원 등록 버튼 */}
        <button className="add-button" onClick={() => data.setIsRegisterOpen(true)}>
          <span>＋ 회원등록</span>
        </button>
      </nav>

      {activeTab === 'members' ? (
        <MemberTable
          members={members}
          memberPassSummary={data.memberPassSummary}
          onOpenMember={data.setSelectedMember}
          onOpenRegister={() => data.setIsRegisterOpen(true)}
          onReregister={data.setReregisterMember}
        />
      ) : (
        <ScheduleSection
          members={members}
          filteredLessons={filteredLessons}
          monthLessons={monthLessons}
          selectedMonth={selectedMonth}
          scheduleFilter={data.scheduleFilter}
          onFilterChange={data.setScheduleFilter}
          scheduleView={data.scheduleView}
          onViewChange={data.setScheduleView}
          onMoveMonth={data.moveMonth}
          onSelectDate={(date) => { data.setEditingLesson(null); data.setSelectedDate(date); }}
          onSelectLesson={(lesson) => { data.setSelectedDate(null); data.setEditingLesson(lesson); }}
          onAddLesson={() => data.setEditingLesson({ date: `${selectedMonth}-01`, time: '10:30', name: data.scheduleFilter === '전체' ? '' : data.scheduleFilter, status: '예약', note: '' })}
          memberPassSummary={data.memberPassSummary}
        />
      )}

      {data.selectedMember && <MemberDetail member={data.selectedMember} passes={passList.filter((pass) => pass.name === data.selectedMember.name)} onSave={data.updateMember} onDelete={data.deleteMember} onAddPass={data.addPass} onDeletePass={data.removePass} onClose={() => data.setSelectedMember(null)} />}

      {/* 회원 등록 결과 메시지를 받아서 중앙 팝업으로 띄우고 완료 시 팝업 닫기 */}
      {data.isRegisterOpen && (
        <MemberRegister
          onSave={async (formData) => {
            try {
              // 1. 회원 등록 시도
              await data.registerMember(formData);

              // 2. 성공했을 때만 모달 닫기
              data.setIsRegisterOpen(false);
            } catch (error) {
              // 3. 실패(스케줄 충돌 등)했을 때는 모달을 닫지 않고 에러 메시지 팝업 띄우기
              setCenterAlert(error.message);
            }
          }}
          onClose={() => data.setIsRegisterOpen(false)}
        />
      )}

      {data.selectedDate && <LessonListModal date={data.selectedDate} lessons={lessons.filter((lesson) => lesson.date === data.selectedDate)} members={members} canSchedule={data.canSchedule} onClose={() => data.setSelectedDate(null)} onCreate={data.saveSchedule} onEdit={(lesson) => { data.setSelectedDate(null); data.setEditingLesson(lesson); }} onDelete={data.deleteSchedule} />}
      {data.editingLesson && <LessonEditor lesson={data.editingLesson} members={members} lessons={lessons} passSummaryOf={data.memberPassSummary} onClose={() => data.setEditingLesson(null)} onSave={data.saveSchedule} onDelete={data.deleteSchedule} />}
      {data.reregisterMember && <ReregisterModal member={data.reregisterMember} onClose={() => data.setReregisterMember(null)} onSubmit={data.submitReregister} />}

      {data.isClearConfirm && <AdminClearConfirmModal members={members} onConfirm={data.confirmClearData} onCancel={() => data.setIsClearConfirm(false)} />}
      {data.isArchiveOpen && <ArchiveViewer onClose={() => data.setIsArchiveOpen(false)} />}
      {data.archiveTarget && <div className="modal-backdrop"><div className="confirm-modal"><h3>목록에서 지울까요?</h3><p>{data.archiveTarget.year}년 지난 일정 {data.archiveTarget.count}개를 방금 파일로 저장했어요. 이 일정들을 지금 목록에서 지울까요? (지워도 저장한 파일에서 다시 볼 수 있어요.)</p><div className="modal-actions"><button className="cancel-button" onClick={() => data.setArchiveTarget(null)}>그냥 두기</button><button className="delete-button" onClick={data.confirmArchiveRemoval}>목록에서 지우기</button></div></div></div>}

      {/* 화면 중앙 모달 팝업 추가 */}
      {centerAlert && (
        <div className="modal-backdrop" onClick={() => setCenterAlert('')}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '15px' }}>{centerAlert}</h3>
            <div className="modal-actions" style={{ display: 'flex', gap: '10px' }}>
              <button
                className="primary-button"
                onClick={() => setCenterAlert('')}
                style={{ width: '100%', padding: '10px', background: '#800020', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}