// Document and re-verification status for a driver, worked out from their uploads.
// Pure functions: everything is derived from the rows, nothing is stored.
const { DOCUMENT_TYPES, DOCUMENT_VALID_MONTHS, DOCUMENT_REMINDER_DAYS } = require('../../config/driverPortal');

const DAY_MS = 86400000;

function validUntil(doc) {
  const d = new Date(doc.uploaded_at);
  d.setMonth(d.getMonth() + DOCUMENT_VALID_MONTHS);
  return d;
}

const daysLeft = (doc) => Math.ceil((validUntil(doc).getTime() - Date.now()) / DAY_MS);
const isActive = (doc) => doc.status === 'verified' && daysLeft(doc) >= 0;

// Chip shown on a single upload: not_uploaded | pending | verified | expiring | expired | rejected.
function documentState(doc) {
  if (!doc) return 'not_uploaded';
  if (daysLeft(doc) < 0) return 'expired';
  if (doc.status === 'rejected') return 'rejected';
  if (doc.status === 'pending') return 'pending';
  return daysLeft(doc) <= DOCUMENT_REMINDER_DAYS ? 'expiring' : 'verified';
}

const publicDocument = (doc) => doc && ({
  id: doc.id,
  fileName: doc.file_name,
  mimeType: doc.mime_type,
  sizeBytes: doc.size_bytes,
  uploadedAt: new Date(doc.uploaded_at).toISOString(),
  validUntil: validUntil(doc).toISOString(),
  daysLeft: daysLeft(doc),
  reviewStatus: doc.status,
  reviewedAt: doc.reviewed_at ? new Date(doc.reviewed_at).toISOString() : null,
  note: doc.note || null,
  state: documentState(doc),
});

// `docs` = every upload of this driver, newest first. The newest upload of each
// type is what the driver sees; a driver stays cleared on an older verified one
// until it runs out, so re-uploading early never takes them off the road.
function verificationOf(docs) {
  const documents = Object.entries(DOCUMENT_TYPES).map(([type, label]) => {
    const ofType = docs.filter((d) => d.type === type);
    const latest = ofType[0] || null;
    const active = ofType.find(isActive) || null;
    const everVerified = ofType.some((d) => d.status === 'verified');
    return {
      type,
      label,
      current: publicDocument(latest),
      // The upload that clears the driver today (may be older than `current`).
      activeUntil: active ? validUntil(active).toISOString() : null,
      activeDaysLeft: active ? daysLeft(active) : null,
      cleared: Boolean(active),
      lapsed: !active && everVerified,
    };
  });

  const blocking = documents.filter((d) => !d.cleared);
  const expiring = documents.filter((d) => d.cleared && d.activeDaysLeft <= DOCUMENT_REMINDER_DAYS
    // A replacement already sent in counts as dealt with.
    && !(d.current && d.current.reviewStatus === 'pending'));

  // One calm sentence for the banner, or null when there's nothing to say.
  let message = null;
  if (blocking.length) {
    const reasons = blocking.map((d) => {
      if (d.lapsed) return `your ${d.label.toLowerCase()} has expired`;
      if (!d.current) return `your ${d.label.toLowerCase()} hasn't been uploaded`;
      if (d.current.state === 'pending') return `your ${d.label.toLowerCase()} is waiting for review`;
      if (d.current.state === 'rejected') return `your ${d.label.toLowerCase()} was not accepted`;
      return `your ${d.label.toLowerCase()} needs to be uploaded again`;
    });
    message = `You can't take rides yet: ${reasons.join(' and ')}.`;
  } else if (expiring.length) {
    message = expiring.map((d) => `Your ${d.label.toLowerCase()} expires in ${d.activeDaysLeft} day${d.activeDaysLeft === 1 ? '' : 's'}`).join('. ')
      + '. Upload a new one so you stay on the road.';
  }

  return {
    verified: blocking.length === 0,
    reverificationRequired: documents.some((d) => d.lapsed),
    documents,
    reminder: expiring.length > 0,
    message,
  };
}

module.exports = { verificationOf, validUntil, isActive };
