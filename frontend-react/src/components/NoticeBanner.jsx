import { useState, useEffect } from 'react';
import { getActiveNotices } from '../api/client';

// Admin broadcasts ("no autos after 10pm tonight") that every student sees.
export default function NoticeBanner() {
  const [notices, setNotices] = useState([]);
  useEffect(() => { getActiveNotices().then(setNotices).catch(() => {}); }, []);
  if (notices.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      {notices.map((n) => (
        <div key={n.id} style={{
          borderRadius: 14, padding: '12px 16px', font: '600 13.5px Karla,sans-serif',
          background: n.level === 'warning' ? '#FFF1DB' : '#F4EEE3',
          color: n.level === 'warning' ? '#A96A0C' : 'rgba(33,28,38,.75)',
          border: `1px solid ${n.level === 'warning' ? 'rgba(169,106,12,.25)' : 'rgba(33,28,38,.08)'}`,
        }}>
          {n.level === 'warning' ? '\u26a0 ' : ''}{n.message}
        </div>
      ))}
    </div>
  );
}
