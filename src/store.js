/* Device-local preferences. Nothing here is uploaded or shared with a server. */
const PREFIX = 'hex-';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* Private browsing is supported. */ }
}

/* Saved operators ---------------------------------------------------------- */
const listeners = new Set();
let saved = new Set((read('saved', []) || []).filter(id => typeof id === 'string'));

export const savedOperators = {
  list: () => [...saved],
  has: id => saved.has(id),
  count: () => saved.size,
  toggle(id) {
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    write('saved', [...saved]);
    listeners.forEach(fn => fn([...saved]));
    return saved.has(id);
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
};

/* Form drafts -------------------------------------------------------------- */
export const drafts = {
  load: key => {
    const value = read(`draft-${key}`, null);
    return value && typeof value === 'object' ? value : null;
  },
  save: (key, value) => write(`draft-${key}`, value),
  clear: key => remove(`draft-${key}`)
};

/* Recently used commands --------------------------------------------------- */
export const recents = {
  list: () => (read('recent-commands', []) || []).filter(id => typeof id === 'string').slice(0, 5),
  push(id) {
    const next = [id, ...recents.list().filter(item => item !== id)].slice(0, 5);
    write('recent-commands', next);
  }
};
