// One tiny data layer with two engines:
//  - Firebase Realtime Database (live, shared by every phone)
//  - local demo mode (localStorage, shared between tabs) for testing
import { firebaseConfig } from './config.js';

export const SESSION = (new URLSearchParams(location.search).get('s') || 'class')
  .replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'class';
export const root = (p = '') => `sessions/${SESSION}${p ? '/' + p : ''}`;

function splitPath(p) { return p.split('/').filter(Boolean); }

function mockStore() {
  const KEY = 'aq_mock_db';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (t) => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch {} notifyAll(); };
  const get = (t, p) => splitPath(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), t);
  const setIn = (t, p, v) => {
    const ks = splitPath(p); let o = t;
    ks.slice(0, -1).forEach(k => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === null || v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v;
  };
  const listeners = new Set();
  function notifyAll() { const t = read(); listeners.forEach(l => l.cb(structuredClone(get(t, l.path) ?? null))); }
  window.addEventListener('storage', e => { if (e.key === KEY) notifyAll(); });
  let uid = sessionStorage.getItem('aq_mock_uid');
  if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('aq_mock_uid', uid); }
  return {
    mode: 'local', uid,
    on(path, cb) { const l = { path, cb }; listeners.add(l); cb(structuredClone(get(read(), path) ?? null)); return () => listeners.delete(l); },
    async get(path) { return structuredClone(get(read(), path) ?? null); },
    async set(path, v) { const t = read(); setIn(t, path, v); write(t); },
    async update(path, obj) { const t = read(); Object.entries(obj).forEach(([k, v]) => setIn(t, path + '/' + k, v)); write(t); },
    async remove(path) { const t = read(); setIn(t, path, null); write(t); },
  };
}

async function firebaseStore() {
  const V = '10.12.2';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const { getAuth, signInAnonymously, onAuthStateChanged } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const db_ = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`);
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const uid = await new Promise((res, rej) => {
    onAuthStateChanged(auth, u => { if (u) res(u.uid); });
    signInAnonymously(auth).catch(rej);
  });
  const db = db_.getDatabase(app);
  return {
    mode: 'live', uid,
    on(path, cb) { return db_.onValue(db_.ref(db, path), s => cb(s.val())); },
    async get(path) { return (await db_.get(db_.ref(db, path))).val(); },
    set(path, v) { return db_.set(db_.ref(db, path), v); },
    update(path, obj) { return db_.update(db_.ref(db, path), obj); },
    remove(path) { return db_.remove(db_.ref(db, path)); },
  };
}

export async function initStore() {
  if (firebaseConfig && firebaseConfig.apiKey) {
    try { return await firebaseStore(); }
    catch (e) { console.error('Firebase failed, using local demo mode', e); }
  }
  return mockStore();
}
