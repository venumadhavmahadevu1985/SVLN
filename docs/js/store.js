// Data layer. Both stores expose the same async API so the app doesn't care which one runs:
//   list(col, [field, '==', value]?) · get(col, id) · put(col, doc) · remove(col, id) · upload(file)
import { firebaseConfig } from './config.js';
import { newId } from './util.js';

const FIREBASE_VERSION = '10.12.2';
const MAX_DEMO_RECEIPT = 700 * 1024;
const MAX_LIVE_RECEIPT = 5 * 1024 * 1024;

const readAsDataURL = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

// Demo mode: everything lives in this browser's localStorage (in memory if storage is blocked).
class LocalStore {
  mode = 'demo';
  key = 'svln-paradise-data-v1';

  async init(seed) {
    try {
      this.db = JSON.parse(localStorage.getItem(this.key));
      localStorage.setItem(this.key + '-probe', '1');
      this.persist = true;
    } catch { this.persist = false; }
    if (!this.db) { this.db = seed(); this._save(); }
  }
  _save() {
    if (!this.persist) return;
    try { localStorage.setItem(this.key, JSON.stringify(this.db)); }
    catch { throw new Error('Could not save: browser storage is full. Remove some receipt files.'); }
  }
  async list(col, where) {
    let arr = Object.values(this.db[col] || {});
    if (where) arr = arr.filter(d => d[where[0]] === where[2]);
    return arr;
  }
  async get(col, id) { return this.db[col]?.[id] ?? null; }
  async put(col, doc) {
    const d = { ...doc, id: doc.id || newId() };
    (this.db[col] ||= {})[d.id] = d;
    this._save();
    return d;
  }
  async remove(col, id) { delete this.db[col]?.[id]; this._save(); }
  async upload(file) {
    if (file.size > MAX_DEMO_RECEIPT) throw new Error('In demo mode receipts must be under 700 KB (live mode allows 5 MB).');
    return { name: file.name, url: await readAsDataURL(file) };
  }
  async reset(seed) { this.db = seed(); this._save(); }
  async importAll(db) { this.db = db; this._save(); }
}

// Live mode: Firebase Auth + Firestore + Storage, loaded from Google's CDN only when configured.
class FirebaseStore {
  mode = 'live';

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
  async upload(file) {
    if (file.size > MAX_LIVE_RECEIPT) throw new Error('Receipts must be under 5 MB.');
    const path = `receipts/${newId()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const r = this.fb.ref(this.st, path);
    await this.fb.uploadBytes(r, file, { contentType: file.type });
    return { name: file.name, url: await this.fb.getDownloadURL(r), path };
  }
}

export const store = firebaseConfig ? new FirebaseStore() : new LocalStore();
