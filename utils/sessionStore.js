const SESSIONS = new Map(); // phone -> { state, ctx, updatedAt }

const TTL_MS = parseInt(process.env.SESSION_TTL_MS || `${24*60*60*1000}`, 10); // 24h default

export function getSession(phone) {
  const s = SESSIONS.get(phone);
  if (!s) return null;
  if (Date.now() - s.updatedAt > TTL_MS) {
    SESSIONS.delete(phone);
    return null;
  }
  return s;
}

export function setSession(phone, data) {
  SESSIONS.set(phone, { ...data, updatedAt: Date.now() });
}

export function clearSession(phone) {
  SESSIONS.delete(phone);
}
