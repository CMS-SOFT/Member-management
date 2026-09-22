// CSV 내보내기/가져오기 유틸. 엑셀에서 바로 열 수 있도록 UTF-8 BOM을 포함합니다.
// 컴퓨터 초보자를 위해 컬럼 이름은 한글로 쓰고, id 같은 내부 번호는 파일에 넣지 않습니다.

function escapeCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

// 간단한 CSV 파서 (따옴표로 감싼 셀, 이스케이프된 따옴표 지원)
function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (inQuotes) {
      if (char === '"') {
        if (clean[index + 1] === '"') { cell += '"'; index += 1; }
        else inQuotes = false;
      } else cell += char;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell); cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => cells.some((value) => String(value).trim() !== ''));
}

function rowsToRecords(rows, aliasMap) {
  if (rows.length === 0) return [];
  const headerKeys = rows[0].map((value) => aliasMap[String(value).trim()] || String(value).trim());
  return rows.slice(1).map((cells) => {
    const record = {};
    headerKeys.forEach((key, index) => { record[key] = cells[index] != null ? String(cells[index]).trim() : ''; });
    return record;
  });
}

// --- 스케줄 CSV ---
const SCHEDULE_COLUMNS = [
  ['date', '날짜'], ['time', '시간'], ['name', '회원명'], ['status', '상태'], ['note', '메모'],
];
const SCHEDULE_ALIASES = {
  날짜: 'date', 시간: 'time', 회원명: 'name', 이름: 'name', 상태: 'status', 메모: 'note', 비고: 'note',
  date: 'date', time: 'time', name: 'name', status: 'status', note: 'note', id: '_ignore', passId: 'passId', 이용권명: 'passId',
};

export function schedulesToCsv(schedules) {
  const sorted = [...schedules].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || ''))
    || String(a.name || '').localeCompare(String(b.name || ''), 'ko')
    || String(a.time || '').localeCompare(String(b.time || '')));
  const header = SCHEDULE_COLUMNS.map(([, label]) => label).join(',');
  const rows = sorted.map((schedule) => SCHEDULE_COLUMNS.map(([key]) => escapeCell(schedule[key])).join(','));
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function csvToSchedules(text) {
  return rowsToRecords(parseCsv(text), SCHEDULE_ALIASES)
    .map((record) => {
      const date = record.date || '';
      const name = record.name || '';
      // 스케줄 날짜와 회원명을 기반으로 내부 passId 자동 생성 (예: 홍길동_260920)
      const dateObj = new Date(date);
      let passId = '';
      if (!isNaN(dateObj.getTime())) {
        const yy = String(dateObj.getFullYear()).slice(-2);
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        passId = `${name}_${yy}${mm}${dd}`;
      }
      return {
        date,
        time: record.time || '',
        name,
        status: record.status || '예약',
        note: record.note || '',
        passId: record.passId || passId, // 업로드 파일에 passId가 있으면 사용, 없으면 자동 생성된 passId 사용
      };
    })
    .filter((schedule) => schedule.date && schedule.name);
}

// --- 회원 CSV ---
const MEMBER_COLUMNS = [
  ['name', '회원명'], ['birth', '생년월일'], ['phone', '전화번호'],
  ['gender', '성별'], ['level', '레벨'], ['day', '요일'], ['time', '시간'],
  ['role', '구분'], ['status', '상태'],
];
const MEMBER_ALIASES = {
  회원명: 'name', 이름: 'name', 생년월일: 'birth', 전화번호: 'phone', 성별: 'gender', 레벨: 'level',
  요일: 'day', 시간: 'time', 구분: 'role', 상태: 'status',
  name: 'name', birth: 'birth', phone: 'phone', gender: 'gender', level: 'level',
  day: 'day', time: 'time', role: 'role', status: 'status', id: '_ignore',
};

export function membersToCsv(members) {
  const header = MEMBER_COLUMNS.map(([, label]) => label).join(',');
  const rows = (members || []).map((member) => MEMBER_COLUMNS.map(([key]) => escapeCell(member[key])).join(','));
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function csvToMembers(text) {
  const rows = parseCsv(text);
  const members = rows.slice(1)
    .map((cells) => {
      return {
        name: cells[0] || '',
        birth: cells[1] || '',
        phone: cells[2] || '',
        gender: cells[3] || '',
        level: cells[4] || '',
        day: cells[5] || '',
        time: cells[6] || '',
        role: cells[7] || '사용자',
        status: cells[8] || '등록',
      };
    })
    .filter((member) => member.name && member.name.trim() !== '' && member.name !== '회원명');
  return members;
}

// --- 이용권 CSV ---
const PASS_COLUMNS = [
  ['name', '회원명'], ['total', '전체횟수'], ['used', '사용횟수'], ['registeredAt', '등록일'],
];
const PASS_ALIASES = {
  회원명: 'name', 이름: 'name', 전체횟수: 'total', 총횟수: 'total', 사용횟수: 'used', 등록일: 'registeredAt',
  passId: 'passId', 이용권명: 'passId',
  남은횟수: '_ignore', 상태: '_ignore',
  name: 'name', total: 'total', used: 'used', remaining: '_ignore', status: '_ignore',
  registeredAt: 'registeredAt', id: '_ignore',
};

export function passesToCsv(passes) {
  const sorted = [...(passes || [])].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'ko')
    || String(a.registeredAt || '').localeCompare(String(b.registeredAt || '')));
  const header = PASS_COLUMNS.map(([, label]) => label).join(',');
  const rows = sorted.map((pass) => PASS_COLUMNS.map(([key]) => escapeCell(pass[key])).join(','));
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function csvToPasses(text) {
  const currentDate = new Date('2026-09-21'); // 현재 기준일 적용
  return rowsToRecords(parseCsv(text), PASS_ALIASES)
    .map((record) => {
      const name = record.name || '';
      const total = Number(record.total || 0);
      let used = Number(record.used || 0);
      const registeredAt = record.registeredAt || new Date().toISOString().slice(0, 10);

      // passId 자동 생성 (회원명_YYMMDD)
      let passId = record.passId || '';
      if (!passId && registeredAt) {
        const dt = new Date(registeredAt);
        if (!isNaN(dt.getTime())) {
          const yy = String(dt.getFullYear()).slice(-2);
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const dd = String(dt.getDate()).padStart(2, '0');
          passId = `${name}_${yy}${mm}${dd}`;
        }
      }

      // 2026년 9월 21일 기준 과거 이용권은 자동 만료 처리 (사용횟수 = 전체횟수)
      const regDateObj = new Date(registeredAt);
      if (!isNaN(regDateObj.getTime()) && regDateObj < currentDate) {
        // 단, 이미 사용횟수가 명시되어 있고 최신 데이터인 경우가 아니라 과거 일괄 처리 대상일 때 반영
        if (record.used === '' || record.used == null) {
          used = total;
        }
      }

      return {
        passId,
        name,
        total,
        used,
        remaining: Math.max(total - used, 0),
        status: used >= total && total > 0 ? '완료' : '이용중',
        registeredAt,
      };
    })
    .filter((pass) => pass.name && pass.total > 0);
}

// 빈 양식
export function scheduleTemplateCsv() {
  const header = SCHEDULE_COLUMNS.map(([, label]) => label).join(',');
  return `\uFEFF${header}\r\n2026-09-20,18:00,홍길동,예약,`;
}
export function memberTemplateCsv() {
  const header = MEMBER_COLUMNS.map(([, label]) => label).join(',');
  return `\uFEFF${header}\r\n홍길동,900101,010-1234-5678,남,중,월,18:00,사용자,등록`;
}
export function passTemplateCsv() {
  const header = PASS_COLUMNS.map(([, label]) => label).join(',');
  return `\uFEFF${header}\r\n홍길동,8,0,2026-09-01`;
}

// 다운로드 처리 함수
function downloadCsvWeb(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function downloadCsvNative(filename, csvText) {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  await Filesystem.writeFile({ path: filename, data: csvText, directory: Directory.Cache, encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  try {
    await Share.share({ title: filename, url: uri, dialogTitle: '파일 내보내기' });
  } catch { }
}

export function downloadCsv(filename, csvText) {
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    downloadCsvNative(filename, csvText).catch(() => downloadCsvWeb(filename, csvText));
    return;
  }
  downloadCsvWeb(filename, csvText);
}