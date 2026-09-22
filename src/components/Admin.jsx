import { useState, useRef } from 'react';
import { useAdminData } from '../hooks/useAdminData';
import { PageTitle, Summary } from './common';
import { CsvTools } from './CsvTools';
import { ArchiveViewer } from './ArchiveViewer';
import { MemberDetail } from './member/MemberDetail';
import { MemberRegister } from './member/MemberRegister';
import { ReregisterModal } from './member/ReregisterModal';
import { MemberTable } from './member/MemberTable';
import { ScheduleSection } from './schedule/ScheduleSection';
import { LessonListModal } from './schedule/LessonListModal';
import { LessonEditor } from './schedule/LessonEditor';

// 1. 관리자 비밀번호 확인 및 완료 모달 컴포넌트 (Admin 내부에 포함)
// 1. 관리자 비밀번호 확인 및 완료 모달 컴포넌트
function AdminClearConfirmModal({ members = [], onConfirm, onCancel }) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDone, setIsDone] = useState(false); // 초기화 완료 상태

  const handleClearConfirm = () => {
    // 1. members 배열에서 관리자 계정 찾기
    const adminMember = members.find(m => m.role === '관리자' || m.name === '관리자');
    let validPassword = '0104201234'; // 기본 백업용

    if (adminMember) {
      const birthPart = String(adminMember.birth || '').replace(/\D/g, '').slice(0, 6);
      const phonePart = String(adminMember.phone || '').replace(/\D/g, '').slice(-4);
      if (birthPart && phonePart) {
        validPassword = `${birthPart}${phonePart}`;
      }
    }

    // 2. 비밀번호 검증
    if (password !== validPassword) {
      setErrorMsg('관리자 비밀번호가 일치하지 않습니다.');
      return;
    }

    // 3. 검증 성공 시 초기화 실행 후 완료 화면으로 전환
    onConfirm();
    setIsDone(true);
  };

  return (
    <div className="modal-backdrop" onClick={!isDone ? onCancel : undefined}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        {!isDone ? (
          /* [단계 1] 기존 디자인의 비밀번호 입력 팝업 */
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
          /* [단계 2] 동일한 모달 틀 안에서 "초기화되었습니다." 안내로 전환 */
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

// 관리자 대시보드 메인 컴포넌트
export function Admin({ initialMembers, schedules, onSchedulesChange, passes, onPassesChange, apiRequest, sheetLoadError }) {
  const [activeTab, setActiveTab] = useState('schedule');
  const data = useAdminData({ initialMembers, schedules, onSchedulesChange, passes, onPassesChange, apiRequest });
  const { members, lessons, passList, selectedMonth, filteredLessons, monthLessons, stats } = data;

  return <div className="admin-dashboard">
    <PageTitle
      eyebrow=""
      title="관리자 코치님 반갑습니다."
      actions={activeTab === 'members'
        ? <CsvTools members={members} schedules={lessons} passes={passList} onImported={data.handleImported} onError={data.setSyncError} onArchiveExport={data.runArchiveExport} onArchiveView={() => data.setIsArchiveOpen(true)} onClearData={() => data.setIsClearConfirm(true)} />
        : null} />

    {sheetLoadError && <div className="sheet-warning" role="alert">저장된 자료를 불러오지 못했어요. {sheetLoadError}</div>}
    {data.syncError && <div className="sheet-warning" role="alert">{data.syncError}</div>}

    <div className="admin-summary">
      <Summary icon="♙" label="총 회원 수" value={`${members.filter(m => m.role !== '관리자').length}명`} />
      <Summary icon="▦" label={`${stats.label} 레슨 횟수(완료/전체)`} value={`${stats.lessonCountText}`} />
      <Summary icon="✣" label={`${stats.label} 레슨 회원수`} value={`${stats.memberCount}명`} />
    </div>

    <nav className="admin-tabs" aria-label="관리자 메뉴">
      <button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}>▦ <span>스케줄표</span></button>
      <button className={activeTab === 'members' ? 'active' : ''} onClick={() => setActiveTab('members')}>♙ <span>회원정보</span></button>
    </nav>

    {activeTab === 'members'
      ? <MemberTable
        members={members}
        memberPassSummary={data.memberPassSummary}
        onOpenMember={data.setSelectedMember}
        onOpenRegister={() => data.setIsRegisterOpen(true)}
        onReregister={data.setReregisterMember} />
      : <ScheduleSection
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
        memberPassSummary={data.memberPassSummary} />}

    {data.selectedMember && <MemberDetail member={data.selectedMember} passes={passList.filter((pass) => pass.name === data.selectedMember.name)} onSave={data.updateMember} onDelete={data.deleteMember} onAddPass={data.addPass} onDeletePass={data.removePass} onClose={() => data.setSelectedMember(null)} />}
    {data.isRegisterOpen && <MemberRegister onSave={data.registerMember} onClose={() => data.setIsRegisterOpen(false)} />}
    {data.selectedDate && <LessonListModal date={data.selectedDate} lessons={lessons.filter((lesson) => lesson.date === data.selectedDate)} members={members} canSchedule={data.canSchedule} onClose={() => data.setSelectedDate(null)} onCreate={data.saveSchedule} onEdit={(lesson) => { data.setSelectedDate(null); data.setEditingLesson(lesson); }} onDelete={data.deleteSchedule} />}
    {data.editingLesson && <LessonEditor lesson={data.editingLesson} members={members} lessons={lessons} passSummaryOf={data.memberPassSummary} onClose={() => data.setEditingLesson(null)} onSave={data.saveSchedule} onDelete={data.deleteSchedule} />}
    {data.reregisterMember && <ReregisterModal member={data.reregisterMember} onClose={() => data.setReregisterMember(null)} onSubmit={data.submitReregister} />}

    {data.isArchiveOpen && <ArchiveViewer onClose={() => data.setIsArchiveOpen(false)} />}
    {data.archiveTarget && <div className="modal-backdrop"><div className="confirm-modal"><h3>목록에서 지울까요?</h3><p>{data.archiveTarget.year}년 지난 일정 {data.archiveTarget.count}개를 방금 파일로 저장했어요. 이 일정들을 지금 목록에서 지울까요? (지워도 저장한 파일에서 다시 볼 수 있어요.)</p><div className="modal-actions"><button className="cancel-button" onClick={() => data.setArchiveTarget(null)}>그냥 두기</button><button className="delete-button" onClick={data.confirmArchiveRemoval}>목록에서 지우기</button></div></div></div>}
    {data.toast && <div className="app-toast" role="status" onClick={() => data.setToast('')}>{data.toast}</div>}
  </div>;
}