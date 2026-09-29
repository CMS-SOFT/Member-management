import { requestServer } from './client';

export async function appendMember(member) {
    return requestServer('/members', {
        method: 'POST',
        body: JSON.stringify(member),
    });
}

export async function updateMember(id, member) {
    return requestServer(`/members/${id}`, {
        method: 'PUT',
        body: JSON.stringify(member),
    });
}

export async function deleteMember(id) {
    return requestServer(`/members/${id}`, {
        method: 'DELETE',
    });
}

export async function replaceAllMembers(members) {
    return requestServer('/members/replace', {
        method: 'POST',
        body: JSON.stringify({ members }),
    });
}