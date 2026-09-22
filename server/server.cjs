const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// SQLite 데이터베이스 파일 연결 (server/ 폴더 안의 member_management.db)
const dbFile = path.resolve(__dirname, 'member_management.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('데이터베이스 연결 실패:', err.message);
    } else {
        console.log('SQLite DB 연결 성공:', dbFile);
    }
});

// 요일 문자열을 숫자로 매핑 (일요일: 0 ~ 토요일: 6)
const dayMap = {
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3,
    '목요일': 4, '금요일': 5, '토요일': 6
};

// 특정 요일의 다가오는 날짜를 구하는 헬퍼 함수 (4주치 계산용)
function getNextDayOfWeek(startDate, dayOfWeek, weekOffset) {
    let resultDate = new Date(startDate.getTime());
    let currentDay = resultDate.getDay();
    let distance = (dayOfWeek + 7 - currentDay) % 7;
    resultDate.setDate(resultDate.getDate() + distance + (weekOffset * 7));
    return resultDate;
}

// 테이블 초기화 (최초 실행 시 자동 생성)
db.serialize(() => {
    // 1. 회원 정보 테이블
    db.run(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        birth TEXT,
        phone TEXT,
        gender TEXT,
        level TEXT,
        lessonType TEXT DEFAULT '개인',
        role TEXT DEFAULT '사용자',
        status TEXT DEFAULT '등록'
    )`);

    // 1-2. 회원별 레슨 요일/시간 테이블
    db.run(`CREATE TABLE IF NOT EXISTS member_lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        name TEXT NOT NULL,
        day TEXT NOT NULL,
        time TEXT NOT NULL
    )`);

    // 2. 이용권 테이블
    db.run(`CREATE TABLE IF NOT EXISTS passes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        name TEXT NOT NULL,
        total INTEGER DEFAULT 0,
        used INTEGER DEFAULT 0,
        remaining INTEGER DEFAULT 0,
        status TEXT DEFAULT '이용중',
        registeredAt TEXT
    )`);

    // 3. 스케줄(레슨 예약) 테이블
    db.run(`CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        member_id INTEGER,
        name TEXT NOT NULL,
        status TEXT DEFAULT '예약',
        note TEXT,
        passId TEXT
    )`);

    // 4. 정산 테이블
    db.run(`CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        name TEXT NOT NULL,
        amount INTEGER DEFAULT 0,
        type TEXT,
        date TEXT NOT NULL,
        note TEXT
    )`);

    // 5. 알림 테이블
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT,
        isRead INTEGER DEFAULT 0,
        createdAt TEXT
    )`);
});

// 1. 전체 데이터 초기 로딩 API
app.get('/api/bootstrap', (req, res) => {
    db.all(`SELECT * FROM members`, [], (err, members) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(`SELECT * FROM member_lessons`, [], (err, member_lessons) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(`SELECT * FROM passes`, [], (err, passes) => {
                if (err) return res.status(500).json({ error: err.message });

                db.all(`SELECT * FROM schedules`, [], (err, schedules) => {
                    if (err) return res.status(500).json({ error: err.message });

                    db.all(`SELECT * FROM settlements`, [], (err, settlements) => {
                        if (err) return res.status(500).json({ error: err.message });

                        db.all(`SELECT * FROM notifications`, [], (err, notifications) => {
                            if (err) return res.status(500).json({ error: err.message });

                            res.json({ members, member_lessons, passes, schedules, settlements, notifications });
                        });
                    });
                });
            });
        });
    });
});

// 2. 통합 API 액션 처리
app.post('/api/action', (req, res) => {
    const { action, member } = req.body;

    if (action === 'appendMember') {
        const { name, birth, phone, gender, level, lessonType, lessons } = member;
        const role = '사용자';
        const status = '등록';

        // 1. members 테이블에 기본 정보 삽입
        db.run(
            `INSERT INTO members (name, birth, phone, gender, level, lessonType, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, birth, phone, gender || '남', level || '입문', lessonType || '개인', role, status],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const memberId = this.lastID;

                // 2. member_lessons 테이블에 선택한 요일/시간들 저장 (day 또는 dayOfWeek 대응)
                if (lessons && Array.isArray(lessons)) {
                    lessons.forEach(lesson => {
                        const lessonDay = lesson.day || lesson.dayOfWeek;
                        db.run(
                            `INSERT INTO member_lessons (member_id, name, day, time) VALUES (?, ?, ?, ?)`,
                            [memberId, name, lessonDay, lesson.time]
                        );
                    });

                    // 3. passes (이용권) 자동 생성 (주당 횟수 * 4주)
                    const weeklyCount = lessons.length;
                    const totalPassCount = weeklyCount * 4;
                    const todayStr = new Date().toISOString().split('T')[0];

                    db.run(
                        `INSERT INTO passes (member_id, name, total, used, remaining, status, registeredAt) VALUES (?, ?, ?, 0, ?, '이용중', ?)`,
                        [memberId, name, totalPassCount, totalPassCount, todayStr]
                    );

                    // 4. schedules (스케줄표) 자동 생성 (4주치 미래 날짜 계산)
                    lessons.forEach(lesson => {
                        const lessonDay = lesson.day || lesson.dayOfWeek;
                        const targetDayIndex = dayMap[lessonDay];
                        if (targetDayIndex !== undefined) {
                            let currentDate = new Date();
                            for (let week = 0; week < 4; week++) {
                                let calcDate = getNextDayOfWeek(currentDate, targetDayIndex, week);
                                let dateString = calcDate.toISOString().split('T')[0];

                                db.run(
                                    `INSERT INTO schedules (date, time, member_id, name, status, note) VALUES (?, ?, ?, ?, '예약', ?)`,
                                    [dateString, lesson.time, memberId, name, '정규 레슨']
                                );
                            }
                        }
                    });
                }

                res.json({ success: true, memberId });
            }
        );
    } else if (action === 'updateSchedule') {
        const { date, time, name, status } = req.body.schedule;
        db.get(`SELECT id FROM schedules WHERE date = ? AND time = ? AND name = ?`, [date, time, name], (err, row) => {
            if (row) {
                db.run(`UPDATE schedules SET status = ? WHERE id = ?`, [status, row.id], function () {
                    res.json({ success: true });
                });
            } else {
                db.run(`INSERT INTO schedules (date, time, name, status) VALUES (?, ?, ?, ?)`, [date, time, name, status || '예약'], function () {
                    res.json({ success: true });
                });
            }
        });
    } else if (action === 'deleteSchedule') {
        const { date, time, name } = req.body.schedule;
        db.run(`DELETE FROM schedules WHERE date = ? AND time = ? AND name = ?`, [date, time, name], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    } else {
        res.json({ success: true });
    }
});

app.listen(PORT, () => {
    console.log(`백엔드 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});