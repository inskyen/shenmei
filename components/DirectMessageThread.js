import { useEffect, useRef, useState } from 'react';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function DirectMessageThread({ currentUserId, messages, onSend, sending, disabledMessage }) {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // 每次訊息更新時，自動捲動到最底部
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const submit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || disabledMessage) return;
    await onSend(content);
    setDraft('');
  };

  return (
    <>
      <div style={{ display: 'grid', gap: '10px', minHeight: '280px', padding: '4px 0 96px' }}>
        {messages.length === 0 && (
          <p style={{ alignSelf: 'center', color: 'var(--text-tertiary)', lineHeight: 1.8, margin: 0, textAlign: 'center' }}>從一句真誠的話開始吧。</p>
        )}
        {messages.map((message) => {
          const isMine = message.sender_id === currentUserId;
          return (
            <div key={message.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
              <div style={{ backgroundColor: isMine ? 'var(--brand-blue)' : 'var(--bg-surface)', border: isMine ? 'none' : '1px solid var(--border-light)', borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', color: isMine ? '#FFFFFF' : 'var(--text-primary)', fontSize: '15px', lineHeight: 1.6, maxWidth: '78%', padding: '10px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {message.content}
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginTop: '6px' }}>{formatTime(message.created_at)}</span>
            </div>
          );
        })}
        {/* 用於自動捲動的錨點 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 固定在底部的輸入框區域 */}
      <div style={{ backgroundColor: 'var(--bg-base)', borderTop: '1px solid var(--border-light)', bottom: 0, left: 0, position: 'fixed', width: '100%', zIndex: 20 }}>
        <form onSubmit={submit} style={{ display: 'flex', gap: '10px', margin: '0 auto', maxWidth: '680px', padding: '12px 16px' }}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={Boolean(disabledMessage) || sending}
            maxLength={1000}
            placeholder={disabledMessage || '寫下想說的話...'}
            rows={1}
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '20px', boxSizing: 'border-box', color: 'var(--text-primary)', flex: 1, fontFamily: 'inherit', fontSize: '14px', lineHeight: 1.5, outline: 'none', padding: '10px 16px', resize: 'none' }}
          />
          <button type="submit" disabled={!draft.trim() || sending || Boolean(disabledMessage)} style={{ backgroundColor: !draft.trim() || sending || disabledMessage ? 'var(--border-light)' : 'var(--brand-blue)', border: 'none', borderRadius: '20px', color: !draft.trim() || sending || disabledMessage ? 'var(--text-tertiary)' : '#FFFFFF', cursor: !draft.trim() || sending || disabledMessage ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, padding: '0 16px' }}>
            {sending ? '傳送中' : '傳送'}
          </button>
        </form>
      </div>
    </>
  );
}
