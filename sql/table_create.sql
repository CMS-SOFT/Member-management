-- ==========================================================
-- Court Mate — 테니스 회원·레슨 일정 관리 시스템
-- 최종 DB 스키마 (개발가이드 기준 — use_flag 소프트 삭제 적용)
-- ==========================================================

-- 1-1. 회원 정보 테이블
--   use_flag: 'Y' = 활성, 'N' = 소프트 삭제 (이력 보존)
CREATE TABLE IF NOT EXISTS members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    birth       TEXT,
    phone       TEXT,
    gender      TEXT,
    level       TEXT,
    lessonType  TEXT    DEFAULT '개인',   -- '개인' | '단체'
    role        TEXT    DEFAULT '사용자', -- '사용자' | '관리자'
    status      TEXT    DEFAULT '등록',   -- '등록' | '이용중' | '완료' | '탈퇴'
    use_flag    CHAR(1) DEFAULT 'Y'       -- 소프트 삭제 플래그
);

-- 1-2. 회원별 고정 레슨 요일/시간 설정 테이블
--   date: 실제 첫 레슨 날짜 (선택), day: 요일(월요일…토요일)
CREATE TABLE IF NOT EXISTS member_lessons (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   INTEGER,
    name        TEXT    NOT NULL,
    date        TEXT,                     -- 실제 날짜 (YYYY-MM-DD, 선택)
    day         TEXT    NOT NULL,         -- 요일 문자열 (예: '월요일')
    time        TEXT    NOT NULL,         -- 시간 (HH:MM)
    use_flag    CHAR(1) DEFAULT 'Y'
);

-- 1-3. 이용권 테이블
CREATE TABLE IF NOT EXISTS passes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id    INTEGER,
    name         TEXT    NOT NULL,
    total        INTEGER DEFAULT 0,       -- 총 횟수
    used         INTEGER DEFAULT 0,       -- 사용 횟수
    remaining    INTEGER DEFAULT 0,       -- 잔여 횟수
    status       TEXT    DEFAULT '이용중', -- '이용중' | '완료' | '만료'
    registeredAt TEXT,                    -- 등록일 (YYYY-MM-DD)
    use_flag     CHAR(1) DEFAULT 'Y'
);

-- 1-4. 스케줄(레슨 예약) 테이블
CREATE TABLE IF NOT EXISTS schedules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL,         -- 레슨 날짜 (YYYY-MM-DD)
    time        TEXT    NOT NULL,         -- 레슨 시간 (HH:MM)
    member_id   INTEGER,
    name        TEXT    NOT NULL,
    status      TEXT    DEFAULT '예약',   -- '예약' | '진행중' | '완료'
    note        TEXT,
    passId      TEXT,
    use_flag    CHAR(1) DEFAULT 'Y'
);

-- 1-5. 정산(매출) 테이블
CREATE TABLE IF NOT EXISTS settlements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   INTEGER,
    name        TEXT    NOT NULL,
    amount      INTEGER DEFAULT 0,
    type        TEXT,                     -- '일별정산' | '월레슨비'(레거시) 등
    date        TEXT    NOT NULL,
    note        TEXT,
    use_flag    CHAR(1) DEFAULT 'Y'
);
CREATE INDEX IF NOT EXISTS idx_settlements_active_date
    ON settlements(use_flag, date, member_id);

-- 1-6. 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    type        TEXT,
    isRead      INTEGER DEFAULT 0,
    createdAt   TEXT,
    use_flag    CHAR(1) DEFAULT 'Y'
);

-- ==========================================================
-- 기존 DB 마이그레이션 (컬럼 추가 — 이미 있으면 무시됨)
-- ==========================================================
-- ALTER TABLE members        ADD COLUMN use_flag CHAR(1) DEFAULT 'Y';
-- ALTER TABLE member_lessons ADD COLUMN use_flag CHAR(1) DEFAULT 'Y';
-- ALTER TABLE member_lessons ADD COLUMN date TEXT;
-- ALTER TABLE passes         ADD COLUMN use_flag CHAR(1) DEFAULT 'Y';
-- ALTER TABLE schedules      ADD COLUMN use_flag CHAR(1) DEFAULT 'Y';
-- ALTER TABLE settlements    ADD COLUMN use_flag CHAR(1) DEFAULT 'Y';
-- ALTER TABLE notifications ADD COLUMN use_flag CHAR(1) DEFAULT 'Y';
