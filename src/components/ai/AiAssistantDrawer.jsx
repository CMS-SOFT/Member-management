import { useEffect, useRef, useState } from 'react';
import { Download, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import {
  initializeOnDeviceModel,
  isOnDeviceModelReady,
  ON_DEVICE_GPU_MEMORY,
  ON_DEVICE_MODEL_SIZE,
  sendAssistantMessage,
} from '../../lib/aiAssistantService';

const initialMessage = {
  role: 'assistant',
  content: '안녕하세요! 질문은 이 기기에 내려받은 AI 모델로 처리돼요. 회원 정보나 앱 데이터는 자동으로 전달되지 않습니다.',
};

export function AiAssistantDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [modelState, setModelState] = useState(() => isOnDeviceModelReady() ? 'ready' : 'idle');
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && modelState === 'ready') inputRef.current?.focus();
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages, isSending, modelState]);

  const prepareModel = async () => {
    setModelState('loading');
    setModelError('');
    setModelProgress(0);
    try {
      await initializeOnDeviceModel(({ progress }) => {
        setModelProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
      });
      setModelState('ready');
    } catch (error) {
      setModelError(error.message || 'AI 모델을 준비하지 못했습니다.');
      setModelState('error');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setDraft('');
    setIsSending(true);

    try {
      const recentMessages = nextMessages.filter((message) => message.role !== 'error').slice(-12);
      const boundedMessages = [];
      let totalCharacters = 0;
      for (const message of recentMessages.reverse()) {
        if (totalCharacters + message.content.length > 12000) {
          if (message.role === 'user' && boundedMessages.length === 0) {
            boundedMessages.unshift({ role: message.role, content: message.content.slice(-12000) });
          }
          break;
        }
        boundedMessages.unshift({ role: message.role, content: message.content });
        totalCharacters += message.content.length;
      }
      const reply = await sendAssistantMessage(boundedMessages);
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: 'error', content: error.message || 'AI 응답에 실패했습니다. 다시 시도해 주세요.' },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className={`ai-assistant${isOpen ? ' ai-assistant--open' : ''}`}>
      {isOpen ? (
        <section className="ai-assistant__panel" role="dialog" aria-modal="false" aria-labelledby="ai-assistant-title">
          <header className="ai-assistant__header">
            <div className="ai-assistant__heading">
              <span className="ai-assistant__mark" aria-hidden="true"><Sparkles size={18} /></span>
              <div>
                <h2 id="ai-assistant-title">AI에게 물어보기</h2>
                <p>이 기기에서 실행</p>
              </div>
            </div>
            <button className="ai-assistant__icon-button" type="button" onClick={() => setIsOpen(false)} aria-label="AI 채팅 닫기">
              <X size={20} />
            </button>
          </header>

          {modelState === 'ready' ? (
            <div className="ai-assistant__messages" aria-live="polite" aria-relevant="additions text">
              {messages.map((message, index) => (
                <div
                  className={`ai-assistant__message ai-assistant__message--${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <p>{message.content}</p>
                </div>
              ))}
              {isSending && (
                <div className="ai-assistant__message ai-assistant__message--assistant" role="status">
                  <p>기기에서 답변을 작성하고 있어요…</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="ai-assistant__model-setup">
              <span className="ai-assistant__model-icon" aria-hidden="true"><Download size={22} /></span>
              <h3>처음 한 번 AI 모델을 준비해 주세요</h3>
              <p>모델 파일 약 {ON_DEVICE_MODEL_SIZE}. 첫 다운로드에는 인터넷이 필요하며, 이후 질문은 이 기기에서 처리돼 API 사용료가 없습니다.</p>
              <p className="ai-assistant__model-requirement">호환 GPU와 약 {ON_DEVICE_GPU_MEMORY}의 GPU 메모리가 필요합니다.</p>
              {modelState === 'loading' ? (
                <div className="ai-assistant__download-progress" role="status" aria-live="polite">
                  <div className="ai-assistant__progress-track">
                    <div className="ai-assistant__progress-value" style={{ width: `${modelProgress}%` }} />
                  </div>
                  <p>모델 다운로드 및 준비 중… {modelProgress}%</p>
                  <p className="ai-assistant__model-requirement">다운로드 중에는 창을 닫지 말아 주세요.</p>
                </div>
              ) : (
                <>
                  {modelError && <p className="ai-assistant__model-error" role="alert">{modelError}</p>}
                  <button className="ai-assistant__download-button" type="button" onClick={prepareModel}>
                    <Download size={17} />
                    {modelState === 'error' ? '다시 시도' : '모델 다운로드 및 시작'}
                  </button>
                </>
              )}
            </div>
          )}

          {modelState === 'ready' && (
            <form className="ai-assistant__form" onSubmit={handleSubmit}>
              <label className="ai-assistant__sr-only" htmlFor="ai-assistant-input">AI에게 보낼 질문</label>
              <textarea
                id="ai-assistant-input"
                ref={inputRef}
                rows={1}
                maxLength={4000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="궁금한 점을 입력하세요"
                disabled={isSending}
              />
              <button type="submit" aria-label="질문 보내기" disabled={isSending || !draft.trim()}>
                <Send size={18} />
              </button>
            </form>
          )}
          <p className="ai-assistant__notice">
            {modelState === 'ready'
              ? '대화 내용은 외부로 전송되지 않고 이 기기에서 처리됩니다.'
              : 'Qwen2.5 7B · 약 4.3GB 다운로드 · GPU 메모리 약 5.1GB 권장'}
          </p>
        </section>
      ) : (
        <button className="ai-assistant__launcher" type="button" onClick={() => setIsOpen(true)}>
          <MessageCircle size={20} aria-hidden="true" />
          <span>AI에게 물어보기</span>
        </button>
      )}
    </div>
  );
}
