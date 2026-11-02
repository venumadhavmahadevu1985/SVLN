// Data layer: Firebase Auth + Firestore + Storage. Every piece of data the site shows comes from here.
//   list(col, [field, '==', value]?) · get(col, id) · put(col, doc) · remove(col, id) · upload(file)
import { firebaseConfig, ENV } from './config.js';
import { newId } from './util.js';

const FIREBASE_VERSION = '10.12.2';
const MAX_RECEIPT = 5 * 1024 * 1024;

class FirebaseStore {
  async init() {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const mods = await Promise.all(['app', 'auth', 'firestore', 'storage'].map(m => import(`${base}/firebase-${m}.js`)));
    this.fb = Object.assign({}, ...mods);
    const app = this.fb.initializeApp(firebaseConfig);
    this.auth = this.fb.getAuth(app);
    this.fs = this.fb.getFirestore(app);
    this.st = this.fb.getStorage(app);
  }
  onAuth(cb) { return this.fb.onAuthStateChanged(this.auth, cb); }
  signInGoogle() { return this.fb.signInWithPopup(this.auth, new this.fb.GoogleAuthProvider()); }
  signInEmail(email, pw) { return this.fb.signInWithEmailAndPassword(this.auth, email, pw); }
  async signUpEmail(email, pw, name) {
    const cred = await this.fb.createUserWithEmailAndPassword(this.auth, email, pw);
    if (name) await this.fb.updateProfile(cred.user, { displayName: name });
    return cred;
  }
  signOut() { return this.fb.signOut(this.auth); }

  async list(col, where) {
    const { collection, getDocs, query, where: w } = this.fb;
    let q = collection(this.fs, col);
    if (where) q = query(q, w(...where));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async get(col, id) {
    const s = await this.fb.getDoc(this.fb.doc(this.fs, col, id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  }
  async put(col, doc) {
    const id = doc.id || newId();
    const { id: _, ...rest } = doc;
    const data = JSON.parse(JSON.stringify(rest)); // Firestore rejects undefined values
    await this.fb.setDoc(this.fb.doc(this.fs, col, id), data);
    return { id, ...data };
  }
  async remove(col, id) { await this.fb.deleteDoc(this.fb.doc(this.fs, col, id)); }

  // Who is online: lastSeen is stamped by the server so phones with a wrong clock still count.
  setPresence(uid, data) {
    return this.fb.setDoc(this.fb.doc(this.fs, 'presence', uid), { ...data, lastSeen: this.fb.serverTimestamp() });
  }
  watchPresence(cb) {
    return this.fb.onSnapshot(this.fb.collection(this.fs, 'presence'),
      snap => cb(snap.docs.map(d => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return { id: d.id, ...x, lastSeen: x.lastSeen?.toMillis?.() || 0 };
      })),
      () => cb(null));   // rules not published yet, or signed out: hide the strip
  }
  async upload(file) {
    if (file.size > MAX_RECEIPT) throw new Error('Receipts must be under 5 MB.');
    const path = `receipts/${newId()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const r = this.fb.ref(this.st, path);
    await this.fb.uploadBytes(r, file, { contentType: file.type });
    return { name: file.name, url: await this.fb.getDownloadURL(r), path };
  }
}

// Demo site (/demo/): sample data from demo-data.json kept in memory only. Visitors switch between
// demo accounts instead of signing in; reloading the page resets everything.
class DemoStore {
  demo = true;

  async init() {
    const d = await (await fetch('demo-data.json', { cache: 'no-store' })).json();
    this.db = {};
    for (const [col, docs] of Object.entries(d.collections)) for (const doc of docs) this._set(col, doc);
    this.accounts = d.accounts;
    for (const a of this.accounts) this._set('users', a);
    this.current = this.accounts[0];
  }
  _set(col, doc) { (this.db[col] ||= {})[doc.id] = structuredClone(doc); }
  _auth() { return { uid: this.current.id, email: this.current.email, displayName: this.current.name }; }
  onAuth(cb) { this.cb = cb; cb(this._auth()); }
  switchAccount(id) { this.current = this.accounts.find(a => a.id === id) || this.accounts[0]; this.cb(this._auth()); }
  signOut() {}

  async list(col, where) {
    let arr = Object.values(this.db[col] || {}).map(d => structuredClone(d));
    if (where) arr = arr.filter(d => d[where[0]] === where[2]);
    return arr;
  }
  async get(col, id) { const d = this.db[col]?.[id]; return d ? structuredClone(d) : null; }
  async put(col, doc) { const d = { ...doc, id: doc.id || newId() }; this._set(col, d); return d; }
  async remove(col, id) { delete this.db[col]?.[id]; }

  // Sample people in demo-data.json "presence" are always online, alongside whoever is viewing.
  async setPresence(uid, data) {
    this._set('presence', { ...data, id: uid, lastSeen: Date.now() });
    this._emitPresence();
  }
  watchPresence(cb) {
    this.presenceCb = cb;
    this._emitPresence();
    return () => { if (this.presenceCb === cb) this.presenceCb = null; };
  }
  _emitPresence() {
    const now = Date.now();
    this.presenceCb?.(Object.values(this.db.presence || {}).map(p => ({ ...p, lastSeen: p.lastSeen ?? now })));
  }
  async upload(file) {
    if (file.size > MAX_RECEIPT) throw new Error('Receipts must be under 5 MB.');
    return { name: file.name, url: URL.createObjectURL(file) };
  }
}

// null until this environment's Firebase config is filled in (the app then shows setup instructions).
export const store = ENV === 'demo' ? new DemoStore() : firebaseConfig ? new FirebaseStore() : null;
