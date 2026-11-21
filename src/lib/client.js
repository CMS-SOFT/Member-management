// [순수 통신 계층] 네트워크 요청 및 공통 에러 핸들링
const API_BASE = 'http://localhost:5000/api';

export async function requestServer(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        const responseBody = await response.text();
        let data;
        try {
            data = responseBody ? JSON.parse(responseBody) : null;
        } catch {
            throw new Error(
                `서버가 JSON이 아닌 응답을 반환했습니다 (HTTP ${response.status}). 백엔드 서버를 확인한 뒤 다시 시도해 주세요.`
            );
        }
        if (!response.ok) {
            const errorMessage =
                data?.error ||
                data?.message ||
                (typeof data === 'string' ? data : null) ||
                '서버 요청에 실패했습니다.';
            throw new Error(errorMessage);
        }
        return data;
    } catch (error) {
        console.error(`[API Error] ${endpoint}:`, error);
        throw error;
    }
}