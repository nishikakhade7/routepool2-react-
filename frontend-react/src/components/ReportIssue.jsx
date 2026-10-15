import { useState } from 'react';
import { fileSafetyReport, REPORT_CATEGORIES } from '../api/client';

// Students report something that happened on a ride; staff see it in the admin
// panel and can suspend the student or the auto involved.
export default function ReportIssue({ group }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [message, setMessage] = useState('');
  const [aboutUserId, setAboutUserId] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const others = (group.members || []).filter((m) => !m.isYou && m.userId);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await fileSafetyReport(group.id, { category, message: message.trim(), aboutUserId: aboutUserId || undefined });
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (sent) return <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#0F6B52' }}>Reported — staff will look into it.</div>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ marginTop: 10, border: 0, background: 'transparent', padding: 0, font: '700 12.5px Karla,sans-serif', color: '#B3261E', cursor: 'pointer', textDecoration: 'underline' }}>
        Report an issue
      </button>
    );
  }

  const field = { border: '1.5px solid rgba(33,28,38,.14)', borderRadius: 10, padding: '8px 10px', font: '600 13px Karla,sans-serif', background: '#fff' };

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={field}>
          {REPORT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {others.length > 0 && (
          <select value={aboutUserId} onChange={(e) => setAboutUserId(e.target.value)} style={field}>
            <option value="">About the ride</option>
            {others.map((m) => <option key={m.userId} value={m.userId}>About {m.name}</option>)}
          </select>
        )}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What happened?"
        rows={2}
        style={{ ...field, resize: 'vertical' }}
      />
      {error && <div className="error-msg-red">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} disabled={saving || message.trim().length < 5} onClick={submit}>
          {saving ? 'Sending…' : 'Send report'}
        </button>
        <button className="btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
