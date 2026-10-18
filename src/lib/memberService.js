import { requestServer } from './client';

// 회원 등록 — /api/action 통합 엔드포인트 사용 (서버 redirect 없이 직접 처리)
export async function appendMember(member) {
    return requestServer('/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'appendMember', member }),
    });
}

// 회원 정보 수정
export async function updateMember(id, member) {
    return requestServer(`/members/${id}`, {
        method: 'PUT',
        body: JSON.stringify(member),
    });
}

// 회원 소프트 삭제 (use_flag = 'N')
export async function deleteMember(id) {
    return requestServer(`/members/${id}`, {
        method: 'DELETE',
    });
}

// CSV 일괄 교체
export async function replaceAllMembers(members) {
    return requestServer('/members/replace', {
        method: 'POST',
        body: JSON.stringify({ members }),
    });
}
