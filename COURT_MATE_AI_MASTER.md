# 🎾 Court Mate — AI 개발 에이전트 전용 통합 작업 지시서 (Master Spec)

> **AI 에이전트(Kiro / Cursor / Copilot) 필독 안내:**
> 이 문서는 **Court Mate(테니스 회원·레슨 일정 관리 앱)**의 유일한 기준 명세서(SSOT)입니다.
> 모든 코드 수정 및 기능 추가 작업 시 반드시 본 문서의 **[1. 시스템 아키텍처]**, **[2. 개발 절대 원칙]**, **[4. 파일 매핑]**을 준수하여 **Phase 1(코어 안정화)**부터 **Phase 2(RAG·에이전트 확장)** 순서대로 작업을 수행하십시오.

---

## 1. 시스템 및 기술 스택 (System & Stack)

* **프론트엔드:** React 19, React Router DOM 7, Vite 8 (`vite-plugin-singlefile`), Lucide React
* **크로스 플랫폼 런타임:**
  * **Desktop:** Electron 30 (`electron-builder`)
  * **Mobile (Android):** Capacitor 8 (`@capacitor/android`, `@capacitor/filesystem`, `@capacitor/share`)
* **데이터베이스 (로컬 우선):** **SQLite** (`@capacitor-community/sqlite` — 모바일·데스크탑 공통 로컬 영속성 계층)
* **파일 입출력:** Excel(`.xlsx`) 및 CSV (`xlsx` 라이브러리 및 네이티브 파일시스템 연동)
* **향후 확장 AI 백엔드 (Phase 2):** Python 3, FastAPI, Uvicorn, LangGraph, LangChain, ChromaDB(또는 `sqlite-vec`), Neo4j(선택)

---

## 2. 개발 절대 원칙 (Core Rules)

1. **로그인 화면 절대 수정 금지:**
   * `src/components/Login.jsx` 및 `src/styles/login.css`는 문구, 레이아웃, 인증 로직(생년월일 6자리 + 전화번호 뒤 4자리) 그 어떤 것도 변경하지 마십시오.
2. **비전문가(코치) 친화적 UI 언어 사용:**
   * 화면에 노출되는 버튼, 안내문, 팝업 메시지에는 IT 전문 용어(DB, CSV, 초기화, 쿼리 등)를 쓰지 말고 쉬운 일상어(엑셀 파일, 내려받기, 전체 지우기 등)를 사용하십시오.
3. **엄격한 모듈화 유지:**
   * 단일 파일 비대화를 막기 위해 UI 컴포넌트(`src/components/`), 비즈니스 로직(`src/hooks/`), DB·유틸(`src/lib/`), 스타일(`src/styles/`)의 책임을 철저히 분리하십시오.
4. **오프라인 우선(Offline-First) 보장:**
   * 코어 기능(Phase 1)은 외부 인터넷 연결 없이 로컬 SQLite만으로 100% 동작해야 합니다.
5. **SQLite 단일 진실 공급원(SSOT) 및 데이터 흔적 보존 원칙 (`skill of proof` 기준):**
   * 모든 데이터 조회(`READ`)와 변경(`WRITE`: `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`)은 반드시 **로컬 SQLite(`@capacitor-community/sqlite`)에 실제 반영되어 영속적인 흔적이 남아야 합니다.**
   * 프론트엔드 메모리(`useState`)만 변경하고 DB 반영을 누락하는 임시 처리를 엄격히 금지합니다.
   * 모든 명시적 확정 시점(예: `[수정]` 버튼 클릭, 레슨 시작·종료, 재등록, 전체 지우기 등)에는 반드시 `src/lib/bootstrapService.js`의 SQLite 쿼리/트랜잭션을 통해 실제 DB 파일에 기록되어야 합니다.
   * 향후 AI 에이전트(MCP 도구)가 데이터를 조회하거나 수정할 때도 메모리 캐시가 아닌 **SQLite의 최신 기록을 기준으로 검증·실행**하며, 데이터 변경 내역(생성·수정·삭제)의 무결성을 보장해야 합니다.

---

## 3. 화면(UI) 및 기능 명세 (Screen & Feature Specs)
*(상태 표기: `✅ 구현 완료` / `🔜 Phase 1 수정·구현 대상` / `💡 향후 검토`)*

### 3-1. 공통 레이아웃 및 인증
* **로그인 화면 (`✅` 수정 금지):** 관리자 계정 전용 로그인.
* **상단 헤더 (`✅`):** 좌측 브랜드명(`court mate`), 우측 `[사용설명서]`, `[홈으로]`, `[로그아웃]`, 관리자 전용 `[자료 관리 ▾]` 드롭다운. (`court mate` 로고 및 `[홈으로]` 클릭 시 로그인 화면이 아닌 대시보드 메인 유지)
* **상단 통계 카드 (`✅`):** 총 회원 수 / 이번 달 레슨 횟수(완료/전체) / 이번 달 고유 레슨 회원 수.
* **팝업(모달) 공통 규격 (`✅`):** 어두운 오버레이 영역 클릭 시 닫힘, 스케줄 관련 모달은 마우스 드래그 이동(`useDraggable.js`) 지원.

### 3-2. 스케줄표 탭 (`ScheduleSection.jsx`, `AdminCalendar.jsx`, `LessonEditor.jsx`)
* **달력 및 리스트 뷰 (`✅`):** 월별 캘린더 그리드, 회원별 필터링, 빈 날짜 클릭 시 즉석 일정 추가, 날짜·시간순 리스트 보기 지원.
* **레슨 진행 상태 제어 (`✅`):** `[레슨 시작]` 클릭 시 `진행중`, `[레슨 종료]` 클릭 시 `완료` 처리 및 해당 회원 이용권 1회 자동 차감 (즉시 SQLite `UPDATE` 반영).
* **단체 레슨 중복 허용 토글 (`🔜`):** 기본적으로 동일 시간대 중복 등록을 차단하되, 2인 이상 동시 진행하는 단체 레슨을 위해 시간 중복 경고 및 차단 제어를 유연하게 해제할 수 있는 토글/옵션 추가.

### 3-3. 회원정보 및 이용권 관리 (`MemberTable.jsx`, `MemberDetail.jsx`, `MemberRegister.jsx`, `ReregisterModal.jsx`)
* **회원 목록 및 재등록 (`✅`):** 이용권 소진(`완료`) 회원 행 끝에만 `[재등록]` 버튼 노출, 클릭 시 총 횟수·반복 요일·시간 입력 후 미래 일정 자동 생성 (SQLite 일괄 `INSERT`).
* **이용권 명시적 저장 수정 (`🔜` 최우선):** 회원 상세 창(`MemberDetail.jsx`)에서 이용권 추가/수정/삭제 시 자동 저장되지 않고, 로컬 임시 상태(`useState`)로 유지되다가 하단의 **[수정]** 버튼을 명시적으로 클릭했을 때만 SQLite DB에 최종 `INSERT/UPDATE/DELETE` 반영되도록 수정 (취소/닫기 시 DB 변경 없이 폐기).
* **이용권 추가 시 레슨비 자동 제안 (`🔜`):** 이용권 추가 시 기본 레슨비 단가를 자동 표시하되 코치가 수기 수정 가능하도록 입력 필드 제공.
* **만료 회원 시각화 (`🔜`):** 이용권이 만료되거나 소진된 회원을 목록에서 한눈에 알아볼 수 있도록 상태 배지 및 행 색상 강조.
* **회원 등록·수정 시 스케줄 자동 연동 (`🔜`):**
  * 신규 회원 등록 시 초기 주당 횟수, 레슨 요일, 레슨 시간, 시작일을 입력받아 스케줄표에 자동 배치 (SQLite `INSERT`).
  * 회원 상태가 `탈퇴`로 변경되면 스케줄표의 미래 일정에서 자동 제외 (SQLite `DELETE` 또는 상태 `UPDATE`).
  * 회원 상세 창에서 기본 레슨 요일/시간 수정 시 연동된 향후 일정 일괄 수정 (SQLite `UPDATE`).
* **월별 매출 통계 (`💡`):** 납부된 레슨비 기반 월 소득 합계 대시보드 카드.

### 3-4. 자료 관리 및 아카이브 (`CsvTools.jsx`, `ArchiveViewer.jsx`)
* **엑셀/CSV 입출력 (`✅`):** 회원/스케줄/이용권별 내려받기(Export), 불러오기(Import), 빈 양식 다운로드.
* **아카이브 및 전체 지우기 (`✅`):** 완료된 과거 일정 백업 후 메인 목록 정리(연말정리), 백업 파일 읽기 전용 조회(과거조회), 관리자 계정 제외 전체 데이터 초기화 (SQLite `DELETE`/`TRUNCATE` 반영).

---

## 4. 소스 코드 파일 매핑 (File Mapping)

AI 에이전트는 작업 대상에 맞는 아래 파일만 정확히 탐색하여 수정하십시오.

| 영역 | 파일 경로 | 핵심 책임 및 역할 |
| :--- | :--- | :--- |
| **보호 구역** | `src/components/Login.jsx`<br>`src/styles/login.css` | **로그인 UI 및 스타일 (수정 금지)** |
| **공통/메인** | `src/App.jsx`<br>`src/components/Admin.jsx`<br>`src/components/common.jsx` | 라우팅, 관리자 대시보드 조립, 공통 모달·카드·배지 UI |
| **회원 관리** | `src/components/member/MemberTable.jsx`<br>`src/components/member/MemberDetail.jsx`<br>`src/components/member/MemberRegister.jsx`<br>`src/components/member/ReregisterModal.jsx` | 회원 목록 표, 상세 정보·이용권 편집 모달, 신규 회원 등록 폼, 재등록 모달 |
| **일정 관리** | `src/components/schedule/ScheduleSection.jsx`<br>`src/components/schedule/AdminCalendar.jsx`<br>`src/components/schedule/LessonListModal.jsx`<br>`src/components/schedule/LessonEditor.jsx` | 스케줄 탭 컨트롤, 월별 달력 그리드, 날짜별 일정 모달, 개별 일정 수정·시작·종료 에디터 |
| **도구/안내** | `src/components/CsvTools.jsx`<br>`src/components/ArchiveViewer.jsx`<br>`src/components/UserManual.jsx` | 자료 관리 드롭다운, 과거 아카이브 뷰어, 사용설명서 및 PDF 출력 |
| **비즈니스 로직** | `src/hooks/useAdminData.js` | 관리자 화면 모든 상태 관리 및 CRUD 액션 총괄 커스텀 훅 |
| **DB 및 유틸** | `src/lib/bootstrapService.js`<br>`src/lib/sheet.js`<br>`src/lib/csv.js`<br>`src/lib/seed.js`<br>`src/lib/useDraggable.js` | **SQLite 영속성 처리(READ/WRITE)**, 반복 일정 생성 알고리즘, 엑셀/CSV 파싱, 초기 샘플 데이터, 드래그 훅 |
| **스타일시트** | `src/App.css` 및 `src/styles/*.css` | `base`, `layout`, `common`, `member-portal`, `admin`, `schedule`, `member`, `modal`, `tools`, `responsive` 모듈형 CSS |

---

## 5. Phase 1: 코어 배포 버전 안정화 작업 순서 (우선 실행)

VS Code AI는 아래 **Task 1-1부터 Task 1-4까지 순차적으로** 코드를 점검하고 수정하십시오. 모든 데이터 변경은 반드시 SQLite(`bootstrapService.js`)에 영속적으로 기록되어야 합니다.

* **[Task 1-1] 이용권 명시적 저장 로직 수정 (최우선)**
  * **대상:** `src/components/member/MemberDetail.jsx`, `src/hooks/useAdminData.js`, `src/lib/bootstrapService.js`
  * **지시:** 이용권 추가/삭제/레슨비 수정 시 즉시 DB에 저장되던 로직을 제거하고, 모달 내부 로컬 임시 상태(`draftVouchers` 등)로 관리하십시오. 하단의 **[수정]** 버튼을 눌렀을 때만 최종 변경 사항을 SQLite DB에 일괄 `INSERT/UPDATE/DELETE` 반영하고, **[취소]** 또는 오버레이 클릭으로 닫을 때는 변경 사항을 폐기하십시오.
* **[Task 1-2] 단체 레슨 시간 중복 허용 옵션 구현**
  * **대상:** `src/components/schedule/LessonEditor.jsx`, `src/components/schedule/LessonListModal.jsx`, `src/hooks/useAdminData.js`
  * **지시:** 일정 추가/수정 창에 `[단체 레슨(시간 중복 허용)]` 체크박스 또는 토글을 추가하고, 해당 옵션이 켜져 있을 때는 동일 시간대 중복 저장 차단 로직을 우회하여 SQLite에 저장되도록 처리하십시오.
* **[Task 1-3] 회원 등록·수정·탈퇴 시 스케줄 자동 연동**
  * **대상:** `src/components/member/MemberRegister.jsx`, `src/components/member/MemberDetail.jsx`, `src/hooks/useAdminData.js`, `src/lib/sheet.js`, `src/lib/bootstrapService.js`
  * **지시:** 신규 등록 시 입력한 요일·시간·시작일 기준으로 반복 일정을 자동 생성(SQLite `INSERT`)하고, 회원을 `탈퇴` 처리하거나 기본 요일/시간을 변경하면 오늘 이후의 미래 스케줄에 즉시 동기화(SQLite `UPDATE/DELETE`)하십시오.
* **[Task 1-4] 만료 회원 시각화 및 빌드 검증**
  * **대상:** `src/components/member/MemberTable.jsx`, `src/styles/member.css`
  * **지시:** 잔여 이용권이 0회이거나 만료된 회원 행에 직관적인 상태 배지와 강조 색상을 적용하고, `npm run build` 및 Electron/Capacitor 빌드 오류가 없는지 검증하십시오.

---

## 6. Phase 2: RAG 및 AI 에이전트(MAS) 확장 작업 순서 (Phase 1 완료 후 진행)

Phase 1의 모든 태스크가 완료되어 Git `main` 브랜치에 커밋된 후, 새 브랜치(`feat/ai-agent-rag`)에서 아래 순서대로 AI 기능을 확장하십시오.

* **[Task 2-1] RAG용 비정형 코칭 데이터 필드 확장**
  * **대상:** `src/lib/bootstrapService.js`, `src/lib/csv.js`, `src/components/member/MemberDetail.jsx`, `src/components/schedule/LessonEditor.jsx`
  * **지시:** SQLite 회원 테이블에 `notes`(구력, 주 사용 손, 목표, 부상 특이사항) 컬럼을, 레슨 테이블에 `coachingLog`(레슨 종료 시 남기는 한 줄 코칭 일지) 컬럼을 추가하고 엑셀 백업 양식에도 반영하십시오.
* **[Task 2-2] Python AI 백엔드(`ai-server/`) 사이드카 구축**
  * **대상:** 프로젝트 루트 내 신규 폴더 `ai-server/` (`app/main.py`, `app/agents/`, `app/rag/`, `app/tools/`, `requirements.txt`)
  * **지시:** `FastAPI`, `Uvicorn`, `LangGraph`, `LangChain`, `ChromaDB`(또는 `sqlite-vec`) 기반의 비동기 AI 서버를 구축하십시오.
* **[Task 2-3] 하이브리드 RAG 및 Graph RAG 파이프라인 구현**
  * **지시:** SQLite에 기록된 회원의 코칭 일지(`coachingLog`)와 특이사항을 임베딩하여 벡터 검색 + 키워드(회원명·날짜) 하이브리드 검색 API를 구현하십시오. 필요시 Neo4j를 연동해 `회원 - 단체레슨 - 부상이력 - 이용권` 관계 추론(Graph RAG)으로 확장하십시오.
* **[Task 2-4] 멀티 에이전트(MAS) 및 MCP 스타일 도구(Tool) 연동**
  * **지시:** `Router Agent`가 코치의 자연어 요청을 분류하여, 일정 변경은 `Schedule Agent`(SQLite 최신 데이터 조회 및 중복 체크 후 표준 액션 JSON 반환)로, 코칭 이력 조회는 `Coaching Analyst Agent`(RAG 검색 후 브리핑 생성)로 분배하는 LangGraph 워크플로우를 구현하십시오.
* **[Task 2-5] 프론트엔드 AI 채팅 UI 및 승인(Human-in-the-Loop) 연동**
  * **대상:** 신규 컴포넌트 `src/components/ai/AiAssistantDrawer.jsx` 및 `src/hooks/useAdminData.js`
  * **지시:** 대시보드 우측에 AI 비서 채팅창을 추가하되, AI가 제안한 일정 등록/수정/삭제는 SQLite를 즉시 덮어쓰지 않고 **[변경 제안 카드 → 확인/취소 버튼]**을 띄워 코치님이 승인할 때만 실제 SQLite DB에 `WRITE` 반영되도록 안전장치를 구현하십시오.
