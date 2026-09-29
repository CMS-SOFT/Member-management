import { requestServer } from './client';
import { requestBootstrap } from './bootstrapService';

const ARCHIVABLE_STATUSES = ['완료', '취소', '퇴실', '정상', '출석'];

export async function replaceAllSchedules(schedules) {
    return requestServer('/schedules/replace', {
        method: 'POST',
        body: JSON.stringify({ schedules }),
    });
}

export async function replaceAllPasses(passes) {
    return requestServer('/passes/replace', {
        method: 'POST',
        body: JSON.stringify({ passes }),
    });
}

export async function collectArchivableSchedules(year) {
    const bootstrapData = await requestBootstrap();
    const schedules = bootstrapData.schedules || [];
    return schedules
        .filter((schedule) => String(schedule.date || '').slice(0, 4) === String(year) && ARCHIVABLE_STATUSES.includes(String(schedule.status || '').trim()))
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

export async function removeSchedulesByIds(ids) {
    return requestServer('/schedules/delete-batch', {
        method: 'POST',
        body: JSON.stringify({ ids }),
    });
}