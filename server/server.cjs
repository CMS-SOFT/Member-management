const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// SQLite 데이터베이스 파일 연결[cite: 2]
const dbFile = path.resolve(__dirname, 'member_management.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('❌ 데이터베이스 연결 실패:', err.message);
    } else {
        console.log('✅ SQLite DB 연결 성공:', dbFile);
    }
});

// 요일 문자열을 숫자로 매핑 (일요일: 0 ~ 토요일: 6)[cite: 2]
const dayMap = {
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3,
    '목요일': 4, '금요일': 5, '토요일': 6
};

// 특정 요일의 다가오는 날짜를 구하는 함수[cite: 2]
function getNextDayOfWeek(startDate, dayOfWeek, weekOffset) {
    let resultDate = new Date(startDate.getTime());
    let currentDay = resultDate.getDay();
    let distance = (dayOfWeek + 7 - currentDay) % 7;
    resultDate.setDate(resultDate.getDate() + distance + (weekOffset * 7));
    return resultDate;
}

/**
 * [MSA 지향 모듈 함수] 레슨 중복 및 유형 정합성 검사 함수
 * @param {Object} db - SQLite DB 인스턴스
 * @param {string} date - 검사할 날짜 (YYYY-MM-DD)
 * @param {string} time - 검사할 시간 (HH:MM)
 * @param {string} newLessonType - 새로 등록할 레슨 유형 ('개인' 또는 '단체')
 * @param {Function} callback - 결과 처리 콜백 (err, result)
 */
/**
 * [MSA 지향 모듈 함수] 레슨 중복 및 유형 정합성 검사 함수 (회원명 포함)
 */
function checkLessonAvailability(db, date, time, newLessonType, newMemberName, callback) {
    const query = `
        SELECT s.id, s.member_id, s.name as schedule_name, m.lessonType, m.name as member_name 
        FROM schedules s 
        LEFT JOIN members m ON s.member_id = m.id 
        WHERE s.date = ? AND s.time = ?
    `;
    db.all(query, [date, time], (err, existingLessons) => {
        if (err) return callback(err, null);

        // 1. 해당 시간대에 조회가 없으면 다음 단계로 정상 진행
        if (!existingLessons || existingLessons.length === 0) {
            return callback(null, { allowed: true });
        }

        // 2. 조회가 되었을 때 기존 레슨이 '개인' 레슨을 포함하는지 확인
        const hasPersonal = existingLessons.some(lesson => (lesson.lessonType || '개인') === '개인');
        if (hasPersonal) {
            const existingName = existingLessons[0].member_name || existingLessons[0].schedule_name || '기존 회원';
            return callback(null, {
                allowed: false,
                error: `${date} ${time}\n ${existingName}님의 개인레슨이 존재합니다.`
            });
        }

        // 3. 조회가 되었고 기존 레슨이 모두 '단체' 레슨인 경우
        if (newLessonType !== '단체') {
            return callback(null, {
                allowed: false,
                error: `${newMemberName || '신규회원'}님, 단체레슨만 등록 가능합니다.`
            });
        }

        // 기존도 단체이고 새로 등록하려는 것도 단체인 경우는 허용
        return callback(null, { allowed: true });
    });
}

// 테이블 초기화[cite: 2]
db.serialize(() => {
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

    db.run(`CREATE TABLE IF NOT EXISTS member_lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        name TEXT NOT NULL,
        day TEXT NOT NULL,
        time TEXT NOT NULL
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        name TEXT NOT NULL,
        amount INTEGER DEFAULT 0,
        type TEXT,
        date TEXT NOT NULL,
        note TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT,
        isRead INTEGER DEFAULT 0,
        createdAt TEXT
    )`);
});

// 공통 데이터 조회[cite: 2]
const sendFreshData = (res, extraData = {}) => {
    db.all(`SELECT * FROM members`, [], (err, members) => {
        db.all(`SELECT * FROM member_lessons`, [], (err, member_lessons) => {
            db.all(`SELECT * FROM passes`, [], (err, passes) => {
                db.all(`SELECT s.* FROM schedules s 
                        LEFT JOIN passes p ON s.member_id = p.member_id 
                        WHERE p.status = '이용중' OR s.member_id IS NULL`, [], (err, schedules) => {
                    db.all(`SELECT * FROM settlements`, [], (err, settlements) => {
                        db.all(`SELECT * FROM notifications`, [], (err, notifications) => {
                            res.json({
                                success: true,
                                members,
                                member_lessons,
                                passes,
                                schedules,
                                settlements,
                                notifications,
                                ...extraData
                            });
                        });
                    });
                });
            });
        });
    });
};

// 1. 전체 데이터 초기 로딩 API[cite: 2]
app.get('/api/bootstrap', (req, res) => {
    sendFreshData(res);
});

// 2. 통합 API 액션 처리 (/api/action)[cite: 2]
app.post('/api/action', (req, res) => {
    const { action, member, schedule } = req.body;

    if (action === 'appendMember') {
        if (!member) {
            return res.status(400).json({ success: false, error: 'member data is missing' });
        }

        const { name, birth, phone, gender, level, lessonType = '개인', lessons, startDate } = member;
        const role = '사용자';
        const status = '등록';
        const lessonList = Array.isArray(lessons) ? lessons : [];

        // 1️⃣ 입력받은 레슨 목록 내 요일/시간 자체 중복 체크
        const lessonCheckSet = new Set();
        for (const lesson of lessonList) {
            const lessonDay = lesson.day || lesson.dayOfWeek;
            const key = `${lessonDay}_${lesson.time}`;
            if (lessonCheckSet.has(key)) {
                return res.status(400).json({
                    success: false,
                    error: '레슨일정이 중복되었습니다.'
                });
            }
            lessonCheckSet.add(key);
        }

        // 2️⃣ 등록 예정 스케줄 목록 생성
        const baseStartDate = startDate ? new Date(startDate) : new Date();
        const plannedSchedules = [];

        if (lessonList.length > 0) {
            for (const lesson of lessonList) {
                const lessonDay = lesson.day || lesson.dayOfWeek;
                const targetDayIndex = dayMap[lessonDay];
                if (targetDayIndex !== undefined) {
                    for (let week = 0; week < 4; week++) {
                        let calcDate = getNextDayOfWeek(baseStartDate, targetDayIndex, week);
                        let dateString = calcDate.toISOString().split('T')[0];
                        plannedSchedules.push({ date: dateString, time: lesson.time });
                    }
                }
            }
        }

        // 3️⃣ 분리된 함수를 호출하여 각 스케줄별 충돌/유형 검사 수행
        let checkConflictQuery = (index) => {
            if (index >= plannedSchedules.length) {
                executeInsert();
                return;
            }

            const ps = plannedSchedules[index];
            checkLessonAvailability(db, ps.date, ps.time, lessonType, name, (err, validation) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                if (!validation.allowed) {
                    return res.status(400).json({ success: false, error: validation.error });
                }
                checkConflictQuery(index + 1);
            });
        };

        checkConflictQuery(0);

        function executeInsert() {
            const memberQuery = `INSERT INTO members (name, birth, phone, gender, level, lessonType, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            const memberParams = [name, birth, phone, gender || '남', level || '입문', lessonType, role, status];

            db.run(memberQuery, memberParams, function (err) {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                const memberId = this.lastID;

                lessonList.forEach(lesson => {
                    const lessonDay = lesson.day || lesson.dayOfWeek;
                    const lessonQuery = `INSERT INTO member_lessons (member_id, name, day, time) VALUES (?, ?, ?, ?)`;
                    db.run(lessonQuery, [memberId, name, lessonDay, lesson.time]);
                });

                const weeklyCount = lessonList.length > 0 ? lessonList.length : 3;
                const totalPassCount = weeklyCount * 4;
                const todayStr = baseStartDate.toISOString().split('T')[0];

                const passQuery = `INSERT INTO passes (member_id, name, total, used, remaining, status, registeredAt) VALUES (?, ?, ?, 0, ?, '이용중', ?)`;
                db.run(passQuery, [memberId, name, totalPassCount, totalPassCount, todayStr], (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, error: err.message });
                    }

                    plannedSchedules.forEach(ps => {
                        const schedQuery = `INSERT INTO schedules (date, time, member_id, name, status, note) VALUES (?, ?, ?, ?, '예약', ?)`;
                        db.run(schedQuery, [ps.date, ps.time, memberId, name, '정규 레슨']);
                    });

                    setTimeout(() => sendFreshData(res, { memberId }), 150);
                });
            });
        }
    } else if (action === 'updateSchedule') {
        if (!schedule) return res.status(400).json({ success: false, error: 'schedule data is missing' });
        const { date, time, name, status, member_id, lessonType = '개인' } = schedule;

        // 스케줄 수정/추가 시에도 동일한 분리된 함수 사용
        checkLessonAvailability(db, date, time, lessonType, (err, validation) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            // 본인 스케줄 변경인 경우는 제외하고 체크해야 하므로 추가 예외 처리가 필요할 수 있으나 기본 규칙 적용
            if (!validation.allowed) {
                return res.status(400).json({ success: false, error: validation.error });
            }

            db.get(`SELECT id FROM schedules WHERE date = ? AND time = ? AND name = ?`, [date, time, name], (err, row) => {
                if (row) {
                    db.run(`UPDATE schedules SET status = ? WHERE id = ?`, [status, row.id], () => {
                        sendFreshData(res);
                    });
                } else {
                    db.run(`INSERT INTO schedules (date, time, member_id, name, status) VALUES (?, ?, ?, ?, ?)`, [date, time, member_id, name, status || '예약'], () => {
                        sendFreshData(res);
                    });
                }
            });
        });
    } else if (action === 'deleteSchedule') {
        if (!schedule) return res.status(400).json({ success: false, error: 'schedule data is missing' });
        const { date, time, name } = schedule;

        db.run(`DELETE FROM schedules WHERE date = ? AND time = ? AND name = ?`, [date, time, name], () => {
            sendFreshData(res);
        });
    } else if (action === 'cancelPass' || action === 'expirePass') {
        const { memberId } = req.body;
        db.run(`UPDATE passes SET status = '만료' WHERE member_id = ?`, [memberId], () => {
            db.run(`DELETE FROM schedules WHERE member_id = ? AND status = '예약'`, [memberId], () => {
                sendFreshData(res);
            });
        });
    } else if (action === 'clear') {
        db.serialize(() => {
            db.run(`DELETE FROM schedules`);
            db.run(`DELETE FROM passes`);
            db.run(`DELETE FROM member_lessons`);
            db.run(`DELETE FROM settlements`);
            db.run(`DELETE FROM notifications`);
            db.run(`DELETE FROM members WHERE role != '관리자'`, () => {
                sendFreshData(res);
            });
        });
    } else {
        sendFreshData(res);
    }
});

// 3. 회원 및 이용권 관리용 일괄 처리 엔드포인트[cite: 2]
app.post('/api/members/replace', (req, res) => {
    const { members } = req.body;
    db.serialize(() => {
        db.run(`DELETE FROM members WHERE role != '관리자'`, () => {
            const stmt = db.prepare(`INSERT INTO members (name, birth, phone, gender, level, lessonType, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            (members || []).forEach(m => {
                stmt.run([m.name, m.birth || '', m.phone || '', m.gender || '남', m.level || '입문', m.lessonType || '개인', m.role || '사용자', m.status || '등록']);
            });
            stmt.finalize(() => {
                res.json({ success: true });
            });
        });
    });
});

app.post('/api/passes/replace', (req, res) => {
    const { passes } = req.body;
    db.serialize(() => {
        db.run(`DELETE FROM passes`, () => {
            const stmt = db.prepare(`INSERT INTO passes (member_id, name, total, used, remaining, status, registeredAt) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            (passes || []).forEach(p => {
                stmt.run([p.member_id || null, p.name, p.total || 0, p.used || 0, p.remaining || 0, p.status || '이용중', p.registeredAt || '']);
            });
            stmt.finalize(() => {
                res.json({ success: true });
            });
        });
    });
});

app.post('/api/schedules/delete-batch', (req, res) => {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.json({ success: true });
    db.run(`DELETE FROM schedules WHERE id IN (${ids.map(() => '?').join(',')})`, ids, () => {
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`백엔드 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});