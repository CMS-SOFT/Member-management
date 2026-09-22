// 로컬 IndexedDB 데이터 레이어.
// 기존 구글시트 callApi/requestBootstrap과 동일한 계약을 제공해 UI 변경을 최소화합니다.
// 모든 읽기/쓰기가 로컬에서 일어나므로 네트워크 지연이 없습니다.

const DB_NAME = 'court-mate-db';
const DB_VERSION = 7;
const STORE_MEMBERS = 'members';
const STORE_SCHEDULES = 'schedules';
const STORE_HISTORIES = 'histories';
const STORE_PASSES = 'passes';

let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_MEMBERS)) db.createObjectStore(STORE_MEMBERS, { keyPath: 'name' });
      if (!db.objectStoreNames.contains(STORE_SCHEDULES)) db.createObjectStore(STORE_SCHEDULES, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains(STORE_HISTORIES)) db.createObjectStore(STORE_HISTORIES, { keyPath: 'name' });
      if (!db.objectStoreNames.contains(STORE_PASSES)) db.createObjectStore(STORE_PASSES, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB를 열지 못했습니다.'));
  });
  return dbPromise;
}

function runTransaction(storeNames, mode, executor) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB 트랜잭션에 실패했습니다.'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 트랜잭션이 중단되었습니다.'));
    result = executor(transaction);
  }));
}

function readStore(storeName) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }));
}

// [수정됨] 데이터가 없을 때 샘플 데이터를 자동 주입하는 로직을 제거하고 빈 상태를 유지합니다.
async function ensureSeeded() {
  await openDatabase();
  // 자동 seed 주입 로직 제거 완료
}

// 전체 데이터를 읽어 부트스트랩 형태로 반환합니다.
export async function requestBootstrap() {
  await ensureSeeded();
  let [members, histories, schedules, passes] = await Promise.all([
    readStore(STORE_MEMBERS),
    readStore(STORE_HISTORIES),
    readStore(STORE_SCHEDULES),
    readStore(STORE_PASSES),
  ]);

  // [수정] 관리자 계정이 아예 없거나 지워졌다면 무조건 자동으로 생성해서 넣어줍니다.
  const hasAdmin = members.some(m => m.role === '관리자');
  if (!hasAdmin) {
    const defaultAdmin = {
      name: '관리자',
      birth: '010420',
      gender: '남',
      phone: '010-2222-1234',
      role: '관리자',
      status: '등록',
    };
    await runTransaction(STORE_MEMBERS, 'readwrite', (transaction) => {
      transaction.objectStore(STORE_MEMBERS).put(defaultAdmin);
    });
    members = [defaultAdmin, ...members];
  }

  return {
    success: true,
    members,
    histories,
    schedules: schedules.slice().sort((a, b) => Number(a.id) - Number(b.id)),
    passes: passes.slice().sort((a, b) => Number(a.id) - Number(b.id)),
  };
}

function putMember(transaction, member) {
  transaction.objectStore(STORE_MEMBERS).put(member);
}
function deleteMemberByName(transaction, name) {
  transaction.objectStore(STORE_MEMBERS).delete(name);
}

const COMPLETED_STATUSES = ['완료', '정상', '출석', '퇴실'];
function isCompletedStatus(status) {
  return COMPLETED_STATUSES.includes(String(status || '').trim());
}

// 회원의 활성(이용중) 이용권을 오래된(registeredAt/id) 순으로 정렬해 반환합니다.
function activePassesOf(passes, name) {
  return passes
    .filter((pass) => pass.name === name && pass.status !== '완료' && Number(pass.remaining) > 0)
    .sort((a, b) => String(a.registeredAt || '').localeCompare(String(b.registeredAt || '')) || Number(a.id) - Number(b.id));
}

// 가장 오래된 활성 이용권에서 1회 차감합니다. total 도달 시 완료 처리.
function consumeOnePass(passes, name) {
  const [target] = activePassesOf(passes, name);
  if (!target) return null;
  const used = Number(target.used || 0) + 1;
  const total = Number(target.total || 0);
  const updated = { ...target, used, remaining: Math.max(total - used, 0), status: used >= total ? '완료' : '이용중' };
  return updated;
}

// 되돌림: 해당 회원의 가장 최근에 차감된 이용권에서 1회 복원합니다.
function restoreOnePass(passes, name) {
  const candidates = passes
    .filter((pass) => pass.name === name && Number(pass.used) > 0)
    .sort((a, b) => String(b.registeredAt || '').localeCompare(String(a.registeredAt || '')) || Number(b.id) - Number(b.id));
  const [target] = candidates;
  if (!target) return null;
  const used = Math.max(Number(target.used || 0) - 1, 0);
  const total = Number(target.total || 0);
  return { ...target, used, remaining: Math.max(total - used, 0), status: used >= total ? '완료' : '이용중' };
}

// 구글시트 callApi 대체. 액션별로 IndexedDB CRUD를 수행합니다.
export async function callApi(payload) {
  const action = payload?.action;

  if (action === 'bootstrap') return requestBootstrap();

  if (action === 'appendMember') {
    const member = payload.member || {};
    await runTransaction(STORE_MEMBERS, 'readwrite', (transaction) => putMember(transaction, member));
    return { success: true };
  }

  if (action === 'updateMember') {
    const member = payload.member || {};
    const originalName = payload.originalName;
    await runTransaction(STORE_MEMBERS, 'readwrite', (transaction) => {
      if (originalName && originalName !== member.name) deleteMemberByName(transaction, originalName);
      putMember(transaction, member);
    });
    return { success: true };
  }

  if (action === 'deleteMember') {
    const originalName = payload.originalName || payload.member?.name;
    await runTransaction(STORE_MEMBERS, 'readwrite', (transaction) => deleteMemberByName(transaction, originalName));
    return { success: true };
  }

  if (action === 'updateSchedule') return updateScheduleWithPass(payload.schedule);

  if (action === 'deleteSchedule') {
    const id = payload.schedule?.id;
    if (id != null) await runTransaction(STORE_SCHEDULES, 'readwrite', (transaction) => transaction.objectStore(STORE_SCHEDULES).delete(Number(id)));
    return { success: true };
  }

  if (action === 'appendPass') {
    const pass = { ...payload.pass };
    delete pass.id;
    const total = Number(pass.total || 0);
    const used = Number(pass.used || 0);
    const saved = { name: String(pass.name || '').trim(), total, used, remaining: Math.max(total - used, 0), status: used >= total && total > 0 ? '완료' : '이용중', registeredAt: pass.registeredAt || new Date().toISOString().slice(0, 10) };
    await runTransaction(STORE_PASSES, 'readwrite', (transaction) => {
      const request = transaction.objectStore(STORE_PASSES).add(saved);
      request.onsuccess = () => { saved.id = request.result; };
    });
    const passes = await readStore(STORE_PASSES);
    return { success: true, pass: saved, passes };
  }

  if (action === 'updatePass') {
    const pass = { ...payload.pass, id: Number(payload.pass.id) };
    const total = Number(pass.total || 0);
    const used = Number(pass.used || 0);
    pass.remaining = Math.max(total - used, 0);
    pass.status = used >= total && total > 0 ? '완료' : '이용중';
    await runTransaction(STORE_PASSES, 'readwrite', (transaction) => transaction.objectStore(STORE_PASSES).put(pass));
    const passes = await readStore(STORE_PASSES);
    return { success: true, pass, passes };
  }

  if (action === 'deletePass') {
    const id = Number(payload.pass?.id);
    if (!Number.isNaN(id)) await runTransaction(STORE_PASSES, 'readwrite', (transaction) => transaction.objectStore(STORE_PASSES).delete(id));
    const passes = await readStore(STORE_PASSES);
    return { success: true, passes };
  }

  if (action === 'reregister') {
    const name = String(payload.name || '').trim();
    const total = Number(payload.total || 0);
    const newSchedules = (payload.schedules || []).map((item) => ({
      date: item.date, time: item.time, name, status: '예약', note: item.note || '',
    }));
    const newPass = { name, total, used: 0, remaining: total, status: '이용중', registeredAt: payload.registeredAt || new Date().toISOString().slice(0, 10) };
    const passesBefore = await readStore(STORE_PASSES);
    const toComplete = passesBefore.filter((pass) => pass.name === name && pass.status !== '완료' && Number(pass.total) > 0 && Number(pass.used) >= Number(pass.total));
    await runTransaction([STORE_PASSES, STORE_SCHEDULES], 'readwrite', (transaction) => {
      const passStore = transaction.objectStore(STORE_PASSES);
      toComplete.forEach((pass) => passStore.put({ ...pass, remaining: 0, status: '완료' }));
      passStore.add(newPass);
      const scheduleStore = transaction.objectStore(STORE_SCHEDULES);
      newSchedules.forEach((schedule) => scheduleStore.add(schedule));
    });
    const [passes, schedules] = await Promise.all([readStore(STORE_PASSES), readStore(STORE_SCHEDULES)]);
    return { success: true, passes, schedules: schedules.slice().sort((a, b) => Number(a.id) - Number(b.id)) };
  }

  throw new Error(`알 수 없는 action입니다: ${action}`);
}

async function updateScheduleWithPass(input) {
  const schedule = { ...input };
  delete schedule.rowNumber;
  const isNew = schedule.id == null || schedule.id === '';
  if (!isNew) schedule.id = Number(schedule.id);

  const [existing, passesBefore] = await Promise.all([
    isNew ? Promise.resolve(null) : getById(STORE_SCHEDULES, schedule.id),
    readStore(STORE_PASSES),
  ]);
  const wasCompleted = existing ? isCompletedStatus(existing.status) : false;
  const willComplete = isCompletedStatus(schedule.status);

  let changedPass = null;
  if (!wasCompleted && willComplete) changedPass = consumeOnePass(passesBefore, schedule.name);
  else if (wasCompleted && !willComplete) changedPass = restoreOnePass(passesBefore, schedule.name);

  const saved = await runTransaction([STORE_SCHEDULES, STORE_PASSES], 'readwrite', (transaction) => {
    const scheduleStore = transaction.objectStore(STORE_SCHEDULES);
    if (isNew) {
      delete schedule.id;
      const request = scheduleStore.add(schedule);
      request.onsuccess = () => { schedule.id = request.result; };
    } else {
      scheduleStore.put(schedule);
    }
    if (changedPass) transaction.objectStore(STORE_PASSES).put(changedPass);
    return schedule;
  });

  const passes = await readStore(STORE_PASSES);
  return { success: true, schedule: saved, passes, changedPass };
}

function getById(storeName, id) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(Number(id));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }));
}

export async function replaceAllSchedules(schedules) {
  await runTransaction(STORE_SCHEDULES, 'readwrite', (transaction) => {
    const store = transaction.objectStore(STORE_SCHEDULES);
    store.clear();
    schedules.forEach((schedule) => store.put(schedule));
  });
  return { success: true };
}

export async function replaceAllMembers(members) {
  await runTransaction(STORE_MEMBERS, 'readwrite', async (transaction) => {
    const store = transaction.objectStore(STORE_MEMBERS);

    // 1. 기존에 있던 관리자 계정들을 미리 찾아둡니다.
    // (만약 비동기 처리 제약 때문에 전체 조회 후 필터링해야 한다면 아래 방식을 씁니다)
  });

  // 혹은 더 안전하게 트랜잭션 밖이나 안에서 기존 관리자 추출 후 병합:
  const currentMembers = await readStore(STORE_MEMBERS);
  const admins = currentMembers.filter((m) => m.role === '관리자');

  // 새로 들어온 멤버 중에 관리자가 없다면 기존 관리자들을 유지해 줍니다.
  const hasAdmin = members.some((m) => m.role === '관리자');
  const finalMembers = hasAdmin ? members : [...admins, ...members];

  await runTransaction(STORE_MEMBERS, 'readwrite', (transaction) => {
    const store = transaction.objectStore(STORE_MEMBERS);
    store.clear();
    finalMembers.forEach((member) => store.put(member));
  });

  return { success: true };
}

export async function replaceAllPasses(passes) {
  await runTransaction(STORE_PASSES, 'readwrite', (transaction) => {
    const store = transaction.objectStore(STORE_PASSES);
    store.clear();
    passes.forEach((pass) => store.put(pass));
  });
  return { success: true };
}

const ARCHIVABLE_STATUSES = ['완료', '취소', '퇴실', '정상', '출석'];

export async function collectArchivableSchedules(year) {
  const schedules = await readStore(STORE_SCHEDULES);
  return schedules
    .filter((schedule) => String(schedule.date || '').slice(0, 4) === String(year) && ARCHIVABLE_STATUSES.includes(String(schedule.status || '').trim()))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

export async function removeSchedulesByIds(ids) {
  const idSet = new Set(ids.map((id) => Number(id)));
  await runTransaction(STORE_SCHEDULES, 'readwrite', (transaction) => {
    const store = transaction.objectStore(STORE_SCHEDULES);
    idSet.forEach((id) => store.delete(id));
  });
  return { success: true };
}

// --- 전체 데이터 초기화 (샘플 삭제) ---
// 회원/스케줄/이용권/이력을 모두 비우되, 관리자 계정은 로그인 유지를 위해 남겨둡니다.
export async function clearAllData() {
  await ensureSeeded();

  const currentMembers = await readStore(STORE_MEMBERS);
  const adminMember = currentMembers.find(m => m.role === '관리자') || {
    name: '관리자',
    birth: '010420',
    gender: '남',
    phone: '010-2222-1234',
    role: '관리자',
    status: '등록',
  };

  await Promise.all([
    runTransaction(STORE_MEMBERS, 'readwrite', (tx) => tx.objectStore(STORE_MEMBERS).clear()),
    runTransaction(STORE_HISTORIES, 'readwrite', (tx) => tx.objectStore(STORE_HISTORIES).clear()),
    runTransaction(STORE_SCHEDULES, 'readwrite', (tx) => tx.objectStore(STORE_SCHEDULES).clear()),
    runTransaction(STORE_PASSES, 'readwrite', (tx) => tx.objectStore(STORE_PASSES).clear()),
  ]);

  await runTransaction(STORE_MEMBERS, 'readwrite', (tx) => {
    tx.objectStore(STORE_MEMBERS).put(adminMember);
  });

  return requestBootstrap();
}