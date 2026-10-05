알겠습니다. histories (이력) 테이블을 제외하고 정리한 최종 데이터베이스 테이블 스크립트 및 샘플 데이터를 구성했습니다.

SQL
-- ==========================================================
-- 1. 테이블 생성 (Schema DDL)
-- ==========================================================

-- 1-1. 회원 정보 테이블
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    birth TEXT,
    phone TEXT,
    gender TEXT,
    level TEXT,
    lessonType TEXT DEFAULT '개인',
    role TEXT DEFAULT '사용자',
    status TEXT DEFAULT '등록'
);

-- 1-2. 회원별 레슨 일정 테이블 (요일/시간/날짜)
CREATE TABLE IF NOT EXISTS member_lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    day TEXT NOT NULL,
    time TEXT NOT NULL
);

-- 1-3. 이용권 테이블
CREATE TABLE IF NOT EXISTS passes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER,
    name TEXT NOT NULL,
    total INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0,
    remaining INTEGER DEFAULT 0,
    status TEXT DEFAULT '이용중',
    registeredAt TEXT
);

-- 1-4. 스케줄(레슨 예약) 테이블
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    member_id INTEGER,
    name TEXT NOT NULL,
    status TEXT DEFAULT '예약',
    note TEXT,
    passId TEXT
);

-- 1-5. 정산 (매출/통계) 테이블
CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER,
    name TEXT NOT NULL,
    amount INTEGER DEFAULT 0,
    type TEXT,
    date TEXT NOT NULL,
    note TEXT
);

-- 1-6. 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT
);