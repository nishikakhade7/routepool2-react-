import { useState, useEffect, useRef } from 'react';
import StatusChip from './StatusChip';
import { uploadDocument, documentObjectUrl, DOCUMENT_ACCEPT, MAX_DOCUMENT_BYTES } from '../../api/driver';

const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Thumbnail of the uploaded file (images), or a PDF tile that opens it.
function Preview({ doc }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!doc) return undefined;
    let made = null;
    documentObjectUrl(doc.id).then((u) => { made = u; setUrl(u); }).catch(() => setUrl(null));
    return () => { if (made) URL.revokeObjectURL(made); };
  }, [doc]);

  if (!doc) {
    return (
      <div className="dp-doc-preview" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0l-4 4m4-4l4 4M5 20h14" stroke="rgba(33,28,38,.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    );
  }
  const isImage = doc.mimeType.startsWith('image/');
  return (
    <a className="dp-doc-preview" href={url || undefined} target="_blank" rel="noreferrer" aria-label={`Open ${doc.fileName}`} style={{ textDecoration: 'none' }}>
      {isImage && url ? <img src={url} alt="" /> : (
        <span style={{ font: '700 13px Karla,sans-serif', color: '#8A2B6B', background: '#F7EBF3', padding: '8px 10px', borderRadius: 10 }}>PDF</span>
      )}
    </a>
  );
}

// One required document: status, dates, preview and upload/replace.
export default function DocumentSlot({ slot, onUploaded }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const doc = slot.current;

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!DOCUMENT_ACCEPT.split(',').includes(file.type)) { setError('Upload a PDF, JPG or PNG file.'); return; }
    if (file.size > MAX_DOCUMENT_BYTES) { setError('That file is over 5 MB. Try a smaller scan or photo.'); return; }
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadDocument(slot.type, file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // An older verified upload still clears the driver while a replacement waits for review.
  const stillCovered = slot.cleared && doc && doc.reviewStatus !== 'verified' && slot.activeUntil;

  return (
    <div className="dp-doc">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ font: '700 16px Familjen Grotesk,sans-serif' }}>{slot.label}</div>
        <StatusChip state={doc?.state || 'not_uploaded'} daysLeft={doc?.daysLeft} />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Preview doc={doc} />
        <div style={{ flex: '1 1 180px', fontSize: 13, fontWeight: 600, color: 'rgba(33,28,38,.6)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {doc ? (
            <>
              <span style={{ color: '#211C26', wordBreak: 'break-all' }}>{doc.fileName}</span>
              <span>Uploaded {day(doc.uploadedAt)}</span>
              <span>Valid until {day(doc.validUntil)}</span>
              {doc.note && <span style={{ color: '#B3261E' }}>Reviewer: {doc.note}</span>}
              {stillCovered && <span style={{ color: '#0F6B52' }}>Your previous one stays valid until {day(slot.activeUntil)}.</span>}
            </>
          ) : (
            <span>PDF, JPG or PNG, up to 5 MB.</span>
          )}
        </div>
        <div>
          <input ref={input} type="file" accept={DOCUMENT_ACCEPT} onChange={pick} className="visually-hidden" id={`file-${slot.type}`} tabIndex={-1} />
          <button type="button" className={doc ? 'btn-ghost' : 'btn-accent'} style={doc ? undefined : { width: 'auto', padding: '11px 18px', fontSize: 14.5 }}
            disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="dp-field-error">{error}</p>}
    </div>
  );
}
