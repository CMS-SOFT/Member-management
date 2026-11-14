# Court Mate 코드 검수 결과 보고서

검수 기준: 개발가이드(화면).md, 개발가이드(시스템).md, SKILL_OF_PROOF.md  
검수 커밋: f7dff97 (HEAD → main)  
검수 일시: 2026-11-08

---

## 빌드 검증 (항목 13)

재실행한 검증 결과:
- `npm run lint`: 0 errors ✅
- `npm run build`: success, dist/index.html 377.44 kB ✅
- `node --check server/server.cjs`: ok ✅

---

## 1. App.jsx

| 체크 항목 | 결과 |
|---|---|
| `<div className="app-shell">` → `<div className="app-window">` | ✅ 확인 (App.jsx 줄 57-58) |
| `<header className="app-header">` | ✅ 확인 |
| `<button className="brand-btn">` | ✅ 확인, `window.scrollTo({ top: 0, behavior: 'smooth' })` 연결 |
| `<button className="manual-btn">` | ✅ 확인 |
| `<button className="home-btn">` | ✅ 확인, refreshAppData 후 login 화면 전환 |
| `<main className="app-content">` | ✅ 확인 |
| `<footer className="app-footer">Tennis attendance desk` | ✅ 확인 |

---

## 2. base.css CSS 변수

| 체크 항목 | 결과 |
|---|---|
| `--wine: #91002f` | ✅ 확인 |
| `--ink: #222222` | ✅ 확인 |
| `--muted: #666666` | ✅ 확인 |
| `--border-rose: #e0c2c7` | ✅ 확인 |
| 기본 액션 버튼 `var(--wine)` / 글자색 `#ffffff` | ✅ `.primary-button` 확인 |
| 취소 버튼 배경 `#ffffff`, 테두리 `1px solid #cccccc` | ✅ `.cancel-button` 확인 |
| 위험 버튼 배경 `#ffe6e6`, 테두리 `1px solid #ff9999`, 글자 `#990000` | ✅ `.delete-button` 확인 |

---

## 3. 모달 드래그

| 체크 항목 | 결과 |
|---|---|
| 백드롭 `<div className="modal-backdrop">` | ✅ common.jsx Backdrop 컴포넌트에서 확인 |
| `div.modal-header` 드래그 이동 | ✅ MemberDetail.jsx: `handleMouseDown` / SettlementSection, ArchiveViewer: `useDraggable` 훅 |
| input/select/button 클릭 시 드래그 방지 | ✅ MemberDetail `handleMouseDown`에서 tagName 검사, useDraggable에서 `event.target.closest('button, input, select, textarea, a')` 검사 |
| `e.stopPropagation()` 모달 카드 클릭 전파 차단 | ✅ Admin.jsx confirm-modal, MemberDetail confirm-modal 등 전 modal-card에서 확인 |

---

## 4. Login.jsx

| 체크 항목 | 결과 |
|---|---|
| `<div className="login-container">` | ✅ 확인 |
| `<div className="login-card">` | ✅ 확인 |
| `<h1 className="login-title">court mate` | ✅ 확인 |
| `<input className="password-input" type="password">` | ✅ 확인 |
| `<button className="login-submit-btn">` | ✅ 확인 |
| `isComposing` IME 방지 | ✅ `if (event.nativeEvent.isComposing) return;` 확인 (Login.jsx 줄 9) |
| 인증 실패 후 포커스 복원 | ✅ `setTimeout(() => inputRef.current?.focus(), 50)` 확인 |
| 로딩 중 버튼 disabled | ✅ `disabled={isLoading}` 확인 |

---

## 5. Admin.jsx

| 체크 항목 | 결과 |
|---|---|
| `admin-header-bar` | ✅ 확인 |
| `admin-greeting` | ✅ `관리자님 환영합니다.` 확인 |
| `admin-actions` | ✅ 확인 |
| `data-manage-btn` | ✅ IntegratedCsvTools 내부 button className 확인 |
| `summary-cards-container` (3개 카드) | ✅ 총 회원 수 / 레슨 횟수(완료/전체) / 레슨 회원수 3개 확인 |
| `summary-card`, `card-label`, `card-value` | ✅ 확인 |
| `admin-tabs` | ✅ 확인, 스케줄표/회원정보/정산 탭 |
| `member-register-btn` (`＋ 회원등록`) | ✅ 확인, 탭 영역 우측 고정 |

---

## 6. ScheduleSection.jsx / AdminCalendar.jsx

| 체크 항목 | 결과 |
|---|---|
| `schedule-controls-bar` 컨테이너 | ✅ ScheduleSection.jsx 확인 |
| `controls-left` / `controls-center` / `controls-right` 3단 | ✅ 확인 |
| `schedule-member-filter` select | ✅ 확인 (ScheduleSection에서 `className="schedule-member-filter"`) |
| `month-switcher` 가운데 | ✅ `<div className="month-switcher">` 확인 |
| `schedule-view-select` | ✅ 확인 |
| `admin-calendar-grid` | ✅ AdminCalendar.jsx `<div className="admin-calendar-grid">` 확인 |
| `calendar-weekday` 요일 헤더 | ✅ `<div className="calendar-weekday">` 확인 |
| `calendar-date-cell` 날짜 셀 | ✅ 확인 |
| `other-month` 클릭 비활성화 | ✅ `style={outside ? { pointerEvents: 'none' } : { cursor: 'pointer' }}` 및 `onClick={() => { if (!outside) ... }}` 확인 |
| `calendar-schedule-item` | ✅ `<div className="calendar-schedule-item ...">` 확인 |
| `schedule-list-table` 리스트 뷰 | ✅ `<table className="schedule-list-table">` 및 `<tr className="schedule-row">` 확인 |

---

## 7. MemberTable.jsx

| 체크 항목 | 결과 |
|---|---|
| `member-table-wrap` | ✅ `<div className="member-table-wrap">` 확인 |
| `member-table` | ✅ `<table className="member-table">` 확인 |
| `member-name-link` | ✅ `<span className="member-name-link">` 확인 |
| `reregister-trigger-btn` | ✅ `<button className="reregister-trigger-btn">` 확인 |
| 관리자 계정 최상단 고정 | ✅ `.sort((a, b) => (a.role === '관리자' ? -1 : 0) - ...)` 확인 |

---

## 8. MemberDetail.jsx

| 체크 항목 | 결과 |
|---|---|
| `modal-card member-detail-modal` | ✅ `className="modal-card member-detail-modal"` 확인 |
| `member-info-form` (2열 그리드 폼) | ✅ `<div className="member-info-form">` 확인 |
| `passes-container` | ✅ `<div className="passes-container">` 확인 |
| `pass-card` | ✅ `<div className="pass-row pass-card ...">` 확인 |
| 카드 순서: 이용현황 \| 등록날짜 \| 레슨 일정 보기 \| 삭제 | ✅ `pass-card-view` 버튼 내부에 `b(used/total)`, `span(status)`, `i(registeredAt)`, `span.pass-view-label(레슨 일정 보기)`, 외부 `button.pass-del(삭제)` 순서 일치 |
| `white-space: nowrap; flex-shrink: 0` | ✅ member.css: `.pass-card-view`에 `white-space: nowrap`, `.pass-card-view b,span,i`에 `flex: 0 0 auto; white-space: nowrap`, `.pass-del`에 `white-space: nowrap` 확인 |

---

## 9. SettlementSection.jsx

| 체크 항목 | 결과 |
|---|---|
| `+ 정산 추가` 버튼 완전 제거 | ✅ SettlementSection.jsx 전체에서 해당 버튼 없음 확인 |
| `schedule-controls` 3열 Grid | ✅ `<div className="schedule-controls">` 확인, schedule.css에서 `grid-template-columns: 1fr auto 1fr` 확인 |
| `schedule-member-filter` | ✅ 확인 |
| `month-switcher` | ✅ 확인 |
| `schedule-view-select` | ✅ 확인 |
| `settlement-month-total` | ✅ `<div className="settlement-month-total">` 달력/리스트 바로 아래 배치 확인 |
| 달력 셀 클릭 시에만 팝업 오픈 | ✅ `onClick={() => { if (!outside) openNewEntry(fullDate); }}` 확인, 상단 추가 버튼 없음 |
| 팝업 `modal-card settlement-popup` 너비 420px | ✅ admin.css `.settlement-popup { width: min(420px, 100%); }` 확인 |

---

## 10. ArchiveViewer.jsx

| 체크 항목 | 결과 |
|---|---|
| `archive-year-select` | ✅ `<select className="archive-year-select">` 확인 |
| 연도 로직: 현재연도-2부터 5개년 (가이드 §7.1 예시 일치) | ✅ `archiveBaseYear = currentYear - 2`, `Array.from({ length: 5 }, (_, i) => archiveBaseYear - i)` 확인. 2027 기준: 2025, 2024, 2023, 2022, 2021 = 가이드 예시 100% 일치 |
| 모든 컨트롤 읽기 전용 | ✅ 데이터 수정/삭제 API 호출 없음, `archive-table` 표만 렌더링, 데이터 편집 컨트롤 없음 |

---

## 11. csv.js

| 체크 항목 | 결과 |
|---|---|
| `id`, `member_id`, `use_flag` 필드 내보내기 제외 | ✅ MEMBER_DB_COLS, SCHEDULE_DB_COLS, PASS_DB_COLS에 id/use_flag 없음. PASS_DB_COLS에도 member_id 없음 |
| `use_flag='Y'` 필터 | ✅ membersToCsv, schedulesToCsv, passesToCsv 모두 `use_flag !== 'N'` 필터 확인 |
| UTF-8 BOM | ✅ 각 export 함수 반환값 `\uFEFF` prefix 확인 |
| 빈 양식 헤더 = 실제 내보내기 헤더 일치 | ✅ `memberTemplateCsv()` = `MEMBER_KR_HDRS`, `scheduleTemplateCsv()` = `SCHEDULE_KR_HDRS` - 동일 상수 사용 확인 |

---

## 12. server.cjs

| 체크 항목 | 결과 |
|---|---|
| 소프트 삭제 (`use_flag='N'`) 전체 삭제 처리 | ✅ deleteMember, deleteSchedule, cancelPass 등 모두 `UPDATE ... SET use_flag='N'` 확인 |
| 이용권 삭제 시 연결 일정 함께 소프트 삭제 (트랜잭션) | ✅ `action === 'deletePass'`에서 `dbTransaction` 내 schedules, passes 동시 use_flag='N' 확인 |
| `type='일별정산'`, 0원 소프트 삭제 | ✅ `saveSettlement`: 0원+id 있을 때 `UPDATE settlements SET use_flag='N' WHERE id=?`, 0원+id 없을 때 `WHERE member_id=? AND date=?` 소프트 삭제 확인 |
| 레슨 완료 시 `passes.used/remaining/status` 갱신 | ✅ `refreshPassUsage` 함수 구현 및 updateSchedule/deleteSchedule에서 호출 확인 |
| `settlements` 복합 인덱스 | ✅ `CREATE INDEX IF NOT EXISTS idx_settlements_active_date ON settlements(use_flag, date, member_id)` 확인 |
| `addColumnIfMissing` | ✅ 함수 정의 및 모든 테이블 use_flag, member_lessons.date 등에 적용 확인 |

---

## 14. 불필요 파일 정리

| 체크 항목 | 결과 |
|---|---|
| `POWER.md` | ✅ 미존재 확인 (Test-Path = False) |
| `KakaoTalk_20260915_174934574.jpg` | ✅ 미존재 확인 |
| `build_guide/` | ✅ 미존재 확인 |
| `release/` | ✅ 미존재 확인 |
| `upload_data/` | ✅ 미존재 확인 |

---

## 최종 결론

모든 체크리스트 항목이 가이드 규격과 일치합니다. 빌드/lint/syntax 검증 모두 성공.

**VERDICT: APPROVED**
