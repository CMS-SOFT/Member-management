import { useState } from 'react';
import './App.css';
import { birthCode } from './lib/sheet';
import { callApi } from './lib/bootstrapService';
import { useAppData } from './hooks/useAppData';
import { Login } from './components/Login';
import { Admin } from './components/Admin';
import { UserManual } from './components/UserManual';

function App() {
  const [screen, setScreen] = useState('login');
  const [loginError, setLoginError] = useState('');
  const [isManualOpen, setIsManualOpen] = useState(false);

  const {
    directoryMembers,
    adminMembers,
    adminSchedules,
    setAdminSchedules,
    adminPasses,
    setAdminPasses,
    adminSettlements,
    setAdminSettlements,
    isLoading,
    setIsLoading,
    loadError,
    setLoadError,
    refreshAppData,
  } = useAppData();

  const goHome = async () => {
    setIsLoading(true);
    try {
      await refreshAppData();
    } finally {
      setIsLoading(false);
      setScreen('login');
      setLoginError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // court mate 브랜드 버튼 — 스크롤 상단으로
  const goTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = (password = '') => {
    if (isLoading) {
      setLoginError('회원정보를 불러오는 중입니다. 잠시 후 다시 눌러주세요.');
      return;
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      setLoginError('회원정보가 없습니다.');
      return;
    }

    const normalizedPassword = password.replace(/\D/g, '');

    if (!directoryMembers || directoryMembers.length === 0) {
      setLoginError('회원정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    const member = directoryMembers.find((item) => {
      if (!item) return false;
      const bCode = birthCode(item.birth || '');
      const phoneTail = String(item.phone || '').replace(/\D/g, '').slice(-4);
      return `${bCode}${phoneTail}` === normalizedPassword;
    });

    if (!member) {
      setLoginError('회원정보가 없습니다.');
      return;
    }
    if (member.role !== '관리자') {
      setLoginError('관리자 계정만 이용할 수 있습니다.');
      return;
    }

    setLoginError('');
    setScreen('admin');
  };

  return (
    <div className="app-shell">
      <div className="app-window">
        <header className="app-header">
          <button className="brand-btn" onClick={goTop}>
            <span className="brand-mark">✦</span>
            <span>court mate</span>
          </button>
          <div className="app-header-actions">
            <button className="manual-btn" onClick={() => setIsManualOpen(true)}>사용설명서</button>
            <button className="home-btn" onClick={goHome}>홈으로</button>
          </div>
        </header>

        <main className="app-content">
          {screen === 'login' ? (
            <Login
              onLogin={handleLogin}
              error={loginError}
              loadError={loadError && !directoryMembers.length ? loadError : ''}
              onDismiss={() => { setLoginError(''); setLoadError(''); }}
              isLoading={isLoading}
            />
          ) : (
            <Admin
              initialMembers={adminMembers}
              schedules={adminSchedules}
              onSchedulesChange={setAdminSchedules}
              passes={adminPasses}
              onPassesChange={setAdminPasses}
              settlements={adminSettlements}
              onSettlementsChange={setAdminSettlements}
              apiRequest={callApi}
              sheetLoadError={loadError}
            />
          )}
        </main>

        <footer className="app-footer">Tennis attendance desk</footer>
        {isManualOpen && <UserManual onClose={() => setIsManualOpen(false)} />}
      </div>
    </div>
  );
}

export default App;
