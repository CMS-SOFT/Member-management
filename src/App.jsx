import { useEffect, useState } from 'react';
import './App.css';
import { mergeSheetMembers, birthCode, normalizeSchedules } from './lib/sheet';
import { requestBootstrap, callApi } from './lib/db';
import { Login } from './components/Login';
import { Admin } from './components/Admin';
import { UserManual } from './components/UserManual';

function App() {
  const [screen, setScreen] = useState('login');
  const [loginError, setLoginError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [adminMembers, setAdminMembers] = useState([]);
  const [adminHistories, setAdminHistories] = useState([]);
  const [adminSchedules, setAdminSchedules] = useState([]);
  const [adminPasses, setAdminPasses] = useState([]);
  const [directoryMembers, setDirectoryMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isManualOpen, setIsManualOpen] = useState(false);

  const goHome = async () => {
    setIsLoading(true);
    try {
      // [수정] 홈으로 돌아갈 때 IndexedDB에서 최신 데이터를 다시 불러옵니다.
      const result = await requestBootstrap();
      setDirectoryMembers(result.members || []);
      setAdminMembers(mergeSheetMembers(result.members || [], result.histories || []));
      setAdminHistories(result.histories || []);
      setAdminSchedules(normalizeSchedules(result.schedules || []));
      setAdminPasses(result.passes || []);
    } catch (error) {
      console.error('데이터를 불러오지 못했습니다:', error);
    } finally {
      setIsLoading(false);
      setScreen('login');
      setLoginError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    let active = true;
    requestBootstrap()
      .then((result) => {
        if (!active) return;
        setLoadError('');
        setDirectoryMembers(result.members || []);
        setAdminMembers(mergeSheetMembers(result.members || [], result.histories || []));
        setAdminHistories(result.histories || []);
        setAdminSchedules(normalizeSchedules(result.schedules || []));
        setAdminPasses(result.passes || []);
      })
      .catch((error) => {
        if (active) setLoadError(error.message || '저장된 자료를 불러오지 못했어요.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleLogin = (password = '') => {
    // [수정] 데이터 로딩 중일 때 처리 분기 추가
    if (isLoading) {
      setLoginError('회원정보를 불러오는 중입니다. 잠시 후 다시 눌러주세요.');
      return;
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      setLoginError('회원정보가 없습니다.');
      return;
    }

    const normalizedPassword = password.replace(/\D/g, '');

    // [수정] directoryMembers 데이터가 비어있을 때의 안전장치 추가
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
    <main className="app-shell">
      <section className="app-window">
        <header className="app-header">
          <button className="brand" onClick={goHome}>
            <span className="brand-mark">✦</span>
            <span>court mate</span>
          </button>
          <div className="app-header-actions">
            <button className="home-label" onClick={() => setIsManualOpen(true)}>사용설명서</button>
            <button className="home-label" onClick={goHome}>홈으로</button>
          </div>
        </header>
        <div className="app-content">
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
              key={`${adminMembers.length}-${adminHistories.length}`}
              initialMembers={adminMembers}
              schedules={adminSchedules}
              onSchedulesChange={setAdminSchedules}
              passes={adminPasses}
              onPassesChange={setAdminPasses}
              apiRequest={callApi}
              sheetLoadError={loadError}
            />
          )}
        </div>
        <footer className="app-footer">Tennis attendance desk</footer>
        {isManualOpen && <UserManual onClose={() => setIsManualOpen(false)} />}
      </section>
    </main>
  );
}

export default App;