import { useState, useRef, useEffect } from 'react';

export default function CustomTimePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  // parse HH:MM
  const [h, m] = (value || '').split(':');
  
  function handleHourSelect(hourStr) {
    onChange(`${hourStr}:${m || '00'}`);
  }

  function handleMinuteSelect(minStr) {
    onChange(`${h || '10'}:${minStr}`);
  }

  return (
    <div ref={wrapperRef} style={{ flex: 1, position: 'relative' }}>
      <input
        type="text"
        placeholder="HH:MM"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        style={{
          width: '100%', border: 0, outline: 0, background: 'transparent',
          font: '500 15px Karla,sans-serif', color: '#211C26',
          padding: '14px 0', cursor: 'text',
        }}
      />
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: -16, zIndex: 100,
          background: '#fff', border: '1px solid rgba(33,28,38,.08)',
          borderRadius: 12, marginTop: 8, overflow: 'hidden',
          boxShadow: '0 12px 24px -12px rgba(33,28,38,.15)',
          display: 'flex', width: 180, height: 220
        }}>
          {/* Hours Column */}
          <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid rgba(33,28,38,.04)' }} className="hide-scrollbar">
            {hours.map(hour => (
              <div
                key={`h-${hour}`}
                onClick={() => handleHourSelect(hour)}
                style={{
                  padding: '10px 16px', cursor: 'pointer', textAlign: 'center',
                  fontSize: 14, fontWeight: 500, color: h === hour ? '#8A2B6B' : '#211C26',
                  background: h === hour ? '#FFF1DB' : 'transparent'
                }}
                onMouseEnter={e => e.currentTarget.style.background = h === hour ? '#FFF1DB' : '#F4EEE3'}
                onMouseLeave={e => e.currentTarget.style.background = h === hour ? '#FFF1DB' : 'transparent'}
              >
                {hour}
              </div>
            ))}
          </div>

          {/* Minutes Column */}
          <div style={{ flex: 1, overflowY: 'auto' }} className="hide-scrollbar">
            {minutes.map(minute => (
              <div
                key={`m-${minute}`}
                onClick={() => handleMinuteSelect(minute)}
                style={{
                  padding: '10px 16px', cursor: 'pointer', textAlign: 'center',
                  fontSize: 14, fontWeight: 500, color: m === minute ? '#8A2B6B' : '#211C26',
                  background: m === minute ? '#FFF1DB' : 'transparent'
                }}
                onMouseEnter={e => e.currentTarget.style.background = m === minute ? '#FFF1DB' : '#F4EEE3'}
                onMouseLeave={e => e.currentTarget.style.background = m === minute ? '#FFF1DB' : 'transparent'}
              >
                {minute}
              </div>
            ))}
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
