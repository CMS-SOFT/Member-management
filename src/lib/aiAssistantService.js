export const ON_DEVICE_MODEL_ID = 'Qwen2.5-7B-Instruct-q4f16_1-MLC';
export const ON_DEVICE_MODEL_SIZE = '약 4.3GB';
export const ON_DEVICE_GPU_MEMORY = '약 5.1GB';

let loadedEngine = null;
let enginePromise = null;

export function isOnDeviceModelReady() {
  return loadedEngine !== null;
}

export async function initializeOnDeviceModel(onProgress) {
  if (loadedEngine) return loadedEngine;

  if (!enginePromise) {
    enginePromise = (async () => {
      if (!globalThis.navigator?.gpu) {
        throw new Error('이 브라우저는 WebGPU를 지원하지 않습니다. Windows용 최신 Chrome 또는 Edge에서 다시 시도해 주세요.');
      }

      const adapter = await globalThis.navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('사용 가능한 GPU를 찾지 못했습니다. GPU 드라이버를 확인해 주세요.');
      }

      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      return CreateMLCEngine(ON_DEVICE_MODEL_ID, {
        initProgressCallback: (progress) => onProgress?.(progress),
      });
    })();
  }

  try {
    loadedEngine = await enginePromise;
    return loadedEngine;
  } catch (error) {
    enginePromise = null;
    throw error;
  }
}

export async function sendAssistantMessage(messages) {
  if (!loadedEngine) {
    throw new Error('먼저 이 기기에 AI 모델을 준비해 주세요.');
  }

  const result = await loadedEngine.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: '당신은 Court Mate 테니스 코치의 일반 질문을 돕는 AI 비서입니다. 한국어로 친절하고 간결하게 답하세요. 회원 정보나 앱 데이터를 실제로 조회하거나 변경할 수 있다고 주장하지 마세요. 일정 등록, 수정, 삭제가 완료되었다고 말하지 마세요.',
      },
      ...messages,
    ],
    max_tokens: 700,
    temperature: 0.6,
  });
  const reply = result.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('AI가 답변을 만들지 못했습니다. 다시 질문해 주세요.');
  }
  return reply.trim();
}
