// Cross-page constants that must stay in sync with backend env vars —
// read once here instead of duplicating the same env lookup in every page
// that needs it.
export const ALLOWED_EMAIL_DOMAIN = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'spit.ac.in';
