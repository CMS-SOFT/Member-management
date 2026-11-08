import { useState, useRef } from 'react';

export function Login({ onLogin, error, loadError, onDismiss, isLoading }) {
  const [password, setPassword] = useState('');
  const inputRef = useRef(null);
  const displayError = loadError || error;

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !isLoading) {
      if (event.nativeEvent.isComposing) return; // 한글 입력 조합 중복 실행 방지
      onLogin(password);
    }
  };

  const handleLoginClick = () => {
    onLogin(password);
  };

  const handleDismiss = () => {
    onDismiss();
    // 확인 버튼 눌러서 팝업 닫히면 바로 비밀번호 창으로 커서 이동
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">court mate</h1>

        <div className="input-group">
          <label>비밀번호</label>
          <input
            ref={inputRef}
            className="password-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="생년월일(yymmdd) + 전화번호 끝 4자리"
            autoFocus
          />
        </div>

        <button
          type="button"
          className="login-submit-btn"
          disabled={isLoading}
          onClick={handleLoginClick}
        >
          {isLoading ? '회원정보 확인 중...' : '로그인'}
        </button>
      </div>

      {displayError && (
        <div className="modal-backdrop">
          <div className="confirm-modal login-error-modal">
            <h3 style={{ fontSize: '15px' }}>
              {loadError
                ? '회원정보를 불러오지 못했습니다.'
                : error === '회원정보를 불러오는 중입니다. 잠시 후 다시 눌러주세요.'
                  ? error
                  : '회원정보가 없습니다.'}
            </h3>
            <button type="button" className="primary-button" onClick={handleDismiss}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
