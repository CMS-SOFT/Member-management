# Skill of Proof — 모든 데이터는 SQLite에 연결된다

> 이 문서는 Court Mate의 모든 화면 데이터가 SQLite(`server/member_management.db`)에 연결되어 기록·삭제됨을 증명합니다.
> 개발가이드(시스템).md 및 개발가이드(화면).md와 함께 읽어야 합니다.

---

## 1. 데이터 흐름 전체 체계

```
화면(React)
  └─ src/hooks/useAdminData.js   (상태 + 액션)
      └─ src/lib/bootstrapService.js  (서버 액션 호출)
          └─ src/lib/client.js        (HTTP 요청)
              └─ server/server.cjs    (Express + sql.js)
                  └─ server/member_management.db  ← SQLite 파일
```

모든 화면의 데이터 읽기·쓰기·삭제는 이 경로를 거칩니다. 예외 없음.

---

## 2. 테이블별 기록·삭제 증명

| 화면 | 액션 | 테이블 | 기록 방식 | 삭제 방식 |
|---|---|---|---|---|
| 회원등록 | 신규 회원 저장 | `members` | INSERT, use_flag='Y' | use_flag='N' (소프트) |
| 회원등록 | 고정 레슨 저장 | `member_lessons` | INSERT, use_flag='Y' | use_flag='N' (소프트) |
| 회원등록 | 이용권 생성 | `passes` | INSERT, use_flag='Y' | use_flag='N' (소프트) |
| 회원등록 | 정규 일정 생성 | `schedules` | INSERT, use_flag='Y', passId 연결 | use_flag='N' (소프트) |
| 스케줄표 | 날짜별 레슨 추가 | `schedules` | INSERT | use_flag='N' (소프트) |
| 스케줄표 | 레슨 완료 처리 | `schedules` + `passes` | UPDATE status + used/remaining 갱신 | — |
| 정산 | 일별 정산 저장 | `settlements` | INSERT type='일별정산' | use_flag='N' (소프트) |
| 정산 | 0원 저장 | `settlements` | 활성 행 use_flag='N' 처리 | use_flag='N' (소프트) |
| 알림 | 시스템 알림 | `notifications` | INSERT | use_flag='N' (소프트) |
| 전체 지우기 | 관리자 외 전체 삭제 | 모든 테이블 | — | DELETE (하드, 트랜잭션) |

---

## 3. 소프트 삭제 규칙

모든 삭제는 **물리 삭제 없이** `use_flag` 컬럼으로 처리합니다.

```sql
-- 기록 (활성)
INSERT INTO members (...) VALUES (...);
-- use_flag 기본값 = 'Y'

-- 삭제 (소프트)
UPDATE members SET use_flag = 'N' WHERE id = ?;

-- 조회 (항상 활성만)
SELECT * FROM members WHERE use_flag = 'Y';
```

예외: **전체 지우기**(`관리자 계정 제외 전체 초기화`)는 트랜잭션 내 DELETE 수행.

---

## 4. 이용권 ↔ 일정 연동 (트랜잭션 보장)

```
이용권 삭제
  └─ BEGIN TRANSACTION
      ├─ passes.use_flag = 'N'
      └─ schedules.use_flag = 'N'  (해당 passId 전체)
         COMMIT / ROLLBACK
```

일부만 삭제되는 상황은 없습니다. 둘 다 성공하거나 둘 다 취소됩니다.

---

## 5. 스키마 기준 파일

```
sql/table_create.sql
```

6개 테이블 모두 `use_flag CHAR(1) DEFAULT 'Y'` 컬럼을 보유합니다.

| 테이블 | use_flag |
|---|---|
| members | ✅ |
| member_lessons | ✅ |
| passes | ✅ |
| schedules | ✅ |
| settlements | ✅ |
| notifications | ✅ |

---

## 6. 개발 환경별 DB 경로

| 환경 | DB 경로 |
|---|---|
| 개발 서버 | `server/member_management.db` |
| Windows Electron | `app.getPath('userData')/member_management.db` |
| Android (Capacitor) | 디바이스 내부 스토리지 (Capacitor SQLite 플러그인) |

---

## 참고 문서

- [개발가이드(시스템).md](./개발가이드(시스템).md) — DB 구조, 트랜잭션 규칙, 아카이브 정책
- [개발가이드(화면).md](./개발가이드(화면).md) — 각 화면별 UI와 API 연동 규칙
- [sql/table_create.sql](./sql/table_create.sql) — 기준 스키마
