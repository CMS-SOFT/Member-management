-- 1. 회원 정보 테이블 (기본 인적사항)
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 회원 고유 번호 (기본키)
    name TEXT NOT NULL,                   -- 회원명 (중복 허용)
    birth TEXT,                           -- 생년월일 (예: 900101)
    phone TEXT,                           -- 전화번호
    gender TEXT,                          -- 성별 (남/여)
    level TEXT,                           -- 레벨
    lessonType TEXT DEFAULT '개인',         -- 레슨 형태 (개인 / 단체 등)
    role TEXT DEFAULT '사용자',             -- 구분 (관리자/사용자)
    status TEXT DEFAULT '등록'             -- 상태
);

-- 1-2. 회원별 레슨 요일/시간 테이블 (주 1회~4회 대응)
CREATE TABLE IF NOT EXISTS member_lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 고유 번호
    member_id INTEGER,                    -- 회원 고유 번호 (members.id 연결용)
    name TEXT NOT NULL,                   -- 회원명 (엑셀/시트 확인용)
    day TEXT NOT NULL,                    -- 요일 (예: 월요일, 수요일 등)
    time TEXT NOT NULL                    -- 시간 (예: 10:00)
);

-- 2. 이용권 테이블
CREATE TABLE IF NOT EXISTS passes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 이용권 고유 번호
    member_id INTEGER,                    -- 회원 고유 번호
    name TEXT NOT NULL,                   -- 회원명
    total INTEGER DEFAULT 0,              -- 전체 횟수
    used INTEGER DEFAULT 0,               -- 사용 횟수
    remaining INTEGER DEFAULT 0,          -- 남은 횟수
    status TEXT DEFAULT '이용중',           -- 상태 (이용중/완료 등)
    registeredAt TEXT                     -- 등록일 (YYYY-MM-DD)
);

-- 3. 스케줄(레슨 예약) 테이블
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 스케줄 고유 번호
    date TEXT NOT NULL,                   -- 날짜 (YYYY-MM-DD)
    time TEXT NOT NULL,                   -- 시간 (HH:MM)
    member_id INTEGER,                    -- 회원 고유 번호
    name TEXT NOT NULL,                   -- 회원명
    status TEXT DEFAULT '예약',             -- 상태 (예약, 완료, 취소 등)
    note TEXT,                            -- 메모 및 비고
    passId TEXT                           -- 연관된 이용권 식별자
);

-- 4. 이력(히스토리) 테이블
CREATE TABLE IF NOT EXISTS histories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 이력 고유 번호
    member_id INTEGER,                    -- 회원 고유 번호
    name TEXT NOT NULL,                   -- 회원명
    lessonStatus TEXT,                    -- 레슨 상태
    historyStatus TEXT                    -- 이력 상태
);

-- 5. 정산 (매출/통계) 테이블
CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 정산 고유 번호
    member_id INTEGER,                    -- 회원 고유 번호
    name TEXT NOT NULL,                   -- 회원명 또는 항목명
    amount INTEGER DEFAULT 0,             -- 금액
    type TEXT,                            -- 구분 (예: 매출, 지출 등)
    date TEXT NOT NULL,                   -- 정산 날짜 (YYYY-MM-DD)
    note TEXT                             -- 메모
);

-- 6. 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 알림 고유 번호
    title TEXT NOT NULL,                  -- 알림 제목
    message TEXT NOT NULL,                -- 알림 내용
    type TEXT,                            -- 알림 유형 (예: 만료 임박, 예약 안내 등)
    isRead INTEGER DEFAULT 0,             -- 읽음 여부 (0: 안 읽음, 1: 읽음)
    createdAt TEXT                        -- 생성일시
);