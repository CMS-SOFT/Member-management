import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { sendAssistantMessage } from '../../lib/aiAssistantService';

const initialMessage = {
  role: 'assistant',
  content: '안녕하세요! 무엇이든 물어보세요. 회원 개인정보나 앱 데이터를 직접 조회하거나 변경하지는 않아요.',
};

export function AiAssistantDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages, isSending]);

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
                <p>답변은 AI가 생성해요</p>
              </div>
            </div>
            <button className="ai-assistant__icon-button" type="button" onClick={() => setIsOpen(false)} aria-label="AI 채팅 닫기">
              <X size={20} />
            </button>
          </header>

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
                <p>답변을 작성하고 있어요…</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

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
          <p className="ai-assistant__notice">AI 사용료가 발생할 수 있어요. 회원 데이터는 질문에 자동으로 전달되지 않습니다.</p>
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
