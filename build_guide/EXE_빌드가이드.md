# Windows EXE 만들기 가이드 (court mate)

> ⚠️ 현재 상태: exe 빌드 자체는 되지만, **실행 시 CSS(스타일)가 적용 안 되는 문제 미해결**.
> 프로젝트 소스는 exe 작업 이전으로 원복해 둔 상태(웹/안드로이드는 정상).
> exe를 다시 하려면 아래 순서 + "미해결 이슈" 항목을 참고하세요.

---

## 0. 준비 (최초 1회)

- Node.js 설치
- Electron 도구 설치 (원복하면서 package.json에서 뺐으므로 다시 설치 필요):
  ```
  npm install -D electron electron-builder
  ```

---

## 1. 필요한 파일/설정 (원복돼서 지금은 없음 — 다시 만들어야 함)

### package.json 에 추가
```json
"main": "electron/main.cjs",
"scripts": {
  "electron:dev": "npm run build && electron .",
  "electron:build": "npm run build && electron-builder --win zip --x64"
},
"build": {
  "appId": "com.courtmate.app",
  "productName": "court mate",
  "directories": { "output": "C:/Users/CHOMINSIK/AppData/Local/cm-build" },
  "files": ["dist/**/*", "electron/**/*"],
  "win": { "target": [{ "target": "zip", "arch": ["x64"] }] }
}
```
> output을 프로젝트(Documents) 안에 두면 OneDrive 동기화 때문에 `EPERM` 오류가 남.
> 그래서 AppData\Local 로 지정.

### electron/main.cjs (새로 생성)
- dist/index.html 을 창으로 띄우는 파일.
- ⚠️ `win.loadFile()`(file://) 방식은 CSS/JS 로딩이 막힘.
- 커스텀 프로토콜(app://)로 dist를 서빙하는 방식으로 시도했으나 **CSS 여전히 미적용**.

---

## 2. 빌드 명령

```
npm run build
npx electron-builder --win zip --x64
```

### 결과물 위치
```
C:\Users\CHOMINSIK\AppData\Local\cm-build\
    court mate-0.0.0-win.zip      ← 배포용 (전달)
    win-unpacked\court mate.exe   ← 실행 파일 (설치 불필요)
```

---

## 3. ★ 미해결 이슈: exe 실행 시 스타일(CSS) 안 먹음

### 증상
- exe 실행 시 React는 렌더되는데(글자/버튼은 보임) **CSS가 전혀 적용 안 됨**. 밋밋한 흰 화면.
- css 에 root root 가 두번 있었음.
- 프로젝트 수행시에 css 스타일 오류 체크할수 있은 extension 설치 권장

### 지금까지 시도한 것 (모두 실패 또는 부분 성공)
1. `vite.config.js` 에 `base: './'` + crossorigin 속성 제거 플러그인 → 실패
2. `electron/main.cjs` 에서 file:// 대신 `app://` 커스텀 프로토콜로 서빙 + Content-Type 정확히 지정
   → CSS 파일이 `text/css`로 정상 서빙되는 것까지 로그로 확인했으나 **여전히 화면에 미적용**
3. `vite-plugin-singlefile` 로 JS/CSS를 index.html 하나에 인라인 + CSP 메타 주입
   → 인라인은 됐으나 화면 확인 단계에서 중단(미검증)

### 다음에 시도해볼 방향 (추천 순서)
1. **로컬 웹서버 방식**: Electron 메인에서 `express` 같은 걸로 dist를 http://localhost 로 서빙하고
   `win.loadURL('http://localhost:포트')` 로 로드. → file:// 계열 문제를 완전히 우회. (가장 확실)
2. **Tauri** 로 전환: Electron보다 이런 로컬 로딩 이슈가 적고 exe 용량도 작음.
3. singlefile + CSP 방식을 끝까지 검증 (개발자도구 Console 탭의 실제 오류 메시지 확인이 핵심).
   - 디버그: main.cjs에서 `win.webContents.openDevTools()` 로 콘솔 열어 CSS 관련 에러 확인.

---

## 4. 자주 나는 문제

| 증상 | 원인 / 해결 |
| --- | --- |
| exe 스타일 안 먹음 | 위 3번 "미해결 이슈" 참고. 로컬 웹서버 방식 권장 |
| `EPERM: operation not permitted` | output이 OneDrive 폴더(Documents). AppData\Local 로 지정 |
| `spawn UNKNOWN` (nsis 빌드) | 이 PC에선 설치형(nsis) 빌드 실패. `zip` 타겟만 사용 |
| Setup.exe 가 186KB로 작음 | nsis 빌드 실패로 페이로드 없는 껍데기. 사용 금지 |

---

## 5. 현재 남아있는 산출물 (참고)

`C:\Users\CHOMINSIK\AppData\Local\cm-build\` 안:
- `court mate-0.0.0-win.zip` / `win-unpacked\court mate.exe` → 실행되지만 **스타일 깨진 버전**
- `court mate Setup 0.0.0.exe` (186KB) → 실패한 껍데기, 삭제 권장
- 나머지(nsis, portable, builder-debug.yml) → 임시/구버전, 삭제 가능
