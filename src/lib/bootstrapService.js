import { requestServer } from './client';

export async function requestBootstrap() {
    const result = await requestServer('/bootstrap');
    return {
        success: true,
        members: result.members || [],
        histories: result.histories || [],
        schedules: (result.schedules || []).slice().sort((a, b) => Number(a.id) - Number(b.id)),
        passes: (result.passes || []).slice().sort((a, b) => Number(a.id) - Number(b.id)),
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