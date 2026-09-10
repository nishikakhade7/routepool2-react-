import { useState, useEffect, useRef } from 'react';
import Spinner from './Spinner';
import { getChat, postChat } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const AVATAR_COLORS = [
  { bg: '#F7E3F0', fg: '#8A4A72' },
  { bg: '#DCEDE6', fg: '#1F5A4A' },
  { bg: '#E7E3F7', fg: '#3E3470' },
  { bg: '#FFF1DB', fg: '#A96A0C' },
  { bg: 'linear-gradient(150deg,#F7D9A8,#E8C9DE)', fg: '#5C3350' },
];
function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function GroupChat({ groupId, groupName, route, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getChat(groupId)
      .then(data => { if (!cancelled) { setMessages(data); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    try {
      const msg = await postChat(groupId, text);
      setMessages(prev => [...prev, msg]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const initials = groupName?.split(' ').map(w => w[0]).join('').slice(0, 2) || 'GP';
  const { bg: initBg, fg: initFg } = avatarColor(groupName);

  return (
    <div className="chat-overlay">
      <div className="chat-backdrop" onClick={onClose} />
      <div className="chat-drawer" role="dialog" aria-label={`Group chat: ${groupName}`}>
        {/* Header */}
        <div className="chat-header">
          <span style={{ width: 46, height: 46, borderRadius: 14, background: initBg, color: initFg, font: '700 15px Familjen Grotesk,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {initials}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ font: '700 17px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>{groupName}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#157F63"/><path d="M7.6 12.3l3 3 5.6-6" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            {route && <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.55)', fontWeight: 600 }}>{route}</div>}
          </div>
          <button
            onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 11, border: '1px solid rgba(33,28,38,.12)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .16s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F4EEE3'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            aria-label="Close chat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="#211C26" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Spinner />
            </div>
          )}
          {error && <div className="error-msg-red">{error}</div>}
          {!loading && messages.length === 0 && (
            <p style={{ textAlign: 'center', color: 'rgba(33,28,38,.4)', font: '600 13.5px Karla,sans-serif', padding: '32px 0' }}>
              No messages yet. Say hello!
            </p>
          )}
          {messages.map((m, i) => {
            const isMe = m.isYou || m.userId === user?.id;
            const { bg, fg } = avatarColor(m.name);
            return (
              <div
                key={m.id || i}
                style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4, animation: 'msgIn .26s ease-out both' }}
              >
                {!isMe && (
                  <span style={{ font: '700 11px Karla,sans-serif', letterSpacing: '.06em', color: fg, paddingLeft: 4 }}>
                    {m.name || m.initials}
                  </span>
                )}
                <span style={{
                  background: isMe ? '#211C26' : '#F4EEE3',
                  color: isMe ? '#FDFAF4' : '#211C26',
                  font: '500 14px/1.45 Karla,sans-serif',
                  padding: '12px 15px',
                  borderRadius: isMe ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
                }}>
                  {m.message}
                </span>
              </div>
            );
          })}
          {sending && (
            <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 5, background: '#F4EEE3', padding: '15px 16px', borderRadius: '16px 16px 16px 5px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#211C26', animation: 'dotBounce 1s infinite' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#211C26', animation: 'dotBounce 1s .15s infinite' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#211C26', animation: 'dotBounce 1s .3s infinite' }} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="chat-input-row">
          <input
            className="chat-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type a message…"
            disabled={sending}
          />
          <button className="chat-send-btn" onClick={handleSend} disabled={sending}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
