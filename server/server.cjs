const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// SQLite 데이터베이스 파일 경로 및 sql.js 인스턴스 초기화
const dbFile = process.env.MEMBER_MANAGEMENT_DB_PATH
    ? path.resolve(process.env.MEMBER_MANAGEMENT_DB_PATH)
    : path.resolve(__dirname, 'member_management.db');
let db = null;
let SQL = null;
let rawDb = null;
let transactionDepth = 0;

const ARCHIVE_TABLES = [
    { name: 'members', label: '회원' },
    { name: 'member_lessons', label: '고정 레슨' },
    { name: 'passes', label: '이용권' },
    { name: 'schedules', label: '레슨 일정' },
    { name: 'settlements', label: '정산' },
    { name: 'notifications', label: '알림' },
];
const ARCHIVE_RETENTION_YEARS = 5;

function saveDb() {
    if (!rawDb) return;
    const temporaryPath = `${dbFile}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    try {
        fs.writeFileSync(temporaryPath, Buffer.from(rawDb.export()));
        fs.renameSync(temporaryPath, dbFile);
    } catch (error) {
        try {
            if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
        } catch (cleanupError) {
            console.error('임시 DB 파일 정리에 실패했습니다:', cleanupError);
        }
        throw error;
    }
}

function createDatabaseAdapter(database) {
    const readRows = (query, params = []) => {
        const statement = database.prepare(query);
        const rows = [];
        try {
            statement.bind(params);
            while (statement.step()) rows.push(statement.getAsObject());
        } finally {
            statement.free();
        }
        return rows;
    };

    const run = (query, params, callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        const sql = String(query).trim();
        let lastID = null;
        try {
            database.run(query, params || []);
            if (/^\s*INSERT\b/i.test(sql)) {
                lastID = readRows('SELECT last_insert_rowid() AS id')[0]?.id ?? null;
            }

            if (/^(BEGIN)\b/i.test(sql)) {
                transactionDepth += 1;
            } else if (/^(COMMIT|END)\b/i.test(sql)) {
                transactionDepth = Math.max(0, transactionDepth - 1);
            } else if (/^ROLLBACK\b/i.test(sql)) {
                transactionDepth = 0;
            }
            if (transactionDepth === 0 && !/^(BEGIN|ROLLBACK)\b/i.test(sql)) saveDb();
        } catch (error) {
            if (typeof callback === 'function') return callback(error);
            throw error;
        }
        if (typeof callback === 'function') callback.call({ lastID }, null);
    };

    return {
        serialize(callback) {
            callback();
        },
        run,
        all(query, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            let rows;
            try {
                rows = readRows(query, params || []);
            } catch (error) {
                return callback(error, null);
            }
            callback(null, rows);
        },
        get(query, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            this.all(query, params || [], (error, rows) => callback(error, rows && rows[0]));
        },
        exec(query, callback) {
            if (typeof callback !== 'function') return database.exec(query);
            try {
                database.exec(query);
                const sql = String(query).trim();
                if (/\bROLLBACK\b/i.test(sql)) transactionDepth = 0;
                else if (/\b(COMMIT|END)\b/i.test(sql)) transactionDepth = 0;
                else if (/\bBEGIN\b/i.test(sql)) transactionDepth += 1;
                if (transactionDepth === 0) saveDb();
            } catch (error) {
                return callback(error);
            }
            callback(null);
        },
        export() {
            return database.export();
        },
        close(callback) {
            database.close();
            rawDb = null;
            if (typeof callback === 'function') callback(null);
        },
    };
}

function dbAll(query, params = [], callback) {
    db.all(query, params, callback);
}

function dbGet(query, params = [], callback) {
    db.get(query, params, callback);
}

function dbRun(query, params = [], callback) {
    db.run(query, params, callback);
}

function dbExec(query, callback) {
    db.exec(query, callback);
}

function dbTransaction(work, callback) {
    let transactionError = null;
    try {
        db.run('BEGIN TRANSACTION');
        work(db);
        db.run('COMMIT');
    } catch (error) {
        transactionError = error;
        try {
            db.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('트랜잭션 롤백 실패:', rollbackError.message);
        }
    }
    callback(transactionError);
}

function dbPrepare(query) {
    return {
        run(params = [], callback) {
            dbRun(query, params, callback);
        },
        finalize(callback) {
            if (typeof callback === 'function') callback(null);
        },
    };
}

function addColumnIfMissing(table, column, definition) {
    dbAll(`PRAGMA table_info(${table})`, [], (error, columns) => {
        if (error) throw error;
        if (columns.some((entry) => entry.name === column)) return;
        dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, [], (alterError) => {
            if (alterError) throw alterError;
        });
    });
}

function parseCsvRows(text) {
    const input = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < input.length; index += 1) {
        const character = input[index];
        if (quoted) {
            if (character === '"' && input[index + 1] === '"') {
                cell += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                cell += character;
            }
        } else if (character === '"' && cell.length === 0) {
            quoted = true;
        } else if (character === ',') {
            row.push(cell);
            cell = '';
        } else if (character === '\n' || character === '\r') {
            if (character === '\r' && input[index + 1] === '\n') index += 1;
            row.push(cell);
            if (row.some((value) => value !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += character;
        }
    }
    if (quoted) throw new Error('아카이브 CSV의 따옴표 형식이 올바르지 않습니다.');
    if (row.length || cell) {
        row.push(cell);
        if (row.some((value) => value !== '')) rows.push(row);
    }
    return rows;
}

function csvFileRows(filePath, columns, required = false) {
    if (!fs.existsSync(filePath)) {
        if (required) throw new Error(`아카이브 CSV 파일이 없습니다: ${filePath}`);
        return [];
    }
    const parsed = parseCsvRows(fs.readFileSync(filePath, 'utf8'));
    if (
        !parsed.length ||
        parsed[0].join('\0') !== columns.join('\0') ||
        parsed.slice(1).some((row) => row.length !== columns.length)
    ) {
        throw new Error(`아카이브 CSV의 열 구성이 올바르지 않습니다: ${filePath}`);
    }
    return parsed.slice(1).map((values) => Object.fromEntries(
        columns.map((column, index) => [column, values[index] ?? ''])
    ));
}

const retentionTables = ['members', 'member_lessons', 'passes', 'schedules', 'settlements', 'notifications'];
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const backupDirectory = path.join(localAppData, 'CourtMate', 'backups');
let retentionSweepRunning = false;
let activeRequestCount = 0;

app.use((req, res, next) => {
    if (retentionSweepRunning) {
        return res.status(503).json({ success: false, error: '데이터 보관 정리 중입니다. 잠시 후 다시 시도해 주세요.' });
    }
    activeRequestCount += 1;
    let released = false;
    const releaseRequest = () => {
        if (released) return;
        released = true;
        activeRequestCount -= 1;
    };
    res.once('finish', releaseRequest);
    res.once('close', releaseRequest);
    next();
});

// 요일 문자열을 숫자로 매핑 (일요일: 0 ~ 토요일: 6)[cite: 2]
const dayMap = {
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3,
    '목요일': 4, '금요일': 5, '토요일': 6
};

// 특정 요일의 다가오는 날짜를 구하는 함수
function getNextDayOfWeek(startDate, dayOfWeek, weekOffset) {
    let resultDate = new Date(startDate.getTime());
    let currentDay = resultDate.getDay();
    let distance = (dayOfWeek + 7 - currentDay) % 7;
    resultDate.setDate(resultDate.getDate() + distance + (weekOffset * 7));
    return resultDate;
}

const GROUP_LESSON_LIMIT = 2;

function toYmd(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 레슨 중복 및 유형 정합성 검사
 */
function checkLessonAvailability(date, time, newLessonType, newMemberName, callback, options = {}) {
    const query = `
        SELECT s.id, s.member_id, s.name as schedule_name, m.lessonType, m.name as member_name
        FROM schedules s
        LEFT JOIN members m ON s.member_id = m.id
        WHERE s.date = ? AND s.time = ? AND s.use_flag = 'Y'
    `;
    dbAll(query, [date, time], (err, existingLessons) => {
        if (err) return callback(err, null);

        let lessons = existingLessons || [];
        if (options.excludeScheduleId != null) {
            lessons = lessons.filter((lesson) => String(lesson.id) !== String(options.excludeScheduleId));
        }
        if (newMemberName) {
            lessons = lessons.filter((lesson) => (lesson.member_name || lesson.schedule_name) !== newMemberName);
        }

        if (lessons.length === 0) {
            return callback(null, { allowed: true });
        }

        const hasPersonal = lessons.some((lesson) => (lesson.lessonType || '개인') === '개인');
        if (hasPersonal) {
            const existingName = lessons[0].member_name || lessons[0].schedule_name || '기존 회원';
            return callback(null, {
                allowed: false,
                error: `${date} ${time}\n ${existingName}님의 개인레슨이 존재합니다.`
            });
        }

        if (newLessonType !== '단체') {
            return callback(null, {
                allowed: false,
                error: `${newMemberName || '신규회원'}님, 단체레슨만 등록 가능합니다.`
            });
        }

        if (lessons.length >= GROUP_LESSON_LIMIT) {
            return callback(null, {
                allowed: false,
                error: '시간대에 단체레슨 인원만료로 이용불가합니다.'
            });
        }

        return callback(null, { allowed: true });
    });
}

// 테이블 초기화[cite: 2]
function initTables() {
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
        status TEXT DEFAULT '등록',
        retentionAt TEXT
    )`);
    addColumnIfMissing('members', 'use_flag', "CHAR(1) DEFAULT 'Y'");

    db.run(`CREATE TABLE IF NOT EXISTS member_lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        name TEXT NOT NULL,
        day TEXT NOT NULL,
        time TEXT NOT NULL,
        retentionAt TEXT
    )`);
    addColumnIfMissing('member_lessons', 'use_flag', "CHAR(1) DEFAULT 'Y'");
    addColumnIfMissing('member_lessons', 'date', 'TEXT');

    db.run(`CREATE TABLE IF NOT EXISTS passes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        name TEXT NOT NULL,
        total INTEGER DEFAULT 0,
        used INTEGER DEFAULT 0,
        remaining INTEGER DEFAULT 0,
        status TEXT DEFAULT '이용중',
        registeredAt TEXT,
        retentionAt TEXT
    )`);
    addColumnIfMissing('passes', 'use_flag', "CHAR(1) DEFAULT 'Y'");

    db.run(`CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        member_id INTEGER,
        name TEXT NOT NULL,
        status TEXT DEFAULT '예약',
        note TEXT,
        passId TEXT,
        retentionAt TEXT
    )`);
    addColumnIfMissing('schedules', 'use_flag', "CHAR(1) DEFAULT 'Y'");

    db.run(`CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        name TEXT NOT NULL,
        amount INTEGER DEFAULT 0,
        type TEXT,
        date TEXT NOT NULL,
        note TEXT,
        retentionAt TEXT
    )`);
    addColumnIfMissing('settlements', 'use_flag', "CHAR(1) DEFAULT 'Y'");
    dbRun(`CREATE INDEX IF NOT EXISTS idx_settlements_active_date
        ON settlements(use_flag, date, member_id)`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT,
        isRead INTEGER DEFAULT 0,
        createdAt TEXT,
        retentionAt TEXT
    )`);
    addColumnIfMissing('notifications', 'use_flag', "CHAR(1) DEFAULT 'Y'");
    });
}

const ensureRetentionSchema = (callback) => {
    const ensureTableColumn = (tableIndex) => {
        if (tableIndex >= retentionTables.length) return stampLegacyRows(0);
        const table = retentionTables[tableIndex];
        db.all(`PRAGMA table_info(${table})`, [], (error, columns) => {
            if (error) return callback(error);
            if (columns.some((column) => column.name === 'retentionAt')) {
                return ensureTableColumn(tableIndex + 1);
            }
            db.run(`ALTER TABLE ${table} ADD COLUMN retentionAt TEXT`, (alterError) => {
                if (alterError) return callback(alterError);
                ensureTableColumn(tableIndex + 1);
            });
        });
    };

    const stampLegacyRows = (tableIndex) => {
        if (tableIndex >= retentionTables.length) return createRetentionTriggers(0);
        const table = retentionTables[tableIndex];
        db.run(
            `UPDATE ${table} SET retentionAt = ? WHERE retentionAt IS NULL OR TRIM(retentionAt) = ''`,
            [new Date().toISOString()],
            (error) => {
                if (error) return callback(error);
                stampLegacyRows(tableIndex + 1);
            }
        );
    };

    const createRetentionTriggers = (tableIndex) => {
        if (tableIndex >= retentionTables.length) return callback(null);
        const table = retentionTables[tableIndex];
        db.run(
            `CREATE TRIGGER IF NOT EXISTS ${table}_retention_timestamp
             AFTER INSERT ON ${table}
             WHEN NEW.retentionAt IS NULL OR TRIM(NEW.retentionAt) = ''
             BEGIN
                 UPDATE ${table}
                 SET retentionAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = NEW.id;
             END`,
            (error) => {
                if (error) return callback(error);
                db.run(`CREATE INDEX IF NOT EXISTS idx_${table}_retention_at ON ${table}(retentionAt)`, (indexError) => {
                    if (indexError) return callback(indexError);
                    createRetentionTriggers(tableIndex + 1);
                });
            }
        );
    };

    ensureTableColumn(0);
};

const createDailyBackup = async () => {
    await fs.promises.mkdir(backupDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const destination = path.join(backupDirectory, `member_management-${date}.db`);
    try {
        const existing = await fs.promises.stat(destination);
        if (existing.isFile() && existing.size > 0) return;
        await fs.promises.unlink(destination);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    const temporary = `${destination}.${process.pid}.tmp`;
    try {
        await fs.promises.unlink(temporary);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    await fs.promises.writeFile(temporary, Buffer.from(db.export()));
    const completed = await fs.promises.stat(temporary);
    if (!completed.isFile() || completed.size === 0) {
        throw new Error('백업 파일이 비어 있어 보관 정리를 중단했습니다.');
    }
    await fs.promises.rename(temporary, destination);
};

const purgeExpiredRows = (cutoff) => new Promise((resolve, reject) => {
    const cutoffLiteral = `'${cutoff.toISOString()}'`;
    const memberHasRecentChildren = [
        ['member_lessons', 'member_id'],
        ['passes', 'member_id'],
        ['schedules', 'member_id'],
        ['settlements', 'member_id'],
    ].map(([table, memberColumn]) => (
        `NOT EXISTS (
            SELECT 1 FROM ${table} child
            WHERE child.${memberColumn} = members.id
               OR (child.${memberColumn} IS NULL AND child.name = members.name)
        )`
    )).join(' AND ');

    db.exec(
        `BEGIN IMMEDIATE;
         DELETE FROM notifications WHERE retentionAt < ${cutoffLiteral};
         DELETE FROM schedules WHERE retentionAt < ${cutoffLiteral};
         DELETE FROM member_lessons WHERE retentionAt < ${cutoffLiteral};
         DELETE FROM settlements WHERE retentionAt < ${cutoffLiteral};
         DELETE FROM passes
          WHERE retentionAt < ${cutoffLiteral}
            AND NOT EXISTS (
                SELECT 1 FROM schedules
                WHERE schedules.passId = CAST(passes.id AS TEXT)
                  AND schedules.retentionAt >= ${cutoffLiteral}
            );
         DELETE FROM members
          WHERE COALESCE(role, '') != '관리자'
            AND retentionAt < ${cutoffLiteral}
            AND ${memberHasRecentChildren};
         COMMIT;`,
        (error) => {
            if (!error) return resolve();
            db.exec('ROLLBACK;', () => reject(error));
        }
    );
});

const purgeExpiredBackups = async (cutoff) => {
    const entries = await fs.promises.readdir(backupDirectory, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile() || !/^member_management-\d{4}-\d{2}-\d{2}\.db$/.test(entry.name)) continue;
        const filePath = path.join(backupDirectory, entry.name);
        const stats = await fs.promises.stat(filePath);
        if (stats.mtime < cutoff) await fs.promises.unlink(filePath);
    }
};

const runRetentionSweep = async () => {
    if (retentionSweepRunning) return;
    if (activeRequestCount > 0) {
        const retry = setTimeout(runRetentionSweep, 60 * 1000);
        retry.unref();
        return;
    }
    retentionSweepRunning = true;
    try {
        await createDailyBackup();
        const cutoff = new Date();
        cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
        await purgeExpiredRows(cutoff);
        await purgeExpiredBackups(cutoff);
        console.log(`✅ 2년 보관 정리 완료 (기준: ${cutoff.toISOString()})`);
    } catch (error) {
        console.error('❌ 2년 보관 정리 실패. 데이터 삭제는 백업 성공 후에만 수행됩니다:', error.message);
    } finally {
        retentionSweepRunning = false;
    }
};

// 공통 데이터 조회[cite: 2]
const sendFreshData = (res, extraData = {}) => {
    dbAll(`SELECT * FROM members WHERE use_flag = 'Y'`, [], (err, members) => {
        dbAll(`SELECT * FROM member_lessons WHERE use_flag = 'Y'`, [], (err, member_lessons) => {
            dbAll(`SELECT * FROM passes WHERE use_flag = 'Y'`, [], (err, passes) => {
                dbAll(`
                    SELECT s.* FROM schedules s
                    LEFT JOIN members m ON s.member_id = m.id
                    WHERE s.use_flag = 'Y'
                      AND (m.id IS NULL OR (m.use_flag = 'Y' AND m.status != '탈퇴'))
                `, [], (err, schedules) => {
                    dbAll(`SELECT * FROM settlements WHERE use_flag = 'Y'`, [], (err, settlements) => {
                        dbAll(`SELECT * FROM notifications WHERE use_flag = 'Y'`, [], (err, notifications) => {
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

function refreshPassUsage(passId, callback) {
    if (!passId) return callback(null, null);
    dbGet(`SELECT id,name,total,used,remaining,status FROM passes WHERE id=? AND use_flag='Y'`, [passId], (passError, pass) => {
        if (passError) return callback(passError);
        if (!pass) return callback(null, null);
        dbGet(
            `SELECT COUNT(*) AS used FROM schedules WHERE passId=? AND use_flag='Y' AND status='완료'`,
            [passId],
            (scheduleError, result) => {
                if (scheduleError) return callback(scheduleError);
                const used = Number(result?.used || 0);
                const total = Number(pass.total || 0);
                const remaining = Math.max(total - used, 0);
                const status = remaining > 0 ? '이용중' : '완료';
                dbRun(
                    `UPDATE passes SET used=?,remaining=?,status=? WHERE id=? AND use_flag='Y'`,
                    [used, remaining, status, passId],
                    (updateError) => {
                        if (updateError) return callback(updateError);
                        const changed = Number(pass.used) !== used ||
                            Number(pass.remaining) !== remaining ||
                            pass.status !== status;
                        callback(null, changed ? { ...pass, used, remaining, status } : null);
                    }
                );
            }
        );
    });
}

function backfillPassScheduleLinks(callback) {
    dbAll(`SELECT id,member_id,name,total,registeredAt FROM passes WHERE use_flag='Y' ORDER BY registeredAt,id`, [], (passError, passes) => {
        if (passError) return callback(passError);
        dbAll(`SELECT id,member_id,name,date,passId FROM schedules WHERE use_flag='Y' ORDER BY date,time,id`, [], (scheduleError, schedules) => {
            if (scheduleError) return callback(scheduleError);

            const passGroups = new Map();
            const usedCounts = new Map();
            const memberKey = (row) => row.member_id != null ? `id:${row.member_id}` : `name:${row.name}`;
            passes.forEach((pass) => {
                const key = memberKey(pass);
                if (!passGroups.has(key)) passGroups.set(key, []);
                passGroups.get(key).push(pass);
            });

            const assignments = new Map();
            schedules.forEach((schedule) => {
                if (schedule.passId != null && schedule.passId !== '') {
                    const count = usedCounts.get(String(schedule.passId)) || 0;
                    usedCounts.set(String(schedule.passId), count + 1);
                    return;
                }
                if (!schedule.date) return;
                const candidates = passGroups.get(memberKey(schedule)) || [];
                const eligible = candidates.filter((pass) => {
                    const startDate = String(pass.registeredAt || '').slice(0, 10);
                    return startDate && startDate <= String(schedule.date).slice(0, 10);
                });
                if (!eligible.length) return;
                const latestStart = eligible.reduce((latest, pass) => {
                    const startDate = String(pass.registeredAt).slice(0, 10);
                    return startDate > latest ? startDate : latest;
                }, '');
                const pass = eligible
                    .filter((candidate) => String(candidate.registeredAt).slice(0, 10) === latestStart)
                    .sort((a, b) => Number(a.id) - Number(b.id))[0];
                const assignedCount = usedCounts.get(String(pass.id)) || 0;
                if (assignedCount >= Number(pass.total || 0)) return;
                if (!assignments.has(pass.id)) assignments.set(pass.id, []);
                assignments.get(pass.id).push(schedule.id);
                usedCounts.set(String(pass.id), assignedCount + 1);
            });

            if (!assignments.size) return callback(null);
            dbTransaction((database) => {
                assignments.forEach((scheduleIds, passId) => {
                    scheduleIds.forEach((scheduleId) => {
                        database.run(
                            `UPDATE schedules SET passId=? WHERE id=? AND (passId IS NULL OR passId='')`,
                            [passId, scheduleId]
                        );
                    });
                });
            }, (transactionError) => {
                if (transactionError) return callback(transactionError);
                const passIds = Array.from(assignments.keys());
                const refreshNext = (index) => {
                    if (index >= passIds.length) return callback(null);
                    refreshPassUsage(passIds[index], (usageError) => {
                        if (usageError) return callback(usageError);
                        refreshNext(index + 1);
                    });
                };
                refreshNext(0);
            });
        });
    });
}

function clearAllUserData(callback) {
    const transaction = `
        BEGIN TRANSACTION;
        DELETE FROM schedules;
        DELETE FROM passes;
        DELETE FROM member_lessons;
        DELETE FROM settlements;
        DELETE FROM notifications;
        DELETE FROM members WHERE role IS NULL OR role != '관리자';
        COMMIT;
    `;
    dbExec(transaction, (err) => {
        if (!err) return callback(null);
        try { dbExec('ROLLBACK;'); } catch (e) { }
        callback(err);
    });
}

function rebuildDerivedTables(callback) {
    dbAll(`SELECT * FROM schedules WHERE use_flag='Y' ORDER BY date, time`, [], (err, schedules) => {
        dbAll(`SELECT * FROM members WHERE use_flag='Y' AND role != '관리자'`, [], (err, members) => {
            if (!schedules || schedules.length === 0) return callback();

            const memberMap = {};
            schedules.forEach((s) => {
                if (!s.name) return;
                if (!memberMap[s.name]) {
                    const m = members.find((x) => x.name === s.name) || {};
                    memberMap[s.name] = {
                        member_id: m.id || s.member_id || null,
                        name: s.name,
                        schedules: []
                    };
                }
                memberMap[s.name].schedules.push(s);
            });

            const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

            dbRun(`UPDATE member_lessons SET use_flag='N'`, [], () => {
                const lessonSeen = new Set();
                Object.values(memberMap).forEach(({ member_id, name, schedules: scs }) => {
                    scs.forEach((s) => {
                        const dateObj = new Date(`${s.date}T00:00:00`);
                        if (isNaN(dateObj.getTime())) return;
                        const day = dayNames[dateObj.getDay()];
                        const key = `${name}_${day}_${s.time}`;
                        if (!lessonSeen.has(key)) {
                            lessonSeen.add(key);
                            dbRun(
                                `INSERT INTO member_lessons (member_id,name,date,day,time,use_flag)
                                 VALUES (?,?,?,?,?,'Y')`,
                                [member_id, name, s.date, day, s.time]
                            );
                        }
                    });
                });

                dbRun(`UPDATE passes SET use_flag='N'`, [], () => {
                    Object.values(memberMap).forEach(({ member_id, name, schedules: scs }) => {
                        const total = scs.length;
                        const used = scs.filter((s) => s.status === '완료').length;
                        const remaining = Math.max(total - used, 0);
                        const status = remaining > 0 ? '이용중' : '완료';
                        const registeredAt = scs[0]?.date || toYmd(new Date());
                        dbRun(
                            `INSERT INTO passes (member_id,name,total,used,remaining,status,registeredAt,use_flag)
                             VALUES (?,?,?,?,?,?,?,'Y')`,
                            [member_id, name, total, used, remaining, status, registeredAt],
                            function (insertError) {
                                if (insertError) {
                                    console.error('이용권을 재생성하지 못했습니다:', insertError.message);
                                    return;
                                }
                                const passId = this.lastID;
                                const scheduleIds = scs.map((schedule) => schedule.id).filter((id) => id != null);
                                if (scheduleIds.length) {
                                    dbRun(
                                        `UPDATE schedules SET passId=? WHERE id IN (${scheduleIds.map(() => '?').join(',')})`,
                                        [passId, ...scheduleIds]
                                    );
                                }
                            }
                        );
                    });
                    setTimeout(callback, 150);
                });
            });
        });
    });
}

function rebuildDerivedTablesIfEmpty(callback) {
    dbGet(`SELECT COUNT(*) as cnt FROM passes WHERE use_flag='Y'`, [], (err, passRow) => {
        dbGet(`SELECT COUNT(*) as cnt FROM member_lessons WHERE use_flag='Y'`, [], (err, lessonRow) => {
            const isEmpty = (passRow?.cnt || 0) === 0 || (lessonRow?.cnt || 0) === 0;
            if (!isEmpty) return callback();
            rebuildDerivedTables(callback);
        });
    });
}

function startServer() {
    app.get('/api/archives', (req, res) => {
        const currentYear = new Date().getFullYear();
        const allowedYears = Array.from(
            { length: ARCHIVE_RETENTION_YEARS },
            (_, index) => currentYear - 2 - index
        );
        const requestedYear = req.query.year;
        if (requestedYear == null) {
            return res.json({ years: allowedYears });
        }

        const year = Number(requestedYear);
        if (!/^\d{4}$/.test(String(requestedYear)) || !allowedYears.includes(year)) {
            return res.status(400).json({ success: false, error: '조회할 수 없는 아카이브 연도입니다.' });
        }

        try {
            const yearPath = path.join(path.dirname(dbFile), 'archives', String(year));
            const hasArchive = fs.existsSync(yearPath);
            const tables = ARCHIVE_TABLES.map(({ name, label }) => {
                const columns = db.exec(`PRAGMA table_info(${name})`)[0]?.values.map((column) => column[1]) || [];
                const rows = hasArchive
                    ? csvFileRows(path.join(yearPath, `${name}.csv`), columns, true)
                    : [];
                return { name, label, columns, rows };
            });
            return res.json({ year, tables });
        } catch (err) {
            console.error(`❌ ${year}년 아카이브 조회에 실패했습니다:`, err);
            return res.status(500).json({ success: false, error: '아카이브 파일을 읽지 못했습니다.' });
        }
    });

    // ── 1. 전체 데이터 초기 로딩 ──────────────────────────────────────────
    app.get('/api/bootstrap', (req, res) => {
        rebuildDerivedTablesIfEmpty(() => {
            backfillPassScheduleLinks((err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                sendFreshData(res);
            });
        });
    });

    // ── 2. 통합 액션 처리 (/api/action) ──────────────────────────────────
    app.post('/api/action', (req, res) => {
        const { action, member, schedule } = req.body;

        if (action === 'appendMember') {
            if (!member) return res.status(400).json({ success: false, error: 'member data is missing' });

            const {
                name,
                birth,
                phone,
                gender,
                level,
                lessonType = '개인',
                status = '등록',
                includePass = true,
                lessons,
                startDate
            } = member;
            const lessonList = Array.isArray(lessons) ? lessons : [];
            const shouldCreatePass = includePass !== false;
            if (!['등록', '이용중', '탈퇴'].includes(status)) {
                return res.status(400).json({ success: false, error: '회원 상태를 확인해 주세요.' });
            }
            if (status === '탈퇴' && shouldCreatePass) {
                return res.status(400).json({ success: false, error: '탈퇴 회원에게 이용권을 함께 등록할 수 없습니다.' });
            }
            if (!shouldCreatePass && lessonList.length) {
                return res.status(400).json({ success: false, error: '이용권을 등록하지 않을 때는 레슨 일정을 함께 보낼 수 없습니다.' });
            }
            if (shouldCreatePass && lessonList.length > 4) {
                return res.status(400).json({ success: false, error: '레슨은 주 최대 4회까지 등록할 수 있습니다.' });
            }
            if (shouldCreatePass && (!lessonList.length || lessonList.some((lesson) =>
                dayMap[lesson.day || lesson.dayOfWeek] === undefined ||
                !/^([01]\d|2[0-3]):(00|20|40)$/.test(String(lesson.time || ''))
            ))) {
                return res.status(400).json({ success: false, error: '레슨 요일과 시간을 확인해 주세요.' });
            }

            const lessonCheckSet = new Set();
            if (shouldCreatePass) {
                for (const lesson of lessonList) {
                    const key = `${lesson.day || lesson.dayOfWeek}_${lesson.time}`;
                    if (lessonCheckSet.has(key)) {
                        return res.status(400).json({ success: false, error: '레슨일정이 중복되었습니다.' });
                    }
                    lessonCheckSet.add(key);
                }
            }

            const baseStartDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
            if (shouldCreatePass && (Number.isNaN(baseStartDate.getTime()) || (startDate && toYmd(baseStartDate) !== startDate))) {
                return res.status(400).json({ success: false, error: '레슨 시작일을 확인해 주세요.' });
            }
            const plannedSchedules = [];
            if (shouldCreatePass) {
                for (const lesson of lessonList) {
                    const lessonDay = lesson.day || lesson.dayOfWeek;
                    const targetDayIndex = dayMap[lessonDay];
                    if (targetDayIndex !== undefined) {
                        for (let week = 0; week < 4; week++) {
                            const calcDate = getNextDayOfWeek(baseStartDate, targetDayIndex, week);
                            plannedSchedules.push({ date: toYmd(calcDate), time: lesson.time, day: lessonDay });
                        }
                    }
                }
            }

            const checkConflict = (index) => {
                if (index >= plannedSchedules.length) { executeInsert(); return; }
                const ps = plannedSchedules[index];
                checkLessonAvailability(ps.date, ps.time, lessonType, name, (err, v) => {
                    if (err) return res.status(500).json({ success: false, error: err.message });
                    if (!v.allowed) return res.status(400).json({ success: false, error: v.error });
                    checkConflict(index + 1);
                });
            };
            checkConflict(0);

            function executeInsert() {
                let memberId;
                let passId = null;

                dbTransaction((database) => {
                    database.run(
                        `INSERT INTO members (name,birth,phone,gender,level,lessonType,role,status,use_flag)
                         VALUES (?,?,?,?,?,?,?,?,'Y')`,
                        [name, birth, phone, gender || '남', level || '입문', lessonType, '사용자', status]
                    );
                    memberId = database.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];

                    if (!shouldCreatePass) return;
                    lessonList.forEach((lesson) => {
                        database.run(
                            `INSERT INTO member_lessons (member_id,name,day,time,use_flag)
                             VALUES (?,?,?,?,'Y')`,
                            [memberId, name, lesson.day || lesson.dayOfWeek, lesson.time]
                        );
                    });

                    const totalPassCount = lessonList.length * 4;
                    database.run(
                        `INSERT INTO passes (member_id,name,total,used,remaining,status,registeredAt,use_flag)
                         VALUES (?,?,?,0,?,'이용중',?,'Y')`,
                        [memberId, name, totalPassCount, totalPassCount, toYmd(baseStartDate)]
                    );
                    passId = database.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];

                    plannedSchedules.forEach((plannedSchedule) => {
                        database.run(
                            `INSERT INTO schedules (date,time,member_id,name,status,note,passId,use_flag)
                             VALUES (?,?,?,?,'예약',?,?,'Y')`,
                            [plannedSchedule.date, plannedSchedule.time, memberId, name, '정규 레슨', passId]
                        );
                    });
                }, (err) => {
                    if (err) return res.status(500).json({ success: false, error: err.message });
                    sendFreshData(res, { memberId, ...(passId ? { passId } : {}) });
                });
            }

        } else if (action === 'updateSchedule') {
            if (!schedule) return res.status(400).json({ success: false, error: 'schedule data is missing' });
            const { date, time, name, status, member_id, id } = schedule;

            dbGet(`SELECT id, lessonType FROM members WHERE name=? AND use_flag='Y'`, [name], (memErr, mem) => {
                if (memErr) return res.status(500).json({ success: false, error: memErr.message });
                const lessonType = mem?.lessonType || schedule.lessonType || '개인';
                const resolvedMemberId = mem?.id || member_id || null;

                checkLessonAvailability(date, time, lessonType, name, (err, v) => {
                    if (err) return res.status(500).json({ success: false, error: err.message });
                    if (!v.allowed) return res.status(400).json({ success: false, error: v.error });

                    if (id) {
                        dbGet(`SELECT passId FROM schedules WHERE id=? AND use_flag='Y'`, [id], (lookupError, existingSchedule) => {
                            if (lookupError) return res.status(500).json({ success: false, error: lookupError.message });
                            dbRun(
                                `UPDATE schedules SET date=?, time=?, status=?, member_id=?, name=? WHERE id=? AND use_flag='Y'`,
                                [date, time, status || '예약', resolvedMemberId, name, id],
                                (updateError) => {
                                    if (updateError) return res.status(500).json({ success: false, error: updateError.message });
                                    refreshPassUsage(existingSchedule?.passId, (usageError, changedPass) => {
                                        if (usageError) return res.status(500).json({ success: false, error: usageError.message });
                                        sendFreshData(res, { changedPass });
                                    });
                                }
                            );
                        });
                        return;
                    }

                    dbGet(
                        `SELECT id,passId FROM schedules WHERE date=? AND time=? AND name=? AND use_flag='Y'`,
                        [date, time, name],
                        (err, row) => {
                            if (row) {
                                dbRun(`UPDATE schedules SET status=? WHERE id=?`, [status, row.id], (updateError) => {
                                    if (updateError) return res.status(500).json({ success: false, error: updateError.message });
                                    refreshPassUsage(row.passId, (usageError, changedPass) => {
                                        if (usageError) return res.status(500).json({ success: false, error: usageError.message });
                                        sendFreshData(res, { changedPass });
                                    });
                                });
                            } else {
                                dbGet(
                                    `SELECT id FROM passes
                                     WHERE member_id=? AND use_flag='Y' AND status='이용중' AND remaining>0
                                     ORDER BY registeredAt DESC,id DESC LIMIT 1`,
                                    [resolvedMemberId],
                                    (passError, activePass) => {
                                        if (passError) return res.status(500).json({ success: false, error: passError.message });
                                        dbRun(
                                            `INSERT INTO schedules (date,time,member_id,name,status,passId,use_flag)
                                             VALUES (?,?,?,?,?,?,'Y')`,
                                            [date, time, resolvedMemberId, name, status || '예약', activePass?.id || null],
                                            (insertError) => {
                                                if (insertError) return res.status(500).json({ success: false, error: insertError.message });
                                                sendFreshData(res);
                                            }
                                        );
                                    }
                                );
                            }
                        }
                    );
                }, { excludeScheduleId: id });
            });

        } else if (action === 'deleteSchedule') {
            if (!schedule) return res.status(400).json({ success: false, error: 'schedule data is missing' });
            const { date, time, name, id } = schedule;
            const deleteMatchingSchedule = (where, params) => {
                dbGet(`SELECT passId FROM schedules WHERE ${where} AND use_flag='Y'`, params, (lookupError, row) => {
                    if (lookupError) return res.status(500).json({ success: false, error: lookupError.message });
                    dbRun(`UPDATE schedules SET use_flag='N' WHERE ${where} AND use_flag='Y'`, params, (deleteError) => {
                        if (deleteError) return res.status(500).json({ success: false, error: deleteError.message });
                        refreshPassUsage(row?.passId, (usageError, changedPass) => {
                            if (usageError) return res.status(500).json({ success: false, error: usageError.message });
                            sendFreshData(res, { changedPass });
                        });
                    });
                });
            };
            if (id) deleteMatchingSchedule('id=?', [id]);
            else deleteMatchingSchedule('date=? AND time=? AND name=?', [date, time, name]);

        } else if (action === 'cancelPass' || action === 'expirePass') {
            const { memberId } = req.body;
            dbRun(`UPDATE passes SET status='만료' WHERE member_id=? AND use_flag='Y'`, [memberId], () => {
                dbRun(
                    `UPDATE schedules SET use_flag='N' WHERE member_id=? AND status='예약' AND use_flag='Y'`,
                    [memberId],
                    () => sendFreshData(res)
                );
            });

        } else if (action === 'deleteMember') {
            const memberId = member?.id;
            const memberName = member?.name || req.body.originalName;

            if (!memberId && !memberName) {
                return res.status(400).json({ success: false, error: 'member info is missing for deletion' });
            }

            const byId = !!memberId;
            const col = byId ? 'id' : 'name';
            const colRel = byId ? 'member_id' : 'name';
            const param = byId ? memberId : memberName;

            dbRun(`UPDATE members        SET use_flag='N' WHERE ${col}=?`, [param]);
            dbRun(`UPDATE member_lessons SET use_flag='N' WHERE ${colRel}=?`, [param]);
            dbRun(`UPDATE passes         SET use_flag='N' WHERE ${colRel}=?`, [param]);
            dbRun(`UPDATE schedules      SET use_flag='N' WHERE ${colRel}=?`, [param]);
            dbRun(`UPDATE settlements    SET use_flag='N' WHERE ${colRel}=?`, [param], () => {
                sendFreshData(res);
            });

        } else if (action === 'appendPass') {
            const { pass } = req.body;
            if (!pass) return res.status(400).json({ success: false, error: 'pass data is missing' });
            const { member_id, name, total, registeredAt, day, time } = pass;
            const passTotal = Number(total);
            const slots = Array.isArray(pass.slots) && pass.slots.length ? pass.slots : [{ day, time }];
            const baseDate = registeredAt ? new Date(`${registeredAt}T00:00:00`) : new Date();
            if (!member_id || !name || !Number.isInteger(passTotal) || passTotal <= 0 ||
                slots.length > 4 ||
                slots.some((slot) => dayMap[slot.day] === undefined || !/^([01]\d|2[0-3]):(00|20|40)$/.test(String(slot.time || ''))) ||
                Number.isNaN(baseDate.getTime())) {
                return res.status(400).json({ success: false, error: '이용권 횟수와 레슨 요일·시간을 확인해 주세요. 레슨 일정은 최대 4개까지 선택할 수 있어요.' });
            }

            const scheduledDates = [];
            for (let week = 0; scheduledDates.length < passTotal; week += 1) {
                slots.forEach((slot) => {
                    if (scheduledDates.length < passTotal) {
                        scheduledDates.push({
                            date: toYmd(getNextDayOfWeek(baseDate, dayMap[slot.day], week)),
                            time: slot.time,
                        });
                    }
                });
            }
            scheduledDates.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
            let passId;
            dbTransaction((database) => {
                database.run(
                    `INSERT INTO passes (member_id,name,total,used,remaining,status,registeredAt,use_flag)
                     VALUES (?,?,?,0,?,'이용중',?,'Y')`,
                    [member_id, name, passTotal, passTotal, registeredAt || toYmd(baseDate)]
                );
                passId = database.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
                scheduledDates.forEach(({ date, time }) => {
                    database.run(
                        `INSERT INTO schedules (date,time,member_id,name,status,note,passId,use_flag)
                         VALUES (?,?,?,?,'예약',?,?, 'Y')`,
                        [date, time, member_id, name, '정규 레슨', passId]
                    );
                });
            }, (err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                sendFreshData(res, { passId });
            });

        } else if (action === 'deletePass') {
            const { pass } = req.body;
            if (!pass?.id) return res.status(400).json({ success: false, error: 'pass id is missing' });
            dbGet(`SELECT id FROM passes WHERE id=? AND use_flag='Y'`, [pass.id], (findError, activePass) => {
                if (findError) return res.status(500).json({ success: false, error: findError.message });
                if (!activePass) return res.status(404).json({ success: false, error: '이용권을 찾을 수 없어요.' });
                dbTransaction((database) => {
                    database.run(`UPDATE schedules SET use_flag='N' WHERE passId=? AND use_flag='Y'`, [pass.id]);
                    database.run(`UPDATE passes SET use_flag='N' WHERE id=?`, [pass.id]);
                }, (err) => {
                    if (err) return res.status(500).json({ success: false, error: err.message });
                    sendFreshData(res);
                });
            });

        } else if (action === 'reregister') {
            const { memberId, name, total, startDate, registeredAt, slots, schedules: suppliedSchedules } = req.body;
            const passTotal = Number(total);
            const baseDate = new Date(`${startDate || registeredAt || toYmd(new Date())}T00:00:00`);
            const normalizedSchedules = Array.isArray(suppliedSchedules) && suppliedSchedules.length
                ? suppliedSchedules.slice(0, passTotal)
                : null;
            const slotList = Array.isArray(slots) ? slots : [];
            const planned = normalizedSchedules || [];

            if (!name || !Number.isInteger(passTotal) || passTotal <= 0 || Number.isNaN(baseDate.getTime())) {
                return res.status(400).json({ success: false, error: '회원, 이용권 횟수, 시작일을 확인해 주세요.' });
            }
            if (!normalizedSchedules) {
                if (!slotList.length || slotList.some((slot) => dayMap[slot.day] === undefined || !/^([01]\d|2[0-3]):(00|20|40)$/.test(String(slot.time || '')))) {
                    return res.status(400).json({ success: false, error: '레슨 요일과 시간을 확인해 주세요.' });
                }
                for (let week = 0; planned.length < passTotal; week += 1) {
                    slotList.forEach((slot) => {
                        if (planned.length < passTotal) {
                            planned.push({
                                date: toYmd(getNextDayOfWeek(baseDate, dayMap[slot.day], week)),
                                time: slot.time,
                            });
                        }
                    });
                }
            }
            if (planned.length !== passTotal || planned.some((schedule) =>
                !/^\d{4}-\d{2}-\d{2}$/.test(String(schedule.date || '')) ||
                !/^([01]\d|2[0-3]):(00|20|40)$/.test(String(schedule.time || ''))
            )) {
                return res.status(400).json({ success: false, error: '생성할 레슨 일정이 이용권 횟수와 일치하지 않거나 형식이 올바르지 않아요.' });
            }

            const createPass = (resolvedMemberId) => {
                let passId;
                dbTransaction((database) => {
                    database.run(
                        `INSERT INTO passes (member_id,name,total,used,remaining,status,registeredAt,use_flag)
                         VALUES (?,?,?,0,?,'이용중',?,'Y')`,
                        [resolvedMemberId, name, passTotal, passTotal, toYmd(baseDate)]
                    );
                    passId = database.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
                    planned.forEach((schedule) => {
                        database.run(
                            `INSERT INTO schedules (date,time,member_id,name,status,note,passId,use_flag)
                             VALUES (?,?,?,?,'예약',?,?, 'Y')`,
                            [schedule.date, schedule.time, resolvedMemberId, name, '정규 레슨', passId]
                        );
                    });
                }, (err) => {
                    if (err) return res.status(500).json({ success: false, error: err.message });
                    sendFreshData(res, { passId });
                });
            };

            if (memberId) {
                createPass(memberId);
            } else {
                dbGet(`SELECT id FROM members WHERE name=? AND use_flag='Y'`, [name], (err, memberRow) => {
                    if (err) return res.status(500).json({ success: false, error: err.message });
                    if (!memberRow) return res.status(404).json({ success: false, error: '회원을 찾을 수 없어요.' });
                    createPass(memberRow.id);
                });
            }

        } else if (action === 'updateMember') {
            const updatedMember = req.body.member;
            const originalName = req.body.originalName;
            if (!updatedMember) return res.status(400).json({ success: false, error: 'member data is missing' });
            const { id, name, birth, phone, gender, level, lessonType, status, history, lessons, startDate } = updatedMember;
            const nextStatus = history === '탈퇴' ? '탈퇴' : (status || '이용중');
            const lessonList = Array.isArray(lessons) ? lessons : null;

            const applyUpdate = (memberId) => {
                dbRun(
                    `UPDATE members SET name=?,birth=?,phone=?,gender=?,level=?,lessonType=?,status=?
                     WHERE id=? AND use_flag='Y'`,
                    [name, birth, phone, gender, level, lessonType, nextStatus, memberId],
                    (err) => {
                        if (err) return res.status(500).json({ success: false, error: err.message });

                        if (nextStatus === '탈퇴') {
                            dbRun(
                                `UPDATE schedules SET use_flag='N' WHERE member_id=? AND status='예약' AND use_flag='Y'`,
                                [memberId],
                                () => sendFreshData(res)
                            );
                            return;
                        }

                        if (!lessonList || lessonList.length === 0) {
                            return sendFreshData(res);
                        }

                        const todayStr = toYmd(new Date());
                        dbAll(
                            `SELECT * FROM schedules WHERE member_id=? AND use_flag='Y' AND date>=? AND status='예약' ORDER BY date,time,id`,
                            [memberId, todayStr],
                            (err, futureRows) => {
                                const keepCount = (futureRows || []).length;
                                dbRun(
                                    `UPDATE schedules SET use_flag='N' WHERE member_id=? AND use_flag='Y' AND date>=? AND status='예약'`,
                                    [memberId, todayStr],
                                    () => {
                                        dbRun(`UPDATE member_lessons SET use_flag='N' WHERE member_id=?`, [memberId], () => {
                                            lessonList.forEach((lesson) => {
                                                dbRun(
                                                    `INSERT INTO member_lessons (member_id,name,day,time,use_flag) VALUES (?,?,?,?,'Y')`,
                                                    [memberId, name, lesson.day || lesson.dayOfWeek, lesson.time]
                                                );
                                            });

                                            const planned = [];
                                            const baseDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
                                            const weeksNeeded = Math.max(Math.ceil(keepCount / Math.max(lessonList.length, 1)), 1) + 2;
                                            for (const lesson of lessonList) {
                                                const lessonDay = lesson.day || lesson.dayOfWeek;
                                                const targetDayIndex = dayMap[lessonDay];
                                                if (targetDayIndex === undefined) continue;
                                                for (let week = 0; week < weeksNeeded; week++) {
                                                    const calcDate = getNextDayOfWeek(baseDate, targetDayIndex, week);
                                                    planned.push({ date: toYmd(calcDate), time: lesson.time });
                                                }
                                            }
                                            planned.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
                                            const toInsert = planned.slice(0, keepCount);

                                            const insertNext = (index) => {
                                                if (index >= toInsert.length) return sendFreshData(res);
                                                const ps = toInsert[index];
                                                checkLessonAvailability(ps.date, ps.time, lessonType || '개인', name, (err, v) => {
                                                    if (err) return res.status(500).json({ success: false, error: err.message });
                                                    if (!v.allowed) return res.status(400).json({ success: false, error: v.error });
                                                    const passId = futureRows[index]?.passId || null;
                                                    dbRun(
                                                        `INSERT INTO schedules (date,time,member_id,name,status,note,passId,use_flag)
                                                         VALUES (?,?,?,?,'예약',?,?, 'Y')`,
                                                        [ps.date, ps.time, memberId, name, '정규 레슨', passId],
                                                        (insertError) => {
                                                            if (insertError) return res.status(500).json({ success: false, error: insertError.message });
                                                            insertNext(index + 1);
                                                        }
                                                    );
                                                });
                                            };
                                            insertNext(0);
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            };

            if (id) {
                applyUpdate(id);
            } else {
                dbGet(
                    `SELECT id FROM members WHERE name=? AND use_flag='Y'`,
                    [originalName || name],
                    (err, row) => {
                        if (!row) return res.status(400).json({ success: false, error: '회원을 찾지 못했어요.' });
                        applyUpdate(row.id);
                    }
                );
            }

        } else if (action === 'saveSettlement') {
            const settlement = req.body.settlement || {};
            const { id, member_id: memberId, amount, date, note = '' } = settlement;
            const parsedAmount = Number(amount);
            const parsedMemberId = Number(memberId);
            const parsedId = id == null ? null : Number(id);
            const dateMatch = typeof date === 'string' && date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            const validDate = dateMatch && Number(dateMatch[1]) >= 1000
                && Number(dateMatch[2]) >= 1 && Number(dateMatch[2]) <= 12
                && Number(dateMatch[3]) >= 1
                && Number(dateMatch[3]) <= new Date(Number(dateMatch[1]), Number(dateMatch[2]), 0).getDate();

            if (!Number.isSafeInteger(parsedMemberId) || parsedMemberId <= 0) {
                return res.status(400).json({ success: false, error: '회원을 선택해 주세요.' });
            }
            if (!Number.isSafeInteger(parsedAmount) || parsedAmount < 0) {
                return res.status(400).json({ success: false, error: '정산 금액은 0원 이상의 정수여야 해요.' });
            }
            if (!validDate) {
                return res.status(400).json({ success: false, error: '정산 날짜를 확인해 주세요.' });
            }
            if (typeof note !== 'string' || note.length > 500) {
                return res.status(400).json({ success: false, error: '메모는 500자 이내로 입력해 주세요.' });
            }
            if (parsedId !== null && (!Number.isSafeInteger(parsedId) || parsedId <= 0)) {
                return res.status(400).json({ success: false, error: '정산 내역을 확인해 주세요.' });
            }

            const saveForMember = () => {
                dbGet(
                    `SELECT id,name FROM members
                     WHERE id=? AND use_flag='Y' AND COALESCE(role,'')!='관리자' AND name!='관리자'`,
                    [parsedMemberId],
                    (memberError, member) => {
                        if (memberError) return res.status(500).json({ success: false, error: memberError.message });
                        if (!member) return res.status(400).json({ success: false, error: '회원을 찾지 못했어요.' });
                        dbTransaction((database) => {
                            if (parsedAmount === 0 && parsedId !== null) {
                                database.run(
                                    `UPDATE settlements SET use_flag='N'
                                     WHERE id=? AND type='일별정산' AND use_flag='Y'`,
                                    [parsedId]
                                );
                            } else if (parsedAmount === 0) {
                                database.run(
                                    `UPDATE settlements SET use_flag='N'
                                     WHERE member_id=? AND date=? AND type='일별정산' AND use_flag='Y'`,
                                    [parsedMemberId, date]
                                );
                            } else if (parsedId !== null) {
                                database.run(
                                    `UPDATE settlements
                                     SET member_id=?,name=?,amount=?,date=?,note=?
                                     WHERE id=? AND type='일별정산' AND use_flag='Y'`,
                                    [parsedMemberId, member.name, parsedAmount, date, note.trim(), parsedId]
                                );
                            } else {
                                database.run(
                                    `INSERT INTO settlements (member_id,name,amount,type,date,note,use_flag)
                                     VALUES (?,?,?,'일별정산',?,?,'Y')`,
                                    [parsedMemberId, member.name, parsedAmount, date, note.trim()]
                                );
                            }
                        }, (saveError) => {
                            if (saveError) return res.status(500).json({ success: false, error: saveError.message });
                            sendFreshData(res);
                        });
                    }
                );
            };

            if (parsedId === null) {
                saveForMember();
            } else {
                dbGet(
                    `SELECT id FROM settlements WHERE id=? AND type='일별정산' AND use_flag='Y'`,
                    [parsedId],
                    (entryError, entry) => {
                        if (entryError) return res.status(500).json({ success: false, error: entryError.message });
                        if (!entry) return res.status(404).json({ success: false, error: '정산 내역을 찾지 못했어요.' });
                        saveForMember();
                    }
                );
            }

        } else if (action === 'deleteSettlement') {
            const id = Number(req.body.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                return res.status(400).json({ success: false, error: '정산 내역을 확인해 주세요.' });
            }
            dbGet(
                `SELECT id FROM settlements WHERE id=? AND type='일별정산' AND use_flag='Y'`,
                [id],
                (entryError, entry) => {
                    if (entryError) return res.status(500).json({ success: false, error: entryError.message });
                    if (!entry) return res.status(404).json({ success: false, error: '정산 내역을 찾지 못했어요.' });
                    dbTransaction((database) => {
                        database.run(
                            `UPDATE settlements SET use_flag='N' WHERE id=? AND type='일별정산' AND use_flag='Y'`,
                            [id]
                        );
                    }, (deleteError) => {
                        if (deleteError) return res.status(500).json({ success: false, error: deleteError.message });
                        sendFreshData(res);
                    });
                }
            );

        } else if (action === 'saveMonthlyFees') {
            const { month, items } = req.body;
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                return res.status(400).json({ success: false, error: '정산 월 정보가 없어요.' });
            }
            const dateStr = `${month}-01`;
            dbRun(`UPDATE settlements SET use_flag='N' WHERE type='월레슨비' AND date=?`, [dateStr], () => {
                const stmt = dbPrepare(
                    `INSERT INTO settlements (member_id,name,amount,type,date,note,use_flag)
                     VALUES (?,?,?,?,?,?,'Y')`
                );
                (items || []).forEach((item) => {
                    const amount = Number(String(item.amount || '').replace(/\D/g, '')) || 0;
                    if (!item.name || amount <= 0) return;
                    stmt.run([item.member_id || null, item.name, amount, '월레슨비', dateStr, '']);
                });
                stmt.finalize(() => sendFreshData(res));
            });

        } else if (action === 'clear') {
            clearAllUserData((err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                sendFreshData(res);
            });

        } else {
            sendFreshData(res);
        }
    });

    // ── 3. REST 엔드포인트 ────────────────────────────────────────────
    app.put('/api/members/:id', (req, res) => {
        const { name, birth, phone, gender, level, lessonType, status } = req.body;
        dbRun(
            `UPDATE members SET name=?,birth=?,phone=?,gender=?,level=?,lessonType=?,status=?
             WHERE id=? AND use_flag='Y'`,
            [name, birth, phone, gender, level, lessonType, status, req.params.id],
            (err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                sendFreshData(res);
            }
        );
    });

    app.delete('/api/members/:id', (req, res) => {
        const id = req.params.id;
        dbRun(`UPDATE members        SET use_flag='N' WHERE id=?`, [id]);
        dbRun(`UPDATE member_lessons SET use_flag='N' WHERE member_id=?`, [id]);
        dbRun(`UPDATE passes         SET use_flag='N' WHERE member_id=?`, [id]);
        dbRun(`UPDATE schedules      SET use_flag='N' WHERE member_id=?`, [id]);
        dbRun(`UPDATE settlements    SET use_flag='N' WHERE member_id=?`, [id], () => {
            sendFreshData(res);
        });
    });

    // ── 4. CSV 일괄 교체 엔드포인트 ───────────────────────────────────
    app.post('/api/schedules/replace', (req, res) => {
        const { schedules } = req.body;
        dbAll(`SELECT * FROM members WHERE use_flag='Y' AND role != '관리자'`, [], (err, members) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            const byName = {};
            (members || []).forEach((m) => { byName[String(m.name).trim()] = m; });

            const missing = [];
            const mapped = [];
            const seen = new Set();
            (schedules || []).forEach((s) => {
                if (String(s.use_flag || 'Y').toUpperCase() === 'N') return;
                const name = String(s.name || '').trim();
                if (!name || !s.date) return;
                const member = byName[name];
                if (!member) {
                    missing.push(name);
                    return;
                }
                const key = `${s.date}_${s.time}_${name}`;
                if (seen.has(key)) return;
                seen.add(key);
                mapped.push({
                    date: s.date,
                    time: s.time || '',
                    name,
                    member_id: member.id,
                    status: s.status || '예약',
                    note: s.note || '',
                    passId: s.passId || '',
                });
            });

            const uniqueMissing = [...new Set(missing)];
            if (uniqueMissing.length) {
                return res.status(400).json({
                    success: false,
                    error: `회원 목록에 없는 이름이 있어요: ${uniqueMissing.join(', ')}\n먼저 회원 파일을 불러온 뒤에 스케줄을 불러와 주세요.`,
                });
            }

            dbRun(`UPDATE schedules SET use_flag='N'`, [], () => {
                if (mapped.length === 0) {
                    dbRun(`UPDATE passes SET use_flag='N'`);
                    dbRun(`UPDATE member_lessons SET use_flag='N'`, [], () => {
                        rebuildDerivedTables(() => sendFreshData(res));
                    });
                    return;
                }
                const stmt = dbPrepare(
                    `INSERT INTO schedules (date,time,name,member_id,status,note,passId,use_flag)
                     VALUES (?,?,?,?,?,?,?,'Y')`
                );
                mapped.forEach((s) => {
                    stmt.run([s.date, s.time, s.name, s.member_id, s.status, s.note, s.passId]);
                });
                stmt.finalize(() => {
                    dbRun(`UPDATE passes SET use_flag='N'`);
                    dbRun(`UPDATE member_lessons SET use_flag='N'`, [], () => {
                        rebuildDerivedTables(() => sendFreshData(res));
                    });
                });
            });
        });
    });

    app.post('/api/members/replace', (req, res) => {
        const { members } = req.body;
        dbRun(`UPDATE members SET use_flag='N' WHERE role != '관리자'`, [], () => {
            const stmt = dbPrepare(
                `INSERT INTO members (name,birth,phone,gender,level,lessonType,role,status,use_flag)
                 VALUES (?,?,?,?,?,?,?,?,'Y')`
            );
            (members || []).forEach((m) => {
                if (String(m.use_flag || 'Y').toUpperCase() === 'N') return;
                stmt.run([m.name, m.birth || '', m.phone || '', m.gender || '남',
                m.level || '중', m.lessonType || '개인', m.role || '사용자', m.status || '등록']);
            });
            stmt.finalize(() => sendFreshData(res));
        });
    });

    app.post('/api/passes/replace', (req, res) => {
        const { passes } = req.body;
        dbRun(`UPDATE passes SET use_flag='N'`, [], () => {
            const stmt = dbPrepare(
                `INSERT INTO passes (member_id,name,total,used,remaining,status,registeredAt,use_flag)
                 VALUES (?,?,?,?,?,?,?,'Y')`
            );
            (passes || []).forEach(p => {
                stmt.run([p.member_id || null, p.name, p.total || 0, p.used || 0,
                p.remaining || 0, p.status || '이용중', p.registeredAt || '']);
            });
            stmt.finalize(() => res.json({ success: true }));
        });
    });

app.post('/api/members/detail/save', (req, res) => {
    const { memberId, originalName, member: memberData, passes, deletedPassIds = [] } = req.body;
    const memberName = String(memberData?.name || '').trim();
    if (!memberData || typeof memberData !== 'object' || Array.isArray(memberData) || !memberName || !Array.isArray(passes) || !Array.isArray(deletedPassIds)) {
        return res.status(400).json({ success: false, error: '이용권 정보를 확인해 주세요.' });
    }

    const requestedPasses = [];
    const requestedIds = new Set();
    const requestedDeletedIds = new Set();
    for (const value of deletedPassIds) {
        const id = Number(value);
        if (!Number.isInteger(id) || id <= 0 || requestedDeletedIds.has(id)) {
            return res.status(400).json({ success: false, error: '삭제할 이용권 정보를 확인해 주세요.' });
        }
        requestedDeletedIds.add(id);
    }

    for (const pass of passes) {
        if (!pass || typeof pass !== 'object') {
            return res.status(400).json({ success: false, error: '이용권 정보를 확인해 주세요.' });
        }
        const id = pass.id == null || pass.id === '' ? null : Number(pass.id);
        const total = Number(pass.total);
        const used = Number(pass.used || 0);
        if ((id !== null && (!Number.isInteger(id) || id <= 0)) ||
            !Number.isInteger(total) || total < 1 ||
            !Number.isInteger(used) || used < 0 || used > total ||
            (id !== null && (requestedIds.has(id) || requestedDeletedIds.has(id)))) {
            return res.status(400).json({ success: false, error: '이용권 횟수를 확인해 주세요.' });
        }
        if (id !== null) requestedIds.add(id);
        requestedPasses.push({
            id,
            total,
            used,
            remaining: total - used,
            status: String(pass.status || ''),
            registeredAt: String(pass.registeredAt || new Date().toISOString().slice(0, 10)),
        });
    }

    db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION', (beginError) => {
            if (beginError) {
                return res.status(500).json({ success: false, error: beginError.message });
            }

            const hasMemberId = Number.isInteger(Number(memberId)) && Number(memberId) > 0;
            const memberQuery = hasMemberId
                ? 'SELECT id FROM members WHERE id = ?'
                : 'SELECT id FROM members WHERE name = ?';
            const memberValue = hasMemberId ? Number(memberId) : (originalName || memberName);

            db.get(memberQuery, [memberValue], (memberError, memberRow) => {
                if (memberError || !memberRow) {
                    return db.run('ROLLBACK', () => res.status(memberError ? 500 : 404).json({
                        success: false,
                        error: memberError ? memberError.message : '회원을 찾을 수 없어요.',
                    }));
                }

                db.all(
                    'SELECT id FROM passes WHERE member_id = ? OR (member_id IS NULL AND name = ?)',
                    [memberRow.id, originalName || memberName],
                    (selectError, currentPasses) => {
                        if (selectError) {
                            return db.run('ROLLBACK', () => res.status(500).json({ success: false, error: selectError.message }));
                        }

                        const currentIds = new Set(currentPasses.map((pass) => Number(pass.id)));
                        if (requestedPasses.some((pass) => pass.id !== null && !currentIds.has(pass.id))) {
                            return db.run('ROLLBACK', () => res.status(400).json({
                                success: false,
                                error: '다른 회원의 이용권은 수정할 수 없어요.',
                            }));
                        }
                        if ([...requestedDeletedIds].some((id) => !currentIds.has(id))) {
                            return db.run('ROLLBACK', () => res.status(400).json({
                                success: false,
                                error: '다른 회원의 이용권은 삭제할 수 없어요.',
                            }));
                        }

                        const operations = [{
                            sql: `UPDATE members
                                  SET name = ?, birth = ?, phone = ?, gender = ?, level = ?, lessonType = ?, status = ?
                                  WHERE id = ?`,
                            params: [
                                memberName,
                                String(memberData.birth || ''),
                                String(memberData.phone || ''),
                                String(memberData.gender || ''),
                                String(memberData.level || ''),
                                String(memberData.lessonType || '개인'),
                                String(memberData.status || '등록'),
                                memberRow.id,
                            ],
                        }];
                        operations.push(
                            {
                                sql: 'UPDATE schedules SET name = ? WHERE member_id = ?',
                                params: [memberName, memberRow.id],
                            },
                            {
                                sql: 'UPDATE member_lessons SET name = ? WHERE member_id = ?',
                                params: [memberName, memberRow.id],
                            }
                        );
                        for (const id of requestedDeletedIds) {
                            operations.push({
                                sql: 'DELETE FROM passes WHERE id = ?',
                                params: [id],
                            });
                        }
                        for (const pass of requestedPasses) {
                            const status = pass.remaining === 0 ? '완료' : pass.status === '만료' ? '만료' : '이용중';
                            if (pass.id === null) {
                                operations.push({
                                    sql: `INSERT INTO passes (member_id, name, total, used, remaining, status, registeredAt)
                                          VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    params: [memberRow.id, memberName, pass.total, pass.used, pass.remaining, status, pass.registeredAt],
                                });
                            } else {
                                operations.push({
                                    sql: `UPDATE passes
                                          SET member_id = ?, name = ?, total = ?, used = ?, remaining = ?, status = ?, registeredAt = ?
                                          WHERE id = ?`,
                                    params: [memberRow.id, memberName, pass.total, pass.used, pass.remaining, status, pass.registeredAt, pass.id],
                                });
                            }
                        }

                        const runOperation = (index) => {
                            if (index >= operations.length) {
                                return db.run('COMMIT', (commitError) => {
                                    if (commitError) {
                                        return db.run('ROLLBACK', () => res.status(500).json({ success: false, error: commitError.message }));
                                    }
                                    sendFreshData(res);
                                });
                            }
                            const operation = operations[index];
                            db.run(operation.sql, operation.params, (operationError) => {
                                if (operationError) {
                                    return db.run('ROLLBACK', () => res.status(500).json({ success: false, error: operationError.message }));
                                }
                                runOperation(index + 1);
                            });
                        };

                        runOperation(0);
                    }
                );
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
}

async function initDatabase() {
    SQL = await initSqlJs();
    if (fs.existsSync(dbFile)) {
        rawDb = new SQL.Database(fs.readFileSync(dbFile));
        console.log('✅ SQLite DB 파일 로드 성공:', dbFile);
    } else {
        rawDb = new SQL.Database();
        console.log('✅ 새 SQLite DB 메모리 생성 완료');
    }
    db = createDatabaseAdapter(rawDb);
    initTables();

    await new Promise((resolve, reject) => {
        ensureRetentionSchema((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
    await runRetentionSweep();
    startServer();

    await new Promise((resolve, reject) => {
        const server = app.listen(PORT, () => {
            console.log(`백엔드 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
            setInterval(runRetentionSweep, 24 * 60 * 60 * 1000).unref();
            resolve();
        });
        server.once('error', reject);
    });
}

initDatabase().catch((error) => {
    console.error('❌ DB 초기화 중 오류가 발생했습니다:', error);
    if (db) {
        db.close((closeError) => {
            if (closeError) console.error('❌ DB 종료 실패:', closeError.message);
            process.exitCode = 1;
        });
    } else {
        process.exitCode = 1;
    }
});