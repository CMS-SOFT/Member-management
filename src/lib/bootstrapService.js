import { requestServer } from './client';

export async function requestBootstrap() {
    const result = await requestServer('/bootstrap');
    return {
        success: true,
        members: result.members || [],
        histories: result.histories || [],
        schedules: (result.schedules || []).slice().sort((a, b) => Number(a.id) - Number(b.id)),
        passes: (result.passes || []).slice().sort((a, b) => Number(a.id) - Number(b.id)),
        settlements: result.settlements || [],
    };
}

export async function callApi(payload) {
    const action = payload?.action;
    if (action === 'bootstrap') return requestBootstrap();

    const result = await requestServer('/action', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    return result;
}

export async function clearAllData() {
    await requestServer('/clear', { method: 'POST' });
    return requestBootstrap();
}

// callApi 내부에서 action:'clear'로 호출하면 /action 엔드포인트로 가므로
// 직접 /clear를 쓰는 경우도 server.cjs의 /api/clear 라우트와 일치합니다.