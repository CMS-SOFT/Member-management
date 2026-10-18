// CSV 내보내기/가져오기 유틸.
// 엑셀에서 바로 열 수 있도록 UTF-8 BOM을 포함합니다.
//
// 규칙:
//   - 헤더(필드명)는 한글로 — 초보자도 직관적으로 알 수 있도록
//   - 데이터 컬럼은 다른 PC에서 재구성하는 데 필요한 값만 포함
//   - id, use_flag 는 DB 자동생성/기본값이므로 CSV에 포함하지 않음
//   - 불러오기 시 한글 헤더 → DB 컬럼명으로 자동 매핑

function escapeCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsv(text) {
  const clean = text.replace(/^[\uFEFF\uFFFE\s]+/, '').trimStart();
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

function rowsToRecords(rows, aliasMap) {
  if (rows.length === 0) return [];
  const keys = rows[0].map((v) => {
    const t = String(v).trim();
    return aliasMap[t] !== undefined ? aliasMap[t] : t;
  });
  return rows.slice(1).map((cells) => {
    const rec = {};
    keys.forEach((key, i) => {
      if (key !== '_ignore') rec[key] = cells[i] != null ? String(cells[i]).trim() : '';
    });
    return rec;
  });
}

function getDayOfWeekFull(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][d.getDay()];
}

// ══════════════════════════════════════════════════════════════════════
// members (회원): id/use_flag 제외, 이관 가능한 모든 데이터 필드
// ══════════════════════════════════════════════════════════════════════
const MEMBER_DB_COLS = ['name', 'birth', 'phone', 'gender', 'level', 'lessonType', 'role', 'status'];
const MEMBER_KR_HDRS = ['회원명', '생년월일', '전화번호', '성별', '레벨', '레슨유형', '권한', '회원상태'];

const MEMBER_ALIASES = {
  회원명: 'name', 이름: 'name',
  생년월일: 'birth',
  전화번호: 'phone',
  성별: 'gender',
  레벨: 'level',
  레슨구분: 'lessonType', 수업형태: 'lessonType', 레슨유형: 'lessonType',
  권한: 'role',
  회원상태: 'status', 상태: 'status',
  사용여부: 'use_flag',
  name: 'name', birth: 'birth', phone: 'phone', gender: 'gender',
  level: 'level', lessonType: 'lessonType', role: 'role', status: 'status',
  use_flag: 'use_flag',
  id: '_ignore',
};

export function membersToCsv(members) {
  const header = MEMBER_KR_HDRS.join(',');
  const rows = (members || [])
    .filter((m) => m.role !== '관리자' && m.name !== '관리자')
    .filter((m) => String(m.use_flag || 'Y').toUpperCase() !== 'N')
    .map((m) => MEMBER_DB_COLS.map((col) => escapeCell(m[col])).join(','));
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function parseMembersCsv(text) {
  return rowsToRecords(parseCsv(text), MEMBER_ALIASES)
    .filter((r) => r.name && r.name.trim() !== '' && r.name !== '회원명' && r.name !== 'name')
    .filter((r) => String(r.use_flag || 'Y').toUpperCase() !== 'N')
    .map((r) => ({
      name: r.name || '',
      birth: r.birth || '',
      phone: r.phone || '',
      gender: r.gender || '남',
      level: r.level || '중',
      lessonType: r.lessonType || '개인',
      role: r.role || '사용자',
      status: r.status || '등록',
    }));
}

export function csvToMembers(text) { return parseMembersCsv(text); }

export function memberTemplateCsv() {
  const sample = ['홍길동', '900101', '010-1234-5678', '남', '중', '개인', '사용자', '등록'];
  return `\uFEFF${MEMBER_KR_HDRS.join(',')}\r\n${sample.join(',')}`;
}

// ══════════════════════════════════════════════════════════════════════
// schedules (스케줄): 내부 ID 대신 회원명으로 연결
// ══════════════════════════════════════════════════════════════════════
const SCHEDULE_DB_COLS = ['name', 'date', 'time', 'status', 'note', 'passId'];
const SCHEDULE_KR_HDRS = ['회원명', '레슨날짜', '레슨시간', '진행상태', '메모', '이용권번호'];

const SCHEDULE_ALIASES = {
  날짜: 'date', 레슨날짜: 'date',
  시간: 'time', 레슨시간: 'time',
  회원명: 'name', 이름: 'name',
  상태: 'status', 진행상태: 'status',
  메모: 'note', 비고: 'note',
  회원번호: 'member_id', 이용권번호: 'passId', 이용권명: 'passId',
  사용여부: 'use_flag',
  date: 'date', time: 'time', name: 'name', status: 'status',
  note: 'note', member_id: 'member_id', passId: 'passId',
  use_flag: 'use_flag',
  id: '_ignore',
};

export function schedulesToCsv(schedules) {
  const header = SCHEDULE_KR_HDRS.join(',');
  const sorted = [...(schedules || [])]
    .filter((s) => String(s.use_flag || 'Y').toUpperCase() !== 'N')
    .sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || '')) ||
    String(a.time || '').localeCompare(String(b.time || '')) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'ko')
  );
  const rows = sorted.map((s) => SCHEDULE_DB_COLS.map((col) => escapeCell(s[col])).join(','));
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function csvToSchedules(text) {
  return rowsToRecords(parseCsv(text), SCHEDULE_ALIASES)
    .filter((r) => r.date && r.name && r.date !== '날짜' && r.date !== '레슨날짜' && r.date !== 'date')
    .filter((r) => String(r.use_flag || 'Y').toUpperCase() !== 'N')
    .map((r) => ({
      date: r.date || '',
      time: r.time || '',
      name: r.name || '',
      status: r.status || '예약',
      note: r.note || '',
      member_id: r.member_id ? Number(r.member_id) : null,
      passId: r.passId || '',
    }));
}

export function parseSchedulesCsv(text) {
  const schedules = csvToSchedules(text);
  const memberLessons = extractMemberLessons(schedules);
  return { schedules, memberLessons };
}

export function scheduleTemplateCsv() {
  const sample = ['홍길동', '2026-10-01', '10:00', '예약', '', ''];
  return `\uFEFF${SCHEDULE_KR_HDRS.join(',')}\r\n${sample.join(',')}`;
}

// schedules → member_lessons 재생성용 데이터 추출 (회원-요일-시간 중복 제거)
export function extractMemberLessons(schedules) {
  const map = new Map();
  (schedules || []).forEach((s) => {
    if (!s.name || !s.date || !s.time) return;
    const day = getDayOfWeekFull(s.date);
    if (!day) return;
    const key = `${s.name}_${day}_${s.time}`;
    if (!map.has(key)) {
      map.set(key, { member_id: s.member_id || null, name: s.name, date: s.date, day, time: s.time });
    }
  });
  return Array.from(map.values());
}

// ══════════════════════════════════════════════════════════════════════
// passes  (이용권 — 내부 자동생성, 화면 메뉴 미노출)
// passes (이용권): id/use_flag 제외, member_id는 회원명으로 다시 연결
// ══════════════════════════════════════════════════════════════════════
const PASS_DB_COLS = ['name', 'total', 'used', 'remaining', 'status', 'registeredAt'];
const PASS_KR_HDRS = ['회원명', '총횟수', '사용횟수', '잔여횟수', '이용권상태', '등록일'];

const PASS_ALIASES = {
  회원명: 'name', 이름: 'name', 총횟수: 'total', 전체횟수: 'total',
  사용횟수: 'used', 잔여횟수: 'remaining', 남은횟수: 'remaining',
  이용권상태: 'status', 상태: 'status', 등록일: 'registeredAt',
  name: 'name', total: 'total', used: 'used', remaining: 'remaining',
  status: 'status', registeredAt: 'registeredAt', member_id: 'member_id',
  id: '_ignore', use_flag: '_ignore', passId: '_ignore',
};

export function passesToCsv(passes) {
  const header = PASS_KR_HDRS.join(',');
  const sorted = [...(passes || [])]
    .filter((p) => String(p.use_flag || 'Y').toUpperCase() !== 'N')
    .sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'ko') ||
    String(a.registeredAt || '').localeCompare(String(b.registeredAt || ''))
  );
  const rows = sorted.map((p) => PASS_DB_COLS.map((col) => escapeCell(p[col])).join(','));
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function csvToPasses(text) {
  return rowsToRecords(parseCsv(text), PASS_ALIASES)
    .filter((r) => r.name && r.total)
    .map((r) => {
      const total = Number(r.total || 0);
      const used = Number(r.used || 0);
      const remaining = r.remaining !== '' ? Number(r.remaining) : Math.max(total - used, 0);
      return {
        name: r.name || '',
        total,
        used,
        remaining,
        status: r.status || (remaining > 0 ? '이용중' : '완료'),
        registeredAt: r.registeredAt || new Date().toISOString().slice(0, 10),
        member_id: r.member_id ? Number(r.member_id) : null,
      };
    });
}

export function parsePassesCsv(text) { return csvToPasses(text); }

// ══════════════════════════════════════════════════════════════════════
// 공통 다운로드
// ══════════════════════════════════════════════════════════════════════
function downloadCsvWeb(csvText, filename) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function downloadCsvNative(csvText, filename) {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  await Filesystem.writeFile({ path: filename, data: csvText, directory: Directory.Cache, encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  await Share.share({ title: filename, url: uri, dialogTitle: '파일 내보내기' });
}

export function downloadCsv(csvText, filename) {
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    downloadCsvNative(csvText, filename).catch((error) => {
      console.error(`파일을 내보내지 못했습니다 (${filename}):`, error);
      downloadCsvWeb(csvText, filename);
    });
    return;
  }
  downloadCsvWeb(csvText, filename);
}
