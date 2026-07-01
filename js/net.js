// Realtime abstraction with two interchangeable backends:
//   • LocalNet    — no server; localStorage + BroadcastChannel (great for testing).
//   • FirebaseNet — Firestore single-doc game state for real multiplayer.
//
// Both expose the same tiny API used by the game:
//   net.mode                      -> 'local' | 'firebase'
//   await net.ready()             -> resolves with a stable per-device uid
//   await net.create(state)       -> writes a new game doc, returns { code }
//   await net.join(code)          -> checks a game exists
//   net.subscribe(code, cb)       -> live updates, returns unsubscribe()
//   await net.update(code, fn)    -> transactional read-modify-write: fn(state) mutates in place
//
// The full game state is one plain object (small N players → one doc is plenty).

import { firebaseConfig, hasFirebase } from './firebase-config.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars

function makeCode() {
  let c = '';
  const rnd = crypto.getRandomValues(new Uint32Array(4));
  for (let i = 0; i < 4; i++) c += CODE_ALPHABET[rnd[i] % CODE_ALPHABET.length];
  return c;
}

// Per-tab identity for local mode. sessionStorage (not localStorage) so that
// each browser tab is a DISTINCT player — this is what lets you open a second
// tab to simulate another guest. It survives reloads within the same tab.
// (In Firebase mode the uid comes from anonymous auth instead.)
function stableUid() {
  let id = sessionStorage.getItem('ylc_uid');
  if (!id) {
    id = 'u_' + Math.abs(crypto.getRandomValues(new Uint32Array(1))[0]).toString(36) + Date.now().toString(36);
    sessionStorage.setItem('ylc_uid', id);
  }
  return id;
}

// ───────────────────────────── LOCAL BACKEND ─────────────────────────────
class LocalNet {
  constructor() {
    this.mode = 'local';
    this.uid = stableUid();
    this.chan = 'BroadcastChannel' in window ? new BroadcastChannel('ylc') : null;
    this.listeners = new Map(); // code -> Set<cb>  (in-process subscribers)
    // Cross-tab: BroadcastChannel and storage events fire only in OTHER tabs.
    this.chan?.addEventListener('message', (e) => this._emit(e.data?.code));
    window.addEventListener('storage', (e) => {
      if (e.key?.startsWith('ylc_game_')) this._emit(e.key.slice('ylc_game_'.length));
    });
  }
  async ready() { return this.uid; }

  _key(code) { return `ylc_game_${code}`; }
  _read(code) {
    const raw = localStorage.getItem(this._key(code));
    return raw ? JSON.parse(raw) : null;
  }
  // Notify every in-process subscriber for this code with the freshest state.
  _emit(code) {
    if (!code) return;
    const s = this._read(code);
    if (!s) return;
    (this.listeners.get(code) || []).forEach((cb) => cb(s));
  }
  _write(code, state) {
    localStorage.setItem(this._key(code), JSON.stringify(state));
    this._emit(code);                          // same tab (the actor)
    if (this.chan) this.chan.postMessage({ code }); // other tabs
  }

  async create(state) {
    let code = makeCode();
    while (this._read(code)) code = makeCode();
    state.code = code;
    this._write(code, state);
    return { code };
  }

  async join(code) {
    return Boolean(this._read(code));
  }

  subscribe(code, cb) {
    if (!this.listeners.has(code)) this.listeners.set(code, new Set());
    this.listeners.get(code).add(cb);
    const s = this._read(code);
    if (s) cb(s); // initial render
    return () => this.listeners.get(code)?.delete(cb);
  }

  async update(code, fn) {
    const state = this._read(code) || {};
    fn(state);
    this._write(code, state);
    return state;
  }
}

// ──────────────────────────── FIREBASE BACKEND ───────────────────────────
class FirebaseNet {
  constructor(fb) { Object.assign(this, fb); this.mode = 'firebase'; }
  async ready() { return this.uid; }

  _ref(code) { return this.doc(this.db, 'games', code); }

  async create(state) {
    let code = makeCode();
    // avoid collision
    for (let i = 0; i < 5; i++) {
      const snap = await this.getDoc(this._ref(code));
      if (!snap.exists()) break;
      code = makeCode();
    }
    state.code = code;
    await this.setDoc(this._ref(code), state);
    return { code };
  }

  async join(code) {
    const snap = await this.getDoc(this._ref(code));
    return snap.exists();
  }

  subscribe(code, cb) {
    return this.onSnapshot(this._ref(code), (snap) => { if (snap.exists()) cb(snap.data()); });
  }

  async update(code, fn) {
    const ref = this._ref(code);
    return this.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      const state = snap.exists() ? snap.data() : {};
      fn(state);
      tx.set(ref, state);
      return state;
    });
  }
}

async function initFirebase() {
  const V = '10.12.5';
  const app = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const auth = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const fbApp = app.initializeApp(firebaseConfig);
  const db = fs.getFirestore(fbApp);
  const a = auth.getAuth(fbApp);
  const cred = await auth.signInAnonymously(a);
  return new FirebaseNet({
    db,
    uid: cred.user.uid,
    doc: fs.doc,
    getDoc: fs.getDoc,
    setDoc: fs.setDoc,
    onSnapshot: fs.onSnapshot,
    runTransaction: fs.runTransaction,
  });
}

// Choose backend once. Falls back to local if Firebase fails to init.
let _net = null;
export async function getNet() {
  if (_net) return _net;
  if (hasFirebase) {
    try {
      _net = await initFirebase();
      return _net;
    } catch (err) {
      console.warn('Firebase init failed, using local mode:', err);
    }
  }
  _net = new LocalNet();
  return _net;
}
