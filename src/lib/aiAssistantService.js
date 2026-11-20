import { requestServer } from './client';

export async function sendAssistantMessage(messages) {
  const result = await requestServer('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });

  if (!result?.success || typeof result.reply !== 'string') {
    throw new Error('AI 답변을 받지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return result.reply;
}
