import { useState, useEffect } from 'react';

export default function NodeCombobox({ value, onChange, nodes, placeholder, excludeId = null }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  const availableNodes = nodes.filter(n => n.id !== excludeId);

  useEffect(() => {
    const selectedNode = nodes.find(n => n.id === value);
    if (selectedNode) {
      setText(selectedNode.name);
      setStatus({ type: 'success', message: `Matched to: ${selectedNode.name}` });
    } else if (!text) {
      setStatus(null);
    }
  }, [value, nodes]);

  function handleBlur() {
    if (!text.trim()) {
      onChange('');
      setStatus(null);
      return;
    }
    
    // Fuzzy match: case-insensitive includes
    const q = text.toLowerCase().trim();
    const match = availableNodes.find(n => 
      n.name.toLowerCase().includes(q) || 
      (n.shortName && n.shortName.toLowerCase().includes(q))
    );

    if (match) {
      setText(match.name);
      onChange(match.id);
      setStatus({ type: 'success', message: `Matched to: ${match.name}` });
    } else {
      onChange(''); // clear valid ID so form submission is blocked
      setStatus({ type: 'error', message: 'No nearby known route found' });
    }
  }

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={text}
        onChange={(e) => { setText(e.target.value); setStatus(null); }}
        onBlur={handleBlur}
        style={{
          width: '100%', border: 0, outline: 0, background: 'transparent',
          font: '500 15px Karla,sans-serif', color: '#211C26',
          padding: '14px 0', cursor: 'text',
        }}
      />
      
      {status && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          fontSize: 12, fontWeight: 600,
          color: status.type === 'success' ? '#0F6B52' : '#C24444'
        }}>
          {status.type === 'success' ? '✓ ' : '✗ '}{status.message}
        </div>
      )}
    </div>
  );
}
