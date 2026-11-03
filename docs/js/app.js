// Every value shown on screen (society name, flats, amounts, categories, expenses…) is read from
// Firestore. The code only holds layout and wording, never society data.
import { ENV } from './config.js';
import { store } from './store.js';
import { barChart, donutChart } from './charts.js';
import { getLang, setLang, startTelugu } from './i18n.js';
import {
  esc, money, todayISO, curMonth, addMonths, monthsBetween, monthLabel, monthShort, dateLabel, dateTimeLabel,
  addDays, fyStart, fyLabel, daysUntil, pad, lastDay, trunc, ordinal, waNumber, friendlyError, profileCompleteness, NO_VEHICLES,
} from './util.js';

// Technical fallbacks for settings fields that may be missing (not society data).
const FALLBACK = { billing: 'fixed', fixedAmount: 0, ratePerSqft: 0, dueDay: 10, fyStartMonth: 4, openingBalance: 0, categories: [], paymentModes: [] };
// Monthly bills offered as quick links until the treasurer changes the list in Settings.
const DEFAULT_QUICK = ['Watchman', 'Electricity Bill', 'GVMC', 'Municipal Water'];

// ---------- state & small helpers ----------
const S = {
  user: null,
  info: null,          // public/info: society name + address (readable before sign-in)
  hasSettings: false,
  db: { flats: [], flatProfiles: {}, expenses: [], payments: [], vendors: [], notices: [], users: [], auditLog: [] },
  settings: { ...FALLBACK },
  collections: {},
  route: 'dashboard',
  ui: {
    exp: { q: '', month: 'all', category: 'all', vendor: 'all', sort: 'date-desc' },
    duesTab: 'grid', fy: null, reportTab: 'monthly', reportMonth: null, reportFy: null,
    spendView: null,   // "Where the money went": a month (YYYY-MM) or 'year'; null = current month
  },
  online: null,        // people using the app right now (null = not available)
};

const $ = sel => document.querySelector(sel);
const $view = $('#view'), $modal = $('#modal');
const isAdmin = () => S.user?.role === 'admin';
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const uniq = arr => [...new Set(arr.filter(Boolean))];
const lines = v => String(v || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const byExpenseOrder = (a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '') || (a.seq ?? 0) - (b.seq ?? 0);
const flatById = id => S.db.flats.find(f => f.id === id);
const flatName = f => `Flat ${f.id}${f.owner ? ' · ' + f.owner : ''}`;
const empty = msg => `<p class="empty">${esc(msg)}</p>`;
const societyName = () => S.settings.name || S.info?.name || '';
const datalist = (id, items) => `<datalist id="${id}">${items.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;

// Pick-lists are built from Settings plus whatever has already been used, so nothing is fixed in code.
const categoryList = () => uniq([...(S.settings.categories || []), ...S.db.expenses.map(e => e.category)]);
const modeList = () => uniq([...(S.settings.paymentModes || []), ...S.db.expenses.map(e => e.mode), ...S.db.payments.map(p => p.mode)]);
const periodList = () => uniq(S.db.vendors.map(v => v.period));

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  wallet: 'M3 7h18v13H3zM3 7l3-4h12l3 4M16 14h2',
  chart: 'M4 20V10M10 20V4M16 20v-7M2 20h20',
  tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  megaphone: 'M3 10v4h4l6 4V6l-6 4zM17 9a4 4 0 0 1 0 6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.7 1L15 22h-4l-.4-2.1a7 7 0 0 1-1.7-1l-1.9.7-2-3.4L6.6 15a7 7 0 0 1 0-2L5 11.8l2-3.4 1.9.7a7 7 0 0 1 1.7-1L11 6h4l.4 2.1a7 7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12m-5-5 5 5 5-5M4 21h16',
  upload: 'M12 21V9m-5 5 5-5 5 5M4 3h16',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z',
  clip: 'M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  chat: 'M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12z',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.6',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

// ----- busy buttons -----
// While a button's work is running it shows the animated S V L N letters, is disabled and announced as
// busy, and further taps are ignored, so a slow connection can't save the same thing twice.
const SVLN_LOADER = '<span class="svln-loader" aria-hidden="true"><i>S</i><i>V</i><i>L</i><i>N</i></span>';
const busyTarget = el => el?.closest?.('.btn, .icon-btn, .link-btn, button') || null;
const isBusy = el => !!busyTarget(el)?.classList.contains('is-busy');
async function withBusy(el, work) {
  const btn = busyTarget(el);
  if (!btn) return work();
  const wasDisabled = btn.disabled;
  btn.classList.add('is-busy');
  btn.setAttribute('aria-busy', 'true');
  btn.insertAdjacentHTML('afterbegin', SVLN_LOADER);
  if ('disabled' in btn) btn.disabled = true;
  try { return await work(); }
  finally {
    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-busy');
    btn.querySelector(':scope > .svln-loader')?.remove();
    if ('disabled' in btn) btn.disabled = wasDisabled;
  }
}

function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + kind;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = ''), 3200);
}


async function copyText(text, msg = 'Copied — paste it in WhatsApp') {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  toast(msg);
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileSlug = () => (societyName() || 'society').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- money maths ----------
function spentByMonth() {
  const m = {};
  for (const e of S.db.expenses) { const k = e.date.slice(0, 7); m[k] = (m[k] || 0) + Number(e.amount); }
  return m;
}
// Balance in hand at the end of month mk.
function balanceThrough(mk) {
  let b = Number(S.settings.openingBalance) || 0;
  for (const [k, v] of Object.entries(S.collections)) if (k <= mk) b += v;
  for (const [k, v] of Object.entries(spentByMonth())) if (k <= mk) b -= v;
  return b;
}
function categoryTotals(exps) {
  const m = {};
  for (const e of exps) m[e.category] = (m[e.category] || 0) + Number(e.amount);
  return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
const PALETTE = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
function topCategories(exps) {
  const all = categoryTotals(exps), top = all.slice(0, 6), rest = sum(all.slice(6), x => x.value);
  const out = top.map((x, i) => ({ ...x, color: PALETTE[i] }));
  if (rest > 0) out.push({ label: 'Others', value: rest, color: '--c7' });
  return out;
}

// ---------- dues ----------
const billingMonths = () => monthsBetween(S.settings.startMonth, curMonth());

// Maintenance amount in force for a month. Each change is kept in settings.billingHistory with the
// month it applies from, so raising the amount later never changes what earlier months owed.
function billingFor(mk = curMonth()) {
  const s = S.settings;
  let rate = { billing: s.billing, fixedAmount: s.fixedAmount, ratePerSqft: s.ratePerSqft };
  for (const e of [...(s.billingHistory || [])].sort((a, b) => a.from.localeCompare(b.from))) if (e.from <= mk) rate = e;
  return rate;
}
function dueAmount(f, mk = curMonth()) {
  if (Number(f.override) > 0) return Number(f.override);
  const r = billingFor(mk);
  return r.billing === 'sqft' ? Math.round((Number(f.sqft) || 0) * Number(r.ratePerSqft)) : Number(r.fixedAmount) || 0;
}
const paymentsFor = (flatId, mk) => S.db.payments.filter(p => p.flatId === flatId && p.month === mk);
function status(f, mk) {
  const due = dueAmount(f, mk), paid = sum(paymentsFor(f.id, mk), p => p.amount);
  if (paid >= due) return { key: 'paid', due, paid, label: 'Paid' };
  const overdue = todayISO() > `${mk}-${pad(Math.min(S.settings.dueDay, lastDay(mk)))}`;
  return { key: overdue ? 'overdue' : 'pending', due, paid, label: paid > 0 ? 'Partly paid' : overdue ? 'Overdue' : 'Due' };
}
function outstanding(f) {
  const months = billingMonths().map(mk => ({ mk, ...status(f, mk) })).filter(x => x.key !== 'paid');
  return { months, total: sum(months, x => x.due - x.paid) };
}
function reminderText(f, o) {
  const months = o.months.map(x => monthLabel(x.mk, true)).join(', ');
  const who = f.owner ? `${f.owner} garu (Flat ${f.id})` : `Flat ${f.id}`;
  return `Namaste ${who}, a gentle reminder from ${societyName()}: maintenance of ${money(o.total)} is pending for ${months}. ${S.settings.payNote || ''} Thank you! — ${S.settings.treasurer || ''}`.replace(/\s+/g, ' ').trim();
}

// ---------- data loading & writes ----------
async function loadData() {
  const [flats, expenses, vendors, notices, meta] = await Promise.all(
    ['flats', 'expenses', 'vendors', 'notices', 'meta'].map(c => store.list(c)));
  const payments = isAdmin() ? await store.list('payments')
    : S.user.flatId ? await store.list('payments', ['flatId', '==', S.user.flatId]) : [];
  // Contact details are private: admins load every flat's, residents only their own.
  const profiles = isAdmin() ? await store.list('flatProfiles')
    : S.user.flatId ? [await store.get('flatProfiles', S.user.flatId)].filter(Boolean) : [];
  S.db = {
    flats: flats.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })),
    flatProfiles: Object.fromEntries(profiles.map(p => [p.id, p])),
    expenses, vendors, notices, payments, users: [], auditLog: [],
  };
  const settings = meta.find(m => m.id === 'settings');
  S.hasSettings = !!settings;
  S.settings = { ...FALLBACK, ...(settings || {}) };
  if (!S.settings.startMonth) S.settings.startMonth = curMonth();
  const coll = meta.find(m => m.id === 'collections');
  S.collections = coll?.byMonth || {};
  if (isAdmin()) {
    // Totals saved before receipts were counted by dues month are rebuilt once.
    if (coll && coll.basis !== COLLECTION_BASIS) S.collections = await refreshCollectionTotals();
    S.db.auditLog = (await store.list('auditLog')).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
    S.db.users = await store.list('users');
  }
}

async function audit(action, entity, entityId, summary) {
  await store.put('auditLog', { at: new Date().toISOString(), by: S.user.uid, byName: S.user.name, action, entity, entityId, summary });
}

// Receipts per month are kept in meta/collections so residents can see totals without being able
// to read other flats' payment records. Like the notebook ("Receipts @ ₹1,000 × 8" for October),
// a payment counts in the month its dues are for, whichever day it was actually received.
const COLLECTION_BASIS = 'dues-month';
async function refreshCollectionTotals() {
  const byMonth = {};
  for (const p of await store.list('payments')) {
    const k = p.month || p.paidOn.slice(0, 7);
    byMonth[k] = (byMonth[k] || 0) + Number(p.amount);
  }
  await store.put('meta', { id: 'collections', basis: COLLECTION_BASIS, byMonth, updatedAt: new Date().toISOString() });
  return byMonth;
}

async function save(col, doc, summary) {
  const now = new Date().toISOString(), isNew = !doc.id;
  const d = await store.put(col, { ...doc, ...(isNew ? { createdAt: now, createdBy: S.user.name } : {}), updatedAt: now, updatedBy: S.user.name });
  await audit(isNew ? 'create' : 'update', col, d.id, summary);
  if (col === 'payments') await refreshCollectionTotals();
  return d;
}

async function del(col, id, summary) {
  await store.remove(col, id);
  await audit('delete', col, id, summary);
  if (col === 'payments') await refreshCollectionTotals();
}

async function refresh(msg) {
  await loadData();
  renderChrome();
  rerender();
  if (msg) toast(msg);
}

// Settings are private to members; name + address are also copied to public/info for the sign-in page.
async function saveSettings(patch, summary) {
  const { id, createdAt, createdBy, updatedAt, updatedBy, ...clean } = { ...S.settings, ...patch };
  await save('meta', { ...clean, id: 'settings' }, summary);
  await store.put('public', { id: 'info', name: clean.name || '', address: clean.address || '', updatedAt: new Date().toISOString() });
  S.info = { name: clean.name || '', address: clean.address || '' };
}

// ---------- modal ----------
function openModal(title, body, { onSubmit, submitLabel = 'Save', footer = '' } = {}) {
  $modal.innerHTML = `
    <form class="modal-card">
      <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></header>
      <div class="modal-body">${body}</div>
      ${onSubmit || footer ? `<footer><p class="form-error" hidden></p>${footer}
        ${onSubmit ? `<button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
        <button class="btn primary" type="submit">${esc(submitLabel)}</button>` : ''}</footer>` : ''}
    </form>`;
  const form = $modal.querySelector('form');
  form.onsubmit = async e => {
    e.preventDefault();
    if (!onSubmit) return;
    const btn = form.querySelector('[type=submit]'), err = form.querySelector('.form-error');
    if (isBusy(btn)) return; // a second tap or Enter while saving
    err.hidden = true;
    const fd = new FormData(form);
    // Close only if this form is still showing: a submit may open the next dialog (e.g. the pay slip).
    try { await withBusy(btn, () => onSubmit(fd, form)); if ($modal.querySelector('form') === form) closeModal(); }
    catch (ex) { console.error(ex); err.textContent = ex.message || String(ex); err.hidden = false; }
  };
  if (!$modal.open) $modal.showModal();
}
const closeModal = () => $modal.open && $modal.close();

// ---------- chrome: header + navigation ----------
const NAV = [
  ['dashboard', 'Home', 'home'],
  ['expenses', 'Expenses', 'receipt'],
  ['dues', 'Dues', 'wallet'],
  ['reports', 'Reports', 'chart'],
  ['staff', 'Staff', 'people'],
  ['vendors', 'Vendors', 'tool'],
  ['notices', 'Notices', 'megaphone'],
  ['settings', 'Settings', 'gear', true],
];
const navItems = () => NAV.filter(n => !n[3] || isAdmin());

// తెలుగు / English: each phone keeps its own choice; switching reloads so every screen redraws in it.
const langBtn = () => getLang() === 'te'
  ? '<button class="icon-btn lang-btn" data-action="lang" translate="no" lang="en" aria-label="Switch to English" title="Switch to English">EN</button>'
  : '<button class="icon-btn lang-btn" data-action="lang" translate="no" lang="te" aria-label="తెలుగులో చూడండి (Telugu)" title="తెలుగులో చూడండి (Telugu)">తె</button>';
const themeBtn = () => `<button class="icon-btn" data-action="theme" aria-label="Switch light or dark theme" title="Light / dark">${icon('moon')}</button>`;
const stagePill = () => ENV === 'stage' ? '<span class="pill stage" title="Test copy of the site — uses the stage database, not the live one">Stage</span>'
  : ENV === 'demo' ? '<span class="pill" title="Sample data — nothing you change here is saved">Demo</span>' : '';

function renderBrand() {
  const name = societyName();
  $('#brandName').textContent = name || 'Maintenance';
  $('#brandSub').textContent = name ? 'Maintenance & expenses' : '';
  const tag = { stage: '[Stage] ', demo: '[Demo] ' }[ENV] || '';
  document.title = `${tag}${name ? name + ' · ' : ''}Maintenance`;
}

// Demo visitors pick which sample account to look through instead of signing in.
const demoSwitcher = () => `<label class="sr-only" for="demoAccount">View as</label>
  <select id="demoAccount" class="select-sm" data-change="demo-account" title="See the site as the treasurer or as a resident">
    ${store.accounts.map(a => `<option value="${esc(a.id)}"${a.id === S.user?.uid ? ' selected' : ''}>${esc(a.label || a.name)}</option>`).join('')}
  </select>`;

function renderChrome() {
  renderBrand();
  const who = !S.user ? '' : store.demo ? demoSwitcher() : `
    <span class="who"><strong>${esc(S.user.name)}</strong><small>${S.user.role === 'admin' ? 'Admin' : S.user.flatId ? 'Flat ' + esc(S.user.flatId) : 'Resident'}</small></span>
    <button class="btn sm ghost" data-action="sign-out">Sign out</button>`;
  $('#userBox').innerHTML = stagePill() + who + langBtn() + themeBtn();
  renderNav();
}

function renderNav() {
  const items = navItems();
  const link = ([id, label, ic]) => `<a href="#/${id}" class="${S.route === id ? 'active' : ''}"${S.route === id ? ' aria-current="page"' : ''}>${icon(ic)}<span>${id === 'dues' && !isAdmin() ? 'My flat' : label}</span></a>`;
  $('#nav').innerHTML = items.map(link).join('');
  const moreActive = items.slice(4).some(n => n[0] === S.route);
  $('#bottomNav').innerHTML = items.slice(0, 4).map(link).join('') +
    `<button type="button" data-action="more" class="${moreActive ? 'active' : ''}">${icon('more')}<span>More</span></button>`;
}

// Full-screen messages (sign-in, setup, waiting) hide the navigation.
function renderBare(html) {
  document.body.classList.add('bare');
  renderBrand();
  $('#userBox').innerHTML = stagePill() + (!S.user ? '' : store?.demo ? demoSwitcher() : '<button class="btn sm ghost" data-action="sign-out">Sign out</button>') + langBtn() + themeBtn();
  $view.removeAttribute('aria-busy');
  $view.innerHTML = html;
}

// ---------- who is online ----------
// Each signed-in member keeps presence/{uid} fresh while the app is open and in front; anyone seen
// in the last few minutes counts as online. The strip updates live without redrawing the page.
const BEAT_MS = 60_000, ONLINE_MS = 150_000;
let presence = null;   // { unwatch, timer, tick, onVis, onHide }

function presenceDoc(online) {
  return { name: S.user.name || S.user.email || '', role: S.user.role, flatId: S.user.flatId || null, online };
}
function beat(online = document.visibilityState === 'visible') {
  return store.setPresence?.(S.user.uid, presenceDoc(online)).catch(() => {});
}
function onlineNowHtml() {
  const list = S.online || [];
  const me = list.find(p => p.id === S.user?.uid);
  const others = list.filter(p => p !== me).sort((a, b) => (a.flatId || '').localeCompare(b.flatId || '') || (a.name || '').localeCompare(b.name || ''));
  const who = p => `<li class="online-chip"><span class="dot" aria-hidden="true"></span><span>${p === me ? 'You' : esc(p.name || 'Member')}</span>
    <small>${p.role === 'admin' ? 'Admin' + (p.flatId ? ' · ' + esc(p.flatId) : '') : p.flatId ? 'Flat ' + esc(p.flatId) : 'Resident'}</small></li>`;
  const n = list.length;
  return `<div class="online-head"><span class="dot live" aria-hidden="true"></span><strong>${n} ${n === 1 ? 'person' : 'people'} online now</strong>
    ${n === 1 && me ? '<small class="muted">Only you right now</small>' : ''}</div>
    <ul class="online-list">${[me, ...others].filter(Boolean).map(who).join('')}</ul>`;
}
function setOnline(all) {
  const now = Date.now();
  S.online = all && all.filter(p => p.online !== false && now - (p.lastSeen || 0) < ONLINE_MS);
  const el = document.getElementById('onlineNow');
  if (el) { el.hidden = !S.online; el.innerHTML = onlineNowHtml(); }
}
async function startPresence() {
  await stopPresence(false);
  if (!store.watchPresence) return;
  let last = null;
  const p = presence = {
    unwatch: store.watchPresence(all => { last = all; setOnline(all); }),
    timer: setInterval(() => { if (document.visibilityState === 'visible') beat(true); }, BEAT_MS),
    tick: setInterval(() => setOnline(last), 30_000),   // drop people whose app went quiet
    onVis: () => beat(),
    onHide: () => beat(false),
  };
  document.addEventListener('visibilitychange', p.onVis);
  window.addEventListener('pagehide', p.onHide);
  await beat();
}
async function stopPresence(markOffline = true) {
  const p = presence;
  if (!p) return;
  presence = null;
  p.unwatch?.(); clearInterval(p.timer); clearInterval(p.tick);
  document.removeEventListener('visibilitychange', p.onVis);
  window.removeEventListener('pagehide', p.onHide);
  if (markOffline && S.user) await beat(false);
  S.online = null;
}

// ---------- routing ----------
const VIEWS = {
  dashboard: viewDashboard, expenses: viewExpenses, dues: viewDues, reports: viewReports,
  staff: viewStaff, vendors: viewVendors, notices: viewNotices, settings: viewSettings,
};

function route() {
  if (!S.user || !['admin', 'resident'].includes(S.user.role) || !S.hasSettings) return;
  let r = location.hash.replace(/^#\/?/, '') || 'dashboard';
  if (!VIEWS[r] || (r === 'settings' && !isAdmin())) r = 'dashboard';
  const changed = r !== S.route;
  S.route = r;
  rerender();
  if (changed) { window.scrollTo(0, 0); $view.focus({ preventScroll: true }); }
}
function rerender() {
  renderNav();
  $view.removeAttribute('aria-busy');
  $view.innerHTML = VIEWS[S.route]();
}

// ---------- dashboard ----------
function kpi(label, value, note, cls = '') {
  return `<div class="kpi ${cls}"><span>${esc(label)}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`;
}

function vendorAlerts() {
  return S.db.vendors.filter(v => v.amcRenewal && daysUntil(v.amcRenewal) <= 30)
    .sort((a, b) => a.amcRenewal.localeCompare(b.amcRenewal))
    .map(v => {
      const d = daysUntil(v.amcRenewal);
      return `<a class="banner ${d < 0 ? 'bad' : 'warn'}" href="#/vendors">${icon('tool')}<div>
        <strong>${esc(v.name)} — ${esc(v.service)} contract ${d < 0 ? `expired ${-d} day${d === -1 ? '' : 's'} ago` : d === 0 ? 'expires today' : `renews in ${d} day${d === 1 ? '' : 's'}`}</strong>
        <span>Renewal date ${dateLabel(v.amcRenewal)}</span></div></a>`;
    }).join('');
}

function myDuesBanner() {
  const f = flatById(S.user.flatId);
  if (!f) return '';
  const o = outstanding(f);
  return o.total > 0
    ? `<a class="banner warn" href="#/dues">${icon('wallet')}<div><strong>${money(o.total)} due for Flat ${esc(f.id)}</strong><span>${o.months.map(x => monthLabel(x.mk, true)).join(', ')} · tap to see details</span></div></a>`
    : `<div class="banner ok">${icon('wallet')}<div><strong>Flat ${esc(f.id)}: all dues paid</strong><span>Thank you for paying on time.</span></div></div>`;
}

function viewDashboard() {
  const s = S.settings, cm = curMonth(), fy = fyStart(cm, s.fyStartMonth);
  const fyMonths = monthsBetween(fy, cm), spent = spentByMonth(), coll = S.collections;
  const mSum = (o, ks) => sum(ks, k => o[k] || 0);
  const firstMonth = [s.startMonth, ...Object.keys(spent)].sort()[0];
  const trend = monthsBetween([addMonths(cm, -11), firstMonth].sort().pop(), cm);
  const spendView = S.ui.spendView || cm, spendYear = spendView === 'year';
  const donut = topCategories(S.db.expenses.filter(e => spendYear ? e.date.slice(0, 7) >= fy && e.date.slice(0, 7) <= cm : e.date.startsWith(spendView)));
  const recent = [...S.db.expenses].sort((a, b) => byExpenseOrder(b, a)).slice(0, 5);
  const pinned = S.db.notices.filter(n => n.pinned).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const prev = addMonths(cm, -1);
  const needsData = isAdmin() && !S.db.flats.length && !S.db.expenses.length;
  const waiting = isAdmin() ? S.db.users.filter(u => u.role === 'pending') : [];

  return `
    <div class="page-head"><div><h1>Overview</h1><p class="muted">${esc(monthLabel(cm, true))} · ${fyLabel(fy)}</p></div>
      ${isAdmin() ? `<div class="actions"><button class="btn ghost" data-action="add-notice">${icon('megaphone')}<span>Post notice</span></button></div>` : ''}</div>
    <section id="onlineNow" class="online-now" aria-live="polite"${S.online ? '' : ' hidden'}>${onlineNowHtml()}</section>
    ${installBanner()}
    ${store.demo ? `<div class="banner info">${icon('home')}<div><strong>Demo with sample data</strong>
      <span>Use “View as” at the top to switch between the treasurer and a resident. Try anything — changes are not saved and reset when you reload.</span></div></div>` : ''}
    ${waiting.length ? `<a class="banner warn" href="#/settings">${icon('home')}<div>
      <strong>${waiting.length} ${waiting.length === 1 ? 'person is' : 'people are'} waiting for approval</strong>
      <span>${waiting.map(u => esc(u.name || u.email) + (u.requestedFlat ? ` (Flat ${esc(u.requestedFlat)})` : '')).join(', ')} · approve in Settings → Members</span></div></a>` : ''}
    ${needsData ?`<a class="banner info" href="#/settings">${icon('upload')}<div><strong>No accounts yet</strong><span>Add flats under Dues → Flats & amount, or import a data file in Settings.</span></div></a>` : ''}
    ${pinned.map(n => `<a class="banner notice" href="#/notices">${icon('megaphone')}<div><strong>${esc(n.title)}</strong>
      <span>${esc(trunc(n.body, 160))}</span><small class="banner-date">${dateLabel(n.date)}</small></div></a>`).join('')}
    ${isAdmin() ? vendorAlerts() : ''}
    ${!isAdmin() && S.user.flatId ? myDuesBanner() : ''}
    ${taxBanners()}
    ${!isAdmin() ? myProfileNudge() : ''}
    ${isAdmin() ? profileSummaryCard() : ''}
    ${quickLinks()}
    <section class="kpis">
      ${kpi('Balance in hand', money(balanceThrough(cm)), `Brought forward ${money(balanceThrough(prev))}`, 'hero')}
      ${kpi(`Collected · ${monthLabel(cm)}`, money(coll[cm] || 0), `${monthLabel(prev)}: ${money(coll[prev] || 0)}`)}
      ${kpi(`Spent · ${monthLabel(cm)}`, money(spent[cm] || 0), `${monthLabel(prev)}: ${money(spent[prev] || 0)}`)}
      ${kpi(`Spent · ${fyLabel(fy)}`, money(mSum(spent, fyMonths)), `Collected ${money(mSum(coll, fyMonths))}`)}
    </section>
    <section class="grid-2">
      <div class="card">
        <div class="card-head"><h2>Collected vs spent</h2><span class="muted">by month</span></div>
        ${barChart(trend.map(monthShort), [
          { name: 'Collected', cls: 'in', values: trend.map(m => coll[m] || 0) },
          { name: 'Spent', cls: 'out', values: trend.map(m => spent[m] || 0) },
        ], { title: 'Monthly collections and spending' })}
      </div>
      <div class="card">
        <div class="card-head"><h2>Where the money went</h2>
          <label class="sr-only" for="spendView">Show spending for</label>
          <select id="spendView" class="select-sm" data-change="spend-view">
            ${monthsBetween(fy, cm).reverse().map(m => `<option value="${m}"${m === spendView ? ' selected' : ''}>${monthLabel(m, true)}</option>`).join('')}
            <option value="year"${spendYear ? ' selected' : ''}>Whole year ${fyLabel(fy)}</option>
          </select></div>
        ${donut.length ? donutChart(donut, { centerLabel: spendYear ? 'spent this year' : `spent in ${monthShort(spendView)}` })
          : empty(spendYear ? 'No expenses recorded this year yet.' : `No expenses recorded in ${monthLabel(spendView, true)} yet.`)}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Recent expenses</h2><a href="#/expenses" class="link">See all</a></div>
      <div class="list">${recent.map(expenseRow).join('') || empty('No expenses yet.')}</div>
    </section>`;
}

// ---------- monthly quick links ----------
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const quickList = () => Array.isArray(S.settings.quickExpenses) ? S.settings.quickExpenses : DEFAULT_QUICK;
const lc = v => String(v || '').toLowerCase();

// The latest expense for a quick link: description starting with the name wins, then the category.
function lastQuickExpense(label, inMonth) {
  const l = lc(label), pool = S.db.expenses.filter(e => !inMonth || e.date.startsWith(inMonth));
  const latest = arr => arr.sort((a, b) => byExpenseOrder(b, a))[0];
  return latest(pool.filter(e => lc(e.description).startsWith(l))) || latest(pool.filter(e => lc(e.category).startsWith(l)));
}
const quickStaff = label => staffList().find(st => lc(st.role).startsWith(lc(label)) || lc(st.name).startsWith(lc(label)));

function quickLinks() {
  const items = quickList();
  if (!isAdmin() || !items.length) return '';
  const cm = curMonth();
  return `<section class="card quick-links" aria-label="Monthly bills">
    <div class="card-head"><h2>Monthly bills</h2><span class="muted">${esc(monthLabel(cm, true))} · tap to add</span></div>
    <div class="quick-grid">${items.map((label, i) => {
      const paid = lastQuickExpense(label, cm), done = !!paid;
      return `<button type="button" class="quick-btn${done ? ' done' : ''}" data-action="quick-expense" data-i="${i}">
        <strong>${esc(label)}</strong>
        <small>${done ? `✓ Paid ${money(paid.amount)} · ${dateLabel(paid.date)}` : 'Not added this month'}</small></button>`;
    }).join('')}</div></section>`;
}

// Start a new expense from the last one with the same name: same category, vendor, mode and
// amount, the month in the description moved to this month. Staff (e.g. the watchman) open Pay salary.
function openQuickExpense(label) {
  const st = quickStaff(label);
  if (st) return payStaffModal(st);
  const last = lastQuickExpense(label);
  const thisMonth = MONTH_NAMES[Number(curMonth().slice(5)) - 1];
  const draft = last
    ? { category: last.category, vendor: last.vendor, mode: last.mode, amount: last.amount,
        description: last.description.replace(new RegExp(`\\b(${MONTH_NAMES.join('|')})\\b`, 'g'), thisMonth) }
    : { description: label, category: categoryList().find(c => lc(c).startsWith(lc(label).split(' ')[0])) || '' };
  openModal(`Add expense · ${label}`, expenseForm(draft), { onSubmit: fd => submitExpense(fd) });
}

// ---------- expenses ----------
function expenseRow(e) {
  const d = e.date.split('-')[2];
  return `<button type="button" class="row" data-action="view-expense" data-id="${esc(e.id)}">
    <span class="row-date"><b>${+d}</b><small>${monthShort(e.date.slice(0, 7))}</small></span>
    <span class="row-main"><strong>${esc(e.description)}</strong><small>${esc(e.category)}${e.vendor ? ' · ' + esc(e.vendor) : ''}</small></span>
    <span class="row-amt">${e.receipt ? `<i title="Receipt attached">${icon('clip')}</i>` : ''}${money(e.amount)}</span>
  </button>`;
}

function filteredExpenses() {
  const f = S.ui.exp, q = f.q.trim().toLowerCase();
  const list = S.db.expenses.filter(e =>
    (f.month === 'all' || e.date.startsWith(f.month)) &&
    (f.category === 'all' || e.category === f.category) &&
    (f.vendor === 'all' || e.vendor === f.vendor) &&
    (!q || [e.description, e.vendor, e.category, e.paidBy, e.mode].join(' ').toLowerCase().includes(q)));
  const [key, dir] = f.sort.split('-'), sign = dir === 'asc' ? 1 : -1;
  return list.sort((a, b) => sign * (key === 'amount' ? a.amount - b.amount : byExpenseOrder(a, b)));
}

function expList() {
  const list = filteredExpenses();
  if (!list.length) return empty(S.db.expenses.length ? 'No expenses match these filters.' : 'No expenses recorded yet.');
  const head = `<p class="list-summary"><span>${list.length} expense${list.length === 1 ? '' : 's'}</span><strong>${money(sum(list, e => e.amount))}</strong></p>`;
  if (!S.ui.exp.sort.startsWith('date')) return head + `<div class="card list">${list.map(expenseRow).join('')}</div>`;
  const groups = [];
  for (const e of list) {
    const mk = e.date.slice(0, 7);
    if (groups.at(-1)?.mk !== mk) groups.push({ mk, items: [] });
    groups.at(-1).items.push(e);
  }
  return head + groups.map(g => `
    <section class="group">
      <h3 class="group-head"><span>${monthLabel(g.mk, true)}</span><span>${money(sum(g.items, e => e.amount))}</span></h3>
      <div class="card list">${g.items.map(expenseRow).join('')}</div>
    </section>`).join('');
}

function viewExpenses() {
  const f = S.ui.exp;
  const months = [...new Set(S.db.expenses.map(e => e.date.slice(0, 7)))].sort().reverse();
  const vendors = uniq(S.db.expenses.map(e => e.vendor)).sort();
  const sel = (key, all, items, label = x => x) => `<select data-filter="${key}" aria-label="${key}">
    <option value="all">${all}</option>${items.map(v => `<option value="${esc(v)}"${f[key] === v ? ' selected' : ''}>${esc(label(v))}</option>`).join('')}</select>`;
  return `
    <div class="page-head">
      <div><h1>Expenses</h1><p class="muted">Every rupee spent from the maintenance fund.</p></div>
      <div class="actions">
        <button class="btn ghost" data-action="export-csv">${icon('download')}<span>Export</span></button>
        ${isAdmin() ? `<button class="btn primary" data-action="add-expense">${icon('plus')}<span>Add expense</span></button>` : ''}
      </div>
    </div>
    ${quickLinks()}
    <div class="card toolbar">
      <input type="search" data-filter="q" placeholder="Search description, vendor…" value="${esc(f.q)}" aria-label="Search expenses">
      <div class="filters">
        ${sel('month', 'All months', months, m => monthLabel(m, true))}
        ${sel('category', 'All categories', uniq(S.db.expenses.map(e => e.category)).sort())}
        ${sel('vendor', 'All vendors', vendors)}
        <select data-filter="sort" aria-label="Sort">
          ${[['date-desc', 'Newest first'], ['date-asc', 'Oldest first'], ['amount-desc', 'Highest amount'], ['amount-asc', 'Lowest amount']]
            .map(([v, l]) => `<option value="${v}"${f.sort === v ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="expList">${expList()}</div>`;
}

function expenseForm(e = {}) {
  const vendors = uniq([...S.db.vendors.map(v => v.name), ...S.db.expenses.map(x => x.vendor)]).sort();
  return `<div class="form-grid">
    <label class="field"><span>Date</span><input type="date" name="date" required value="${esc(e.date || todayISO())}"></label>
    <label class="field"><span>Amount (₹)</span><input type="number" name="amount" required min="1" step="1" inputmode="numeric" value="${esc(e.amount ?? '')}"></label>
    <label class="field span2"><span>Category</span><input name="category" required maxlength="60" list="catList" value="${esc(e.category || '')}" placeholder="Pick from the list or type a new one"></label>
    ${datalist('catList', categoryList())}
    <label class="field span2"><span>Description</span><input name="description" required maxlength="140" value="${esc(e.description || '')}"></label>
    <label class="field"><span>Vendor / paid to</span><input name="vendor" list="vendorList" maxlength="80" value="${esc(e.vendor || '')}"></label>
    ${datalist('vendorList', vendors)}
    <label class="field"><span>Payment mode</span><input name="mode" list="modeList" maxlength="30" value="${esc(e.mode || modeList()[0] || '')}"></label>
    ${datalist('modeList', modeList())}
    <label class="field span2"><span>Paid by</span><input name="paidBy" maxlength="60" value="${esc(e.paidBy || S.settings.treasurer || '')}"></label>
    <div class="field span2"><label for="receiptIn"><span>Receipt or bill (photo or PDF)</span></label>
      <input id="receiptIn" type="file" name="receipt" accept="image/*,application/pdf">
      ${e.receipt ? `<small class="muted">Current: ${esc(e.receipt.name)} · <label class="inline"><input type="checkbox" name="removeReceipt"> remove</label></small>` : ''}
    </div>
  </div>`;
}

async function submitExpense(fd, existing) {
  const doc = {
    ...(existing || {}),
    date: fd.get('date'),
    amount: Math.round(Number(fd.get('amount'))),
    category: fd.get('category').trim(),
    description: fd.get('description').trim(),
    vendor: fd.get('vendor').trim(),
    mode: fd.get('mode').trim(),
    paidBy: fd.get('paidBy').trim(),
  };
  if (!(doc.amount > 0)) throw new Error('Enter an amount greater than zero.');
  if (fd.get('removeReceipt')) delete doc.receipt;
  const file = fd.get('receipt');
  if (file && file.size) doc.receipt = await store.upload(file);
  await save('expenses', doc, `${doc.description} — ${money(doc.amount)}`);
  await refresh(existing ? 'Expense updated' : 'Expense added');
}

function showExpense(id) {
  const e = S.db.expenses.find(x => x.id === id);
  if (!e) return;
  const r = e.receipt;
  const isImg = r && /\.(png|jpe?g|webp|gif|heic)$/i.test(r.name);
  const item = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
  openModal(e.description, `
    <p class="big-amount">${money(e.amount)}</p>
    <dl class="details">
      ${item('Date', dateLabel(e.date))}${item('Category', esc(e.category))}${item('Paid to', esc(e.vendor))}
      ${item('Payment mode', esc(e.mode))}${item('Paid by', esc(e.paidBy))}
      ${item('Recorded', esc([e.createdBy, e.createdAt && dateTimeLabel(e.createdAt)].filter(Boolean).join(' · ')))}
    </dl>
    ${r ? `<div class="receipt">${isImg ? `<img src="${esc(r.url)}" alt="Receipt for ${esc(e.description)}">` : ''}
      <a class="btn ghost" href="${esc(r.url)}" target="_blank" rel="noopener">${icon('clip')}<span>Open ${esc(r.name)}</span></a></div>`
      : e.payslip ? '' : '<p class="muted">No receipt attached.</p>'}
    ${e.payslip && isAdmin() ? '<p class="hint">This is a salary payment. To change it, delete it and pay again from Staff.</p>' : ''}`,
    {
      footer: !isAdmin() ? '' : `<button type="button" class="btn danger-ghost" data-action="delete-expense" data-id="${esc(e.id)}">Delete</button>
        <span class="spacer"></span>${e.payslip
          ? `<button type="button" class="btn primary" data-action="view-slip" data-id="${esc(e.id)}">Pay slip</button>`
          : `<button type="button" class="btn primary" data-action="edit-expense" data-id="${esc(e.id)}">Edit</button>`}`,
    });
}

function exportCsv() {
  const list = filteredExpenses();
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Date', 'Category', 'Description', 'Vendor', 'Amount (INR)', 'Payment mode', 'Paid by', 'Receipt'],
    ...list.map(e => [e.date, e.category, e.description, e.vendor, e.amount, e.mode, e.paidBy, e.receipt?.url || ''])];
  download(`${fileSlug()}-expenses-${todayISO()}.csv`, '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}

// ---------- dues ----------
function viewDues() { return isAdmin() ? duesAdmin() : duesResident(); }

function fyNav(fy, prevAction, nextAction) {
  const minFy = fyStart(S.settings.startMonth, S.settings.fyStartMonth), maxFy = fyStart(curMonth(), S.settings.fyStartMonth);
  return `<div class="fy-nav">
    <button class="icon-btn" data-action="${prevAction}" ${fy <= minFy ? 'disabled' : ''} aria-label="Previous year">${icon('left')}</button>
    <strong>${fyLabel(fy)}</strong>
    <button class="icon-btn" data-action="${nextAction}" ${fy >= maxFy ? 'disabled' : ''} aria-label="Next year">${icon('right')}</button></div>`;
}

const billingSummary = () => {
  const r = billingFor();
  return `${r.billing === 'sqft' ? `₹${r.ratePerSqft}/sq. ft.` : money(r.fixedAmount) + ' per flat'} each month · due by the ${ordinal(S.settings.dueDay)}`;
};

function duesAdmin() {
  const tab = S.ui.duesTab;
  const tabs = [['grid', 'Who has paid'], ['pending', 'Pending dues'], ['flats', 'Flats & amount'], ['tax', 'House tax']];
  return `
    <div class="page-head"><div><h1>Maintenance dues</h1><p class="muted">${billingSummary()}</p></div></div>
    <div class="seg" role="tablist">${tabs.map(([id, l]) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? 'active' : ''}" data-action="dues-tab" data-tab="${id}">${l}</button>`).join('')}</div>
    ${tab === 'grid' ? duesGrid() : tab === 'pending' ? duesPending() : tab === 'tax' ? duesTax() : duesFlats()}`;
}

function duesGrid() {
  const s = S.settings, cm = curMonth();
  const fy = S.ui.fy || fyStart(cm, s.fyStartMonth);
  const months = monthsBetween([fy, s.startMonth].sort().pop(), [addMonths(fy, 11), cm].sort()[0]);
  const flats = S.db.flats;
  if (!flats.length) return `<div class="card">${empty('Add flats in “Flats & amount” first.')}</div>`;
  const cell = (f, mk) => {
    const st = status(f, mk);
    const txt = st.key === 'paid' ? '✓' : st.paid > 0 ? '½' : st.key === 'overdue' ? '!' : '·';
    return `<td><button class="cell st-${st.key}" data-action="pay" data-flat="${esc(f.id)}" data-month="${mk}"
      title="Flat ${esc(f.id)} · ${monthLabel(mk, true)}: ${st.label} (${money(st.paid)} of ${money(st.due)})">${txt}</button></td>`;
  };
  return `
    <div class="card">
      <div class="card-head">${fyNav(fy, 'fy-prev', 'fy-next')}
        <div class="legend"><span><i class="swatch st-paid"></i>Paid</span><span><i class="swatch st-pending"></i>Due</span><span><i class="swatch st-overdue"></i>Overdue</span></div></div>
      ${months.length ? `<div class="table-scroll"><table class="dues-grid">
        <thead><tr><th scope="col">Flat</th>${months.map(m => `<th scope="col">${monthLabel(m)}</th>`).join('')}<th scope="col" class="num">Pending</th></tr></thead>
        <tbody>${flats.map(f => { const o = outstanding(f).total; return `<tr><th scope="row"><strong>${esc(f.id)}</strong>${f.owner ? `<small>${esc(f.owner)}</small>` : ''}</th>
          ${months.map(m => cell(f, m)).join('')}<td class="num">${o ? money(o) : '—'}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><th scope="row">Paid</th>${months.map(m => `<td>${flats.filter(f => status(f, m).key === 'paid').length}/${flats.length}</td>`).join('')}<td></td></tr></tfoot>
      </table></div>` : empty('No months to show for this year.')}
      <p class="hint">Tap a box to record or view a payment.</p>
    </div>`;
}

function duesPending() {
  const rows = S.db.flats.map(f => ({ f, o: outstanding(f) })).filter(r => r.o.total > 0);
  if (!rows.length) return `<div class="card banner ok">${icon('wallet')}<div><strong>No pending dues</strong><span>Every flat has paid up to ${monthLabel(curMonth(), true)}.</span></div></div>`;
  return `
    <div class="card">
      <div class="card-head"><h2>${rows.length} flat${rows.length === 1 ? '' : 's'} · ${money(sum(rows, r => r.o.total))} pending</h2>
        <button class="btn sm ghost" data-action="copy-all-reminders">${icon('copy')}<span>Copy all reminders</span></button></div>
      <div class="list">${rows.map(({ f, o }) => `
        <div class="pending-row">
          <div class="row-main"><strong>${esc(flatName(f))}</strong>
            <small>${o.months.map(x => `<span class="badge ${x.key === 'overdue' ? 'bad' : 'warn'}">${monthLabel(x.mk)}${x.paid ? ' (part)' : ''}</span>`).join(' ')}</small></div>
          <strong class="row-amt">${money(o.total)}</strong>
          <div class="row-btns">
            <button class="btn sm ghost" data-action="copy-reminder" data-flat="${esc(f.id)}">${icon('copy')}<span>Copy</span></button>
            <a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/${waNumber(S.db.flatProfiles[f.id]?.phone)}?text=${encodeURIComponent(reminderText(f, o))}">${icon('chat')}<span>WhatsApp</span></a>
          </div>
        </div>`).join('')}</div>
    </div>`;
}

function duesFlats() {
  const s = S.settings, r = billingFor();
  const noArea = r.billing === 'sqft' ? S.db.flats.filter(f => !(Number(f.sqft) > 0) && !(Number(f.override) > 0)) : [];
  const history = [...(s.billingHistory || [])].sort((a, b) => b.from.localeCompare(a.from));
  return `
    <form class="card stack" data-form="billing">
      <h2>Monthly maintenance amount</h2>
      <div class="radio-row">
        <label><input type="radio" name="billing" value="fixed"${r.billing !== 'sqft' ? ' checked' : ''}> Same for every flat</label>
        <label><input type="radio" name="billing" value="sqft"${r.billing === 'sqft' ? ' checked' : ''}> By flat area (₹ per sq. ft.)</label>
      </div>
      <div class="form-grid three">
        <label class="field"><span>Amount per flat (₹)</span><input type="number" name="fixedAmount" min="0" step="1" value="${esc(r.fixedAmount)}"></label>
        <label class="field"><span>Rate per sq. ft. (₹)</span><input type="number" name="ratePerSqft" min="0" step="0.01" value="${esc(r.ratePerSqft)}"></label>
        <label class="field"><span>Applies from (month)</span><input type="month" name="from" required value="${curMonth()}"></label>
        <label class="field"><span>Due by day of month</span><input type="number" name="dueDay" min="1" max="28" value="${esc(s.dueDay)}"></label>
      </div>
      <p class="hint">Months before “Applies from” keep the amount they had, so past dues don't change.</p>
      ${history.length ? `<p class="hint">History: ${history.map(e => `${e.billing === 'sqft' ? `₹${e.ratePerSqft}/sq. ft.` : money(e.fixedAmount)} from ${monthLabel(e.from, true)}`).join(' · ')}</p>` : ''}
      <div><button class="btn primary">Save amount</button></div>
    </form>
    ${noArea.length ? `<div class="banner warn">${icon('wallet')}<div><strong>${noArea.length} flat${noArea.length === 1 ? ' has' : 's have'} no area set</strong>
      <span>With billing by area, ${noArea.map(f => esc(f.id)).join(', ')} would owe ₹0. Add the area under Billing for each flat.</span></div></div>` : ''}
    <div class="card">
      <div class="card-head"><h2>Flats (${S.db.flats.length})</h2>
        <div class="row-btns">
          <button type="button" class="btn sm ghost${S.ui.incompleteOnly ? ' active' : ''}" aria-pressed="${!!S.ui.incompleteOnly}" data-action="toggle-incomplete">Show incomplete only</button>
          <button class="btn sm ghost" data-action="add-flat">${icon('plus')}<span>Add flat</span></button></div></div>
      ${flatsTable()}
    </div>`;
}

// Who signs in for a flat (admins only: member accounts are private to admins by the rules).
function flatLogins(flatId) {
  const users = S.db.users || [];
  return {
    active: users.filter(u => u.flatId === flatId && ['resident', 'admin'].includes(u.role)),
    waiting: users.filter(u => u.role === 'pending' && u.requestedFlat === flatId),
  };
}
function loginsHtml(flatId) {
  const { active, waiting } = flatLogins(flatId);
  if (!active.length && !waiting.length) return '<span class="muted">No one has signed in yet</span>';
  const li = (u, badge) => `<li><strong>${esc(u.name || u.email || '')}</strong>${badge}${u.email ? `<small>${esc(u.email)}</small>` : ''}</li>`;
  return `<ul class="logins">${active.map(u => li(u, u.role === 'admin' ? ' <span class="badge ok">admin</span>' : '')).join('')}${
    waiting.map(u => li(u, ' <span class="badge warn">waiting for approval</span>')).join('')}</ul>`;
}

function flatsTable() {
  if (!S.db.flats.length) return empty('No flats yet. Add each flat number.');
  const rows = S.db.flats.map(f => ({ f, p: S.db.flatProfiles[f.id], c: completenessOf(f) }))
    .filter(r => !S.ui.incompleteOnly || r.c.missing.length);
  if (!rows.length) return empty('Every flat has complete details.');
  // On phones each row becomes a contact card (see table.stack in styles.css).
  return `<div class="table-scroll"><table class="data stack flats-table">
    <thead><tr><th>Flat</th><th>Owner / resident</th><th>Contact</th><th>Logins</th><th>Profile</th><th class="num">Area (sq. ft.)</th><th class="num">Monthly</th><th></th></tr></thead>
    <tbody>${rows.map(({ f, p, c }) => `<tr data-flat-row="${esc(f.id)}">
      <td class="stack-title"><strong>${esc(f.id)}</strong></td>
      <td class="stack-full" data-label="Owner / resident">${esc(f.owner) || '<span class="muted">Not set</span>'}${p?.occupancy === 'Tenant' && p.residentName ? `<br><small class="muted">Tenant: ${esc(p.residentName)}</small>` : p?.occupancy === 'Vacant' ? '<br><small class="muted">Vacant</small>' : ''}</td>
      <td data-label="Mobile">${p?.phone ? `<a href="tel:${esc(p.phone.replace(/\s/g, ''))}">${esc(p.phone)}</a>` : '<span class="muted">—</span>'}</td>
      <td class="stack-full" data-label="Logins">${loginsHtml(f.id)}</td>
      <td class="stack-full" data-label="Profile" title="${c.missing.length ? 'Missing: ' + esc(c.missing.map(m => m.label).join(', ')) : 'Complete'}">${completenessBar(c, true)}</td>
      <td class="num" data-label="Area (sq. ft.)">${f.sqft || '—'}</td><td class="num" data-label="Monthly">${money(dueAmount(f))}${Number(f.override) > 0 ? ' <small class="muted">custom</small>' : ''}</td>
      <td class="num stack-full"><div class="row-btns end"><button class="btn sm ghost" data-action="edit-profile" data-id="${esc(f.id)}">Details</button>
        <button class="btn sm ghost" data-action="edit-flat" data-id="${esc(f.id)}">Billing</button>
        ${c.missing.length ? `<button class="btn sm ghost" data-action="remind-profile" data-id="${esc(f.id)}">${icon('copy')}<span>Remind</span></button>` : ''}</div></td></tr>`).join('')}</tbody>
  </table></div>`;
}

function duesResident() {
  const f = flatById(S.user.flatId);
  if (!f) return `<div class="page-head"><div><h1>My flat</h1></div></div><div class="card">${empty('Your account is not linked to a flat yet. Ask the treasurer to link it.')}</div>`;
  const o = outstanding(f);
  const months = billingMonths().slice().reverse();
  return `
    <div class="page-head"><div><h1>Flat ${esc(f.id)}</h1><p class="muted">${f.owner ? esc(f.owner) + ' · ' : ''}${money(dueAmount(f))} per month, due by the ${ordinal(S.settings.dueDay)}</p></div></div>
    ${taxReminders(f.id).length ? houseTaxCard(f) + flatDetailsCard(f) : flatDetailsCard(f) + houseTaxCard(f)}
    <h2 class="section-title">Maintenance dues</h2>
    ${o.total > 0
      ? `<div class="banner warn">${icon('wallet')}<div><strong>${money(o.total)} pending</strong><span>${o.months.map(x => monthLabel(x.mk, true)).join(', ')}</span></div></div>`
      : `<div class="banner ok">${icon('wallet')}<div><strong>All paid up</strong><span>Thank you!</span></div></div>`}
    ${S.settings.payNote ? `<div class="card"><h2>How to pay</h2><p>${esc(S.settings.payNote)}</p></div>` : ''}
    <div class="card list">${months.map(mk => {
      const st = status(f, mk), pays = paymentsFor(f.id, mk);
      return `<div class="pending-row"><div class="row-main"><strong>${monthLabel(mk, true)}</strong>
        <small>${pays.length ? pays.map(p => `${money(p.amount)} on ${dateLabel(p.paidOn)}${p.mode ? ` (${esc(p.mode)})` : ''}`).join(' · ') : 'No payment recorded'}</small></div>
        <span class="badge ${st.key === 'paid' ? 'ok' : st.key === 'overdue' ? 'bad' : 'warn'}">${st.label}</span></div>`;
    }).join('')}</div>`;
}

function payModal(flatId, mk) {
  const f = flatById(flatId), st = status(f, mk), pays = paymentsFor(flatId, mk);
  const remaining = Math.max(st.due - st.paid, 0);
  openModal(`Flat ${f.id} · ${monthLabel(mk, true)}`, `
    <p class="pay-status"><span class="badge ${st.key === 'paid' ? 'ok' : st.key === 'overdue' ? 'bad' : 'warn'}">${st.label}</span>
      Due ${money(st.due)} · Paid ${money(st.paid)}</p>
    ${pays.length ? `<ul class="pay-list">${pays.map(p => `<li><span>${money(p.amount)} · ${dateLabel(p.paidOn)}${p.mode ? ' · ' + esc(p.mode) : ''}${p.ref ? ' · ' + esc(p.ref) : ''}</span>
      <button type="button" class="btn sm danger-ghost" data-action="delete-payment" data-id="${esc(p.id)}">Remove</button></li>`).join('')}</ul>` : ''}
    <h3>${pays.length ? 'Add another payment' : 'Record payment'}</h3>
    <div class="form-grid">
      <label class="field"><span>Amount (₹)</span><input type="number" name="amount" min="1" step="1" required value="${remaining || st.due || ''}"></label>
      <label class="field"><span>Received on</span><input type="date" name="paidOn" required value="${todayISO()}"></label>
      <label class="field"><span>Mode</span><input name="mode" list="payModeList" maxlength="30" value="${esc(modeList()[0] || '')}"></label>
      ${datalist('payModeList', modeList())}
      <label class="field"><span>UPI ref / note</span><input name="ref" maxlength="60"></label>
    </div>`, {
    submitLabel: 'Save payment',
    onSubmit: async fd => {
      const amount = Math.round(Number(fd.get('amount')));
      if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
      await save('payments', { flatId, month: mk, amount, paidOn: fd.get('paidOn'), mode: fd.get('mode').trim(), ref: fd.get('ref').trim() },
        `${money(amount)} from Flat ${flatId} for ${monthLabel(mk, true)}`);
      await refresh('Payment recorded');
    },
  });
}

function flatModal(f) {
  const isNew = !f;
  f ||= { id: '', owner: '', sqft: '', override: '' };
  openModal(isNew ? 'Add flat' : `Flat ${f.id} · billing`, `
    <div class="form-grid">
      <label class="field"><span>Flat number</span><input name="id" required maxlength="12" value="${esc(f.id)}" ${isNew ? '' : 'disabled'}></label>
      <label class="field"><span>Area (sq. ft.)</span><input type="number" name="sqft" min="0" value="${esc(f.sqft || '')}"></label>
      <label class="field span2"><span>Owner / resident name</span><input name="owner" maxlength="60" value="${esc(f.owner)}"></label>
      <label class="field span2"><span>Custom monthly amount (₹, optional)</span><input type="number" name="override" min="0" value="${esc(f.override || '')}" placeholder="Leave empty to use the standard amount"></label>
    </div>`, {
    footer: isNew ? '' : `<button type="button" class="btn danger-ghost" data-action="delete-flat" data-id="${esc(f.id)}">Delete flat</button><span class="spacer"></span>`,
    onSubmit: async fd => {
      const id = isNew ? fd.get('id').trim() : f.id;
      if (isNew && !id) throw new Error('Enter a flat number.');
      if (isNew && flatById(id)) throw new Error(`Flat ${id} already exists.`);
      const doc = { ...f, id, owner: fd.get('owner').trim(), sqft: Number(fd.get('sqft')) || 0, override: Number(fd.get('override')) || 0 };
      // Flat docs are keyed by flat number, so they're written directly and audited here.
      const now = new Date().toISOString();
      await store.put('flats', { ...doc, ...(isNew ? { createdAt: now, createdBy: S.user.name } : {}), updatedAt: now, updatedBy: S.user.name });
      await audit(isNew ? 'create' : 'update', 'flats', id, `Flat ${id}${doc.owner ? ' – ' + doc.owner : ''}`);
      await refresh(isNew ? 'Flat added' : 'Flat updated');
    },
  });
}

// ---------- flat details (each flat keeps its own; private to that flat and admins) ----------
const PROFILE_FIELDS = ['occupancy', 'residentName', 'phone', 'altPhone', 'email', 'members', 'vehicles', 'emergencyName', 'emergencyPhone'];

// ----- profile completeness (computed from the data, never stored) -----
const completenessOf = f => profileCompleteness(f, S.db.flatProfiles[f.id]);
const siteLink = () => location.origin + location.pathname.replace(/index\.html$/, '');

function completenessBar(c, small = false) {
  return `<div class="pc${small ? ' pc-sm' : ''}" role="img" aria-label="Flat details ${c.percent}% complete">
    <div class="pc-track"><i class="${c.percent === 100 ? 'full' : ''}" style="width:${c.percent}%"></i></div><span class="pc-num">${c.percent}%</span></div>`;
}

function completenessBlock(f) {
  const c = completenessOf(f);
  if (!c.missing.length) return `<div class="pc-block done">${completenessBar(c)}<p class="hint">✓ All flat details are complete. Thank you!</p></div>`;
  return `<div class="pc-block">${completenessBar(c)}
    <p class="pc-title">Still needed:</p>
    <ul class="pc-missing">${c.missing.map(m => `<li>${esc(m.label)}</li>`).join('')}</ul>
    <button type="button" class="btn sm primary" data-action="complete-profile" data-id="${esc(f.id)}" data-field="${esc(c.missing[0].field)}">Complete now</button></div>`;
}

// Resident Home: shown until their own flat's details are 100% complete.
function myProfileNudge() {
  const f = flatById(S.user.flatId);
  if (!f) return '';
  const c = completenessOf(f);
  if (!c.missing.length) return '';
  return `<div class="banner info pc-nudge">${icon('home')}<div>
    <strong>Your flat details are ${c.percent}% complete</strong>
    <span>Still needed: ${c.missing.map(m => esc(m.label)).join(', ')}.</span>
    ${completenessBar(c, true)}
    <div class="row-btns"><button type="button" class="btn sm primary" data-action="complete-profile" data-id="${esc(f.id)}" data-field="${esc(c.missing[0].field)}">Complete now</button></div></div></div>`;
}

// Admin Home: how many flats have complete details, and which ones don't.
function profileSummaryCard() {
  if (!S.db.flats.length) return '';
  const rows = S.db.flats.map(f => ({ f, c: completenessOf(f) }));
  const incomplete = rows.filter(r => r.c.missing.length).sort((a, b) => a.c.percent - b.c.percent);
  const doneCount = rows.length - incomplete.length;
  return `<section class="card pc-summary">
    <div class="card-head"><h2>Flat details: ${doneCount} of ${rows.length} complete</h2>
      ${incomplete.length ? `<button type="button" class="btn sm ghost" data-action="copy-profile-reminders">${icon('copy')}<span>Copy reminders</span></button>` : ''}</div>
    ${completenessBar({ percent: Math.round(sum(rows, r => r.c.percent) / rows.length) })}
    ${incomplete.length ? `<ul class="pc-list">${incomplete.map(({ f, c }) => `<li><strong>Flat ${esc(f.id)}</strong>${f.owner ? ` · ${esc(f.owner)}` : ''}
      <span class="muted" title="${esc(c.missing.map(m => m.label).join(', '))}">${c.missing.length} detail${c.missing.length === 1 ? '' : 's'} missing</span>${completenessBar(c, true)}</li>`).join('')}</ul>
      <button type="button" class="link-btn" data-action="open-flats">See all flats</button>`
      : '<p class="hint">✓ Every flat has complete details.</p>'}
  </section>`;
}

function profileReminder(f) {
  const c = completenessOf(f);
  const who = f.owner ? `${f.owner} garu (Flat ${f.id})` : `Flat ${f.id}`;
  return `Namaste ${who}, please complete your flat details in the SVLN app: ${c.missing.map(m => m.label).join(', ')}. ${siteLink()}`;
}

function flatDetailsCard(f) {
  const p = S.db.flatProfiles[f.id];
  const item = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
  const tel = n => n ? `<a href="tel:${esc(n.replace(/\s/g, ''))}">${esc(n)}</a>` : '';
  return `<div class="card">
    <div class="card-head"><h2>Flat details</h2>
      <button class="btn sm ${p ? 'ghost' : 'primary'}" data-action="edit-profile" data-id="${esc(f.id)}">${p ? 'Edit details' : 'Add details'}</button></div>
    ${completenessBlock(f)}
    ${isAdmin() ? `<div class="logins-box"><span class="pc-title">Logins for this flat</span>${loginsHtml(f.id)}</div>`
      : `<p class="login-note">You're signed in as <strong>${esc(S.user.name || '')}</strong>${S.user.email ? ` (${esc(S.user.email)})` : ''}. Family members can sign in with their own accounts; the treasurer links them to this flat.</p>`}
    ${p ? `<dl class="details">
        ${item('Owner', esc(f.owner))}${item('Living here', esc(p.occupancy))}${item('Tenant', esc(p.residentName))}
        ${item('Mobile', tel(p.phone))}${item('Other phone', tel(p.altPhone))}${item('Email', esc(p.email))}
        ${item('Family members', p.members ? esc(p.members) : '')}${item('Vehicles', esc(p.vehicles))}
        ${item('Emergency contact', esc([p.emergencyName, p.emergencyPhone].filter(Boolean).join(' · ')))}
      </dl>
      ${p.family?.length ? `<div class="family-list"><h3 class="duties-title">Family members</h3><ul>${p.family.map(m => `<li>
        <strong>${esc(m.name || '—')}</strong>${m.relation ? ` · ${esc(m.relation)}` : ''}${m.age ? ` · ${esc(m.age)} yrs` : ''}${m.phone ? ` · ${tel(m.phone)}` : ''}</li>`).join('')}</ul></div>` : ''}
      <p class="hint">Updated ${p.updatedAt ? dateTimeLabel(p.updatedAt) : ''}${p.updatedBy ? ' by ' + esc(p.updatedBy) : ''}. Phone numbers are visible only to this flat and the treasurer.</p>`
      : '<p class="muted">No details yet. Add the owner name and a phone number so the treasurer can reach this flat.</p>'}
  </div>`;
}

// ----- house tax (each flat pays its own; assessment number, bill and paid status are private) -----
// Due dates come from Settings (two half-years); reminders count from the month tracking started.
const TAX_DOC_MAX = 650 * 1024;   // PDFs; photos are shrunk to fit a Firestore document
const taxDueDays = () => Number(S.settings.houseTaxRemindDays) || 30;
// GVMC's online payment page (BillDesk) until the treasurer changes or clears it in Settings.
// It can't be pre-filled from a link, so Pay online copies the assessment number to paste there.
const DEFAULT_TAX_PAY_URL = 'https://pgi.billdesk.com/pgidsk/pgmerc/gvmc/GVMCDetails.jsp';
const taxPayUrl = () => typeof S.settings.houseTaxPayUrl === 'string' ? S.settings.houseTaxPayUrl : DEFAULT_TAX_PAY_URL;
// The assessment number itself is a link: tapping it copies the number and opens the payment page.
const taxNoLink = (no, tag = 'span') => !no ? '' : taxPayUrl()
  ? `<a class="mono tax-no" href="${esc(taxPayUrl())}" target="_blank" rel="noopener" data-copy="${esc(no)}" title="Copy and open the payment page">${esc(no)}</a>`
  : `<${tag} class="mono">${esc(no)}</${tag}>`;

function taxDues() {
  const list = (S.settings.houseTaxDue || []).filter(d => d.month && d.day), out = [];
  const from = S.settings.startMonth + '-01', until = addDays(todayISO(), 366), y = +todayISO().slice(0, 4);
  for (const d of list) for (const yr of [y - 1, y, y + 1]) {
    const day = Math.min(+d.day, lastDay(`${yr}-${pad(d.month)}`)), date = `${yr}-${pad(d.month)}-${pad(day)}`;
    if (date >= from && date <= until) out.push({ date, label: d.label || 'House tax' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
const taxPaidFor = (flatId, date) => S.db.flatProfiles[flatId]?.taxPaid?.[date];
// Unpaid dues that are overdue or coming up within the reminder window.
const taxReminders = flatId => taxDues().filter(d => daysUntil(d.date) <= taxDueDays() && !taxPaidFor(flatId, d.date));

function taxStatus(flatId, d) {
  const paid = taxPaidFor(flatId, d.date), n = daysUntil(d.date);
  if (paid) return { key: 'paid', cls: 'ok', text: `Paid ${paid.amount ? money(paid.amount) + ' ' : ''}on ${dateLabel(paid.paidOn)}` };
  if (n < 0) return { key: 'overdue', cls: 'bad', text: `Overdue by ${-n} day${n === -1 ? '' : 's'}` };
  if (n <= taxDueDays()) return { key: 'due', cls: 'warn', text: n === 0 ? 'Due today' : `Due in ${n} day${n === 1 ? '' : 's'}` };
  return { key: 'later', cls: 'later', text: 'Upcoming' };
}
const taxDueText = d => `${d.label} · due ${dateLabel(d.date)}`;
// The due that matters now for a flat: the oldest unpaid within the window, else the next one.
const taxFocus = flatId => taxReminders(flatId)[0] || taxDues().find(d => d.date >= todayISO()) || taxDues().slice(-1)[0];

// Instalment amount a flat noted from its GVMC bill (0 when not known yet).
const taxAmount = flatId => Number(S.db.flatProfiles[flatId]?.taxAmount) || 0;
const taxAmountText = flatId => taxAmount(flatId) ? money(taxAmount(flatId)) : '';

// Courtesy reminder: the same wording on WhatsApp and on the flat's own page.
const taxReminderLine = d => `This is a courtesy reminder: house tax for ${d.label} ${daysUntil(d.date) < 0 ? 'was' : 'is'} due on ${dateLabel(d.date)}.`;
const taxFacts = f => {
  const p = S.db.flatProfiles[f.id] || {};
  return [
    ...(p.taxAssessmentNo ? [`Assessment No: ${p.taxAssessmentNo}`] : []),
    ...(p.taxOwnerName ? [`Taxpayer: ${p.taxOwnerName}`] : []),
    ...(taxAmount(f.id) ? [`Due amount: ${money(taxAmount(f.id))}`] : []),
  ];
};

// Shown at the top of the House tax card on My flat while an instalment is due or overdue.
function taxNotice(f, d) {
  const p = S.db.flatProfiles[f.id] || {}, overdue = daysUntil(d.date) < 0;
  return `<div class="tax-notice ${overdue ? 'bad' : 'warn'}" role="note" data-tax-notice="${d.date}">
    <strong>Courtesy reminder</strong>
    <p>${esc(taxReminderLine(d))}</p>
    ${taxFacts(f).length ? `<p class="tax-facts">${taxFacts(f).map(x => `<span>${esc(x)}</span>`).join('')}</p>` : ''}
    <p class="muted">Please pay online, then tap Mark paid. Please ignore if already paid. Thank you!</p>
    <div class="row-btns">
      ${taxPayUrl() ? `<a class="btn sm primary" href="${esc(taxPayUrl())}" target="_blank" rel="noopener"${p.taxAssessmentNo ? ` data-copy="${esc(p.taxAssessmentNo)}"` : ''}>${icon('wallet')}<span>Pay now</span></a>` : ''}
      <button type="button" class="btn sm ghost" data-action="tax-paid" data-id="${esc(f.id)}" data-date="${d.date}">Mark paid</button>
    </div></div>`;
}

// Courtesy reminder for WhatsApp: what is due, the GVMC pay link, and a link to the flat's own page.
function taxReminderText(f, d) {
  const who = f.owner ? `${f.owner} garu (Flat ${f.id})` : `Flat ${f.id}`;
  const p = S.db.flatProfiles[f.id] || {};
  return [
    `Namaste ${who} 🙏`,
    taxReminderLine(d),
    '',
    ...taxFacts(f),
    '',
    ...(taxPayUrl() ? [`Pay online (GVMC): ${taxPayUrl()}`, p.taxAssessmentNo ? 'Enter the assessment number above on that page.' : 'Keep your assessment number ready.'] : []),
    `Your flat details, Pay and Mark paid in the SVLN app: ${siteLink()}#/dues`,
    '',
    `Please ignore if already paid. Thank you! — ${societyName() || 'Treasurer'}`,
  ].join('\n').replace(/\n{3,}/g, '\n\n');
}

function houseTaxCard(f) {
  const p = S.db.flatProfiles[f.id] || {}, dues = taxDues();
  const owing = taxReminders(f.id), dueNow = owing.length * taxAmount(f.id);
  return `<div class="card house-tax">
    <div class="card-head"><h2>House tax</h2>
      <button class="btn sm ${p.taxAssessmentNo ? 'ghost' : 'primary'}" data-action="edit-tax" data-id="${esc(f.id)}">${p.taxAssessmentNo || p.taxDoc ? 'Edit' : 'Add assessment number'}</button></div>
    ${owing.map(d => taxNotice(f, d)).join('')}
    <dl class="details">
      <div><dt>Assessment number</dt><dd>${p.taxAssessmentNo ? taxNoLink(p.taxAssessmentNo, 'strong') : '<span class="muted">Not added yet</span>'}</dd></div>
      <div><dt>Taxpayer name</dt><dd>${p.taxOwnerName ? esc(p.taxOwnerName) : '<span class="muted">Not added yet</span>'}</dd></div>
      <div class="tax-due-now"><dt>Due amount</dt><dd>${owing.length
        ? (dueNow ? `<strong class="due-amt">${money(dueNow)}</strong>` : `<span class="muted">${owing.length} instalment${owing.length === 1 ? '' : 's'} due — add the amount</span>`)
        : taxAmount(f.id) ? '<span class="badge ok">Nothing due</span>' : '<span class="muted">Not added yet</span>'}</dd></div>
      <div><dt>Tax document</dt><dd>${p.taxDoc ? `<button type="button" class="link-btn" data-action="view-tax-doc" data-id="${esc(f.id)}">${icon('clip')}<span>${esc(p.taxDoc.name)}</span></button>` : '<span class="muted">Not uploaded</span>'}</dd></div>
    </dl>
    ${dues.length ? `<div class="list tax-dues">${dues.map(d => {
      const st = taxStatus(f.id, d);
      return `<div class="pending-row" data-tax-due="${d.date}"><div class="row-main"><strong>${esc(d.label)}</strong><small>Due ${dateLabel(d.date)}${taxAmount(f.id) && st.key !== 'paid' ? ` · ${money(taxAmount(f.id))}` : ''}</small></div>
        <span class="badge ${st.cls}">${st.text}</span>
        <button type="button" class="btn sm ${['due', 'overdue'].includes(st.key) ? 'primary' : 'ghost'}" data-action="tax-paid" data-id="${esc(f.id)}" data-date="${d.date}">${st.key === 'paid' ? 'Edit' : 'Mark paid'}</button></div>`;
    }).join('')}</div>`
      : `<p class="hint">${isAdmin() ? 'Set the house tax due dates in Settings to turn on reminders.' : 'The treasurer has not set the house tax due dates yet.'}</p>`}
    ${taxPayUrl() ? `<div class="tax-pay">
      <a class="btn primary" href="${esc(taxPayUrl())}" target="_blank" rel="noopener"${p.taxAssessmentNo ? ` data-copy="${esc(p.taxAssessmentNo)}"` : ''}>${icon('wallet')}<span>Pay online</span></a>
      <small class="muted">${p.taxAssessmentNo ? 'Copies your assessment number — paste it on the payment page. After paying, come back and tap Mark paid.' : 'Add your assessment number first; you will need it on the payment page.'}</small></div>` : ''}
    <p class="hint">Visible only to this flat and the treasurer.</p>
  </div>`;
}

// Photos are resized and saved as JPEG so a bill fits in the database (no paid storage needed).
async function readTaxDoc(file) {
  const asDataUrl = blob => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(r.error); r.readAsDataURL(blob); });
  if (file.type === 'application/pdf') {
    if (file.size > TAX_DOC_MAX) throw new Error('This PDF is too large (max 650 KB). Upload a photo of the bill instead.');
    return { name: file.name, type: file.type, data: await asDataUrl(file) };
  }
  if (!file.type.startsWith('image/')) throw new Error('Upload a photo or a PDF of the tax bill.');
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('Could not read this photo.')); i.src = URL.createObjectURL(file); });
  for (const [max, q] of [[1600, 0.75], [1200, 0.6], [900, 0.5]]) {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', q);
    if (data.length * 0.75 <= TAX_DOC_MAX) return { name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', data };
  }
  throw new Error('This photo is too large. Try a smaller photo.');
}

function houseTaxModal(flatId) {
  const p = S.db.flatProfiles[flatId] || {};
  openModal(`House tax · Flat ${flatId}`, `<div class="form-grid">
    <label class="field span2"><span>Assessment number</span><input name="taxAssessmentNo" maxlength="40" autocomplete="off" value="${esc(p.taxAssessmentNo || '')}" placeholder="As printed on the tax bill"></label>
    <label class="field span2"><span>Taxpayer name (as on the GVMC bill)</span><input name="taxOwnerName" maxlength="100" autocomplete="off" value="${esc(p.taxOwnerName || '')}" placeholder="Owner name printed on the tax bill"></label>
    <label class="field"><span>Due amount (₹)</span><input type="number" name="taxAmount" min="0" max="1000000" step="1" inputmode="numeric" value="${esc(p.taxAmount || '')}"></label>
    <div class="field span2"><label for="taxDocIn"><span>Tax bill or receipt (photo or PDF)</span></label>
      <input id="taxDocIn" type="file" name="taxDoc" accept="image/*,application/pdf">
      ${p.taxDoc ? `<small class="muted">Current: ${esc(p.taxDoc.name)} · <label class="inline"><input type="checkbox" name="removeTaxDoc"> remove</label></small>` : ''}
    </div></div>`, {
    onSubmit: async fd => {
      const doc = { ...p, id: flatId, taxAssessmentNo: String(fd.get('taxAssessmentNo') || '').trim(),
        taxOwnerName: String(fd.get('taxOwnerName') || '').trim(), taxAmount: Math.round(Number(fd.get('taxAmount'))) || 0 };
      if (doc.taxAmount < 0 || doc.taxAmount > 1000000) throw new Error('Enter the tax amount in rupees (0 to 10,00,000).');
      const file = fd.get('taxDoc'), now = new Date().toISOString();
      if (file && file.size) {
        const d = await readTaxDoc(file);
        await store.put('taxDocs', { id: flatId, ...d, updatedAt: now, updatedBy: S.user.name });
        doc.taxDoc = { name: d.name, type: d.type, updatedAt: now };
      } else if (fd.get('removeTaxDoc')) {
        await store.remove('taxDocs', flatId);
        delete doc.taxDoc;
      }
      await save('flatProfiles', doc, `Flat ${flatId} house tax details`);
      await refresh('House tax details saved');
    },
  });
}

function taxPaidModal(flatId, date) {
  const p = S.db.flatProfiles[flatId] || {}, d = taxDues().find(x => x.date === date) || { date, label: 'House tax' }, paid = p.taxPaid?.[date];
  openModal(`House tax paid · Flat ${flatId}`, `<p class="muted">${esc(taxDueText(d))}${p.taxAssessmentNo ? ` · Assessment No. ${esc(p.taxAssessmentNo)}` : ''}</p>
    <div class="form-grid">
      <label class="field"><span>Paid on</span><input type="date" name="paidOn" required max="${todayISO()}" value="${esc(paid?.paidOn || todayISO())}"></label>
      <label class="field"><span>Amount (₹)</span><input type="number" name="amount" min="0" step="1" inputmode="numeric" value="${esc(paid?.amount ?? (taxAmount(flatId) || ''))}"></label>
      <label class="field span2"><span>Receipt / transaction number</span><input name="receiptNo" maxlength="60" value="${esc(paid?.receiptNo || '')}"></label>
      ${paid ? '<label class="inline span2"><input type="checkbox" name="unpaid"> Not paid after all (remove this payment)</label>' : ''}
    </div>`, {
    submitLabel: 'Save',
    onSubmit: async fd => {
      const taxPaid = { ...(p.taxPaid || {}) };
      if (fd.get('unpaid')) delete taxPaid[date];
      else taxPaid[date] = { paidOn: fd.get('paidOn'), amount: Math.round(Number(fd.get('amount'))) || 0, receiptNo: String(fd.get('receiptNo') || '').trim(), by: S.user.name };
      await save('flatProfiles', { ...p, id: flatId, taxPaid }, `Flat ${flatId} house tax ${fd.get('unpaid') ? 'marked not paid' : 'paid'} — ${d.label} ${date}`);
      await refresh(fd.get('unpaid') ? 'Payment removed' : 'House tax marked paid');
    },
  });
}

// The tab is opened during the tap (phones block pop-ups opened later), then pointed at the file.
async function viewTaxDoc(flatId) {
  const win = window.open('', '_blank');
  try {
    const d = await store.get('taxDocs', flatId);
    if (!d?.data) throw new Error('The tax document could not be found.');
    const url = URL.createObjectURL(await (await fetch(d.data)).blob());
    if (win) win.location.href = url;
    else Object.assign(document.createElement('a'), { href: url, download: d.name }).click();
  } catch (err) { win?.close(); throw err; }
}

// Home banners: residents see their own flat's dues; the treasurer sees how many flats still owe.
function taxBanners() {
  if (!isAdmin()) {
    const f = flatById(S.user.flatId);
    if (!f) return '';
    const no = S.db.flatProfiles[f.id]?.taxAssessmentNo;
    return taxReminders(f.id).map(d => {
      const n = daysUntil(d.date);
      return `<div class="banner ${n < 0 ? 'bad' : 'warn'} tax-banner">${icon('home')}<div>
        <strong>House tax ${n < 0 ? `overdue · was due ${dateLabel(d.date)}` : n === 0 ? 'due today' : `due in ${n} day${n === 1 ? '' : 's'} · ${dateLabel(d.date)}`}</strong>
        <span>${esc(d.label)}${taxAmount(f.id) ? ` · ${money(taxAmount(f.id))}` : ''}${no ? ` · Assessment No. ${esc(no)}` : ''}</span>
        <div class="row-btns">
          ${taxPayUrl() ? `<a class="btn sm primary" href="${esc(taxPayUrl())}" target="_blank" rel="noopener"${no ? ` data-copy="${esc(no)}"` : ''}>${icon('wallet')}<span>Pay now</span></a>` : ''}
          <button type="button" class="btn sm ghost" data-action="tax-paid" data-id="${esc(f.id)}" data-date="${d.date}">Mark paid</button>
          <a class="btn sm ghost" href="#/dues">Details</a>
        </div></div></div>`;
    }).join('');
  }
  return taxDues().filter(d => daysUntil(d.date) <= taxDueDays()).map(d => {
    const owing = S.db.flats.filter(f => !taxPaidFor(f.id, d.date));
    if (!owing.length) return '';
    const n = daysUntil(d.date);
    return `<a class="banner ${n < 0 ? 'bad' : 'warn'} tax-banner" href="#/dues" data-action="open-tax">${icon('home')}<div>
      <strong>House tax ${n < 0 ? 'overdue' : n === 0 ? 'due today' : `due in ${n} day${n === 1 ? '' : 's'}`}: ${owing.length} of ${S.db.flats.length} flats not marked paid</strong>
      <span>${esc(taxDueText(d))}${sum(owing, f => taxAmount(f.id)) ? ` · ${money(sum(owing, f => taxAmount(f.id)))} still to pay` : ''} · Flats ${owing.map(f => esc(f.id)).join(', ')}</span></div></a>`;
  }).join('');
}

function duesTax() {
  const dues = taxDues();
  if (!dues.length) return `<div class="banner info">${icon('home')}<div><strong>Set the house tax due dates</strong>
    <span>Add the two half-yearly due dates under Settings → House tax to turn on reminders. You can still add each flat's assessment number below.</span></div></div>
    ${taxTable()}`;
  return taxTable();
}

function taxTable() {
  const rows = S.db.flats.map(f => {
    const p = S.db.flatProfiles[f.id] || {}, d = taxFocus(f.id), st = d && taxStatus(f.id, d);
    const wa = waNumber(p.phone);
    return `<tr data-tax-row="${esc(f.id)}">
      <td class="stack-title"><strong>${esc(f.id)}</strong></td>
      <td data-label="Owner">${esc(f.owner || '—')}</td>
      <td data-label="Assessment no.">${p.taxAssessmentNo ? taxNoLink(p.taxAssessmentNo) : '<span class="muted">Not added</span>'}${p.taxOwnerName ? `<small class="muted block">${esc(p.taxOwnerName)}</small>` : ''}</td>
      <td data-label="Document">${p.taxDoc ? `<button type="button" class="link-btn" data-action="view-tax-doc" data-id="${esc(f.id)}">View</button>` : '<span class="muted">—</span>'}</td>
      <td data-label="Status">${d ? `<span class="badge ${st.cls}">${st.text}</span><small class="muted block">${esc(taxDueText(d))}${taxAmount(f.id) ? ` · ${money(taxAmount(f.id))}` : ''}</small>` : '<span class="muted">—</span>'}</td>
      <td class="num stack-full"><div class="row-btns end">
        <button class="btn sm ghost" data-action="edit-tax" data-id="${esc(f.id)}">Edit</button>
        ${d ? `<button class="btn sm ${['due', 'overdue'].includes(st.key) ? 'primary' : 'ghost'}" data-action="tax-paid" data-id="${esc(f.id)}" data-date="${d.date}">${st.key === 'paid' ? 'Paid ✓' : 'Mark paid'}</button>` : ''}
        ${d && st.key !== 'paid' && wa ? `<a class="btn sm ghost" target="_blank" rel="noopener" title="Send a courtesy reminder on WhatsApp" href="https://wa.me/${wa}?text=${encodeURIComponent(taxReminderText(f, d))}">${icon('chat')}<span>WhatsApp reminder</span></a>` : ''}
      </div></td></tr>`;
  }).join('');
  return `<div class="card"><div class="card-head"><h2>House tax by flat</h2><span class="muted">Reminders start ${taxDueDays()} days before each due date</span></div>
    <div class="table-scroll"><table class="stack tax-table"><thead><tr><th>Flat</th><th>Owner</th><th>Assessment no.</th><th>Document</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">${empty('No flats yet.')}</td></tr>`}</tbody></table></div></div>`;
}

// Rename (or merge) an expense category everywhere it is used: expenses, staff salary category and
// the Settings list. Renaming to a category that already exists merges the two.
function renameCategoryCard() {
  const counts = {};
  for (const e of S.db.expenses) counts[e.category] = (counts[e.category] || 0) + 1;
  const cats = categoryList().slice().sort((a, b) => a.localeCompare(b));
  if (!cats.length) return '';
  return `<form class="card stack" data-form="renameCategory">
    <h2>Rename a category</h2>
    <p class="hint">Fixes a wrongly typed category on every expense at once (and on staff salaries and the list above). Pick a category that already exists to merge the two.</p>
    <div class="form-grid">
      <label class="field"><span>Category</span><select name="from" required><option value="">Choose…</option>
        ${cats.map(c => `<option value="${esc(c)}">${esc(c)} (${counts[c] || 0} expense${counts[c] === 1 ? '' : 's'})</option>`).join('')}</select></label>
      <label class="field"><span>New name</span><input name="to" required maxlength="60" list="renameCatList" placeholder="Type or pick a category"></label>
      ${datalist('renameCatList', cats)}
    </div>
    <div><button class="btn primary">Rename</button></div>
  </form>`;
}

async function renameCategory(from, to) {
  if (!from) throw new Error('Choose the category to rename.');
  if (!to) throw new Error('Type the new name.');
  if (to === from) throw new Error('The new name is the same as the old one.');
  const now = new Date().toISOString(), stamp = { updatedAt: now, updatedBy: S.user.name };
  const exps = S.db.expenses.filter(e => e.category === from);
  for (const e of exps) await store.put('expenses', { ...e, category: to, ...stamp });
  const staff = S.db.vendors.filter(v => v.category === from);
  for (const v of staff) await store.put('vendors', { ...v, category: to, ...stamp });
  const list = S.settings.categories || [];
  if (list.includes(from)) await saveSettings({ categories: uniq(list.map(c => c === from ? to : c)) }, `Category renamed: ${from} → ${to}`);
  await audit('update', 'expenses', 'category', `Category “${from}” renamed to “${to}” on ${exps.length} expense${exps.length === 1 ? '' : 's'}${staff.length ? ` and ${staff.length} staff` : ''}`);
  if (S.ui.exp.category === from) S.ui.exp.category = 'all';
  await refresh(`Renamed on ${exps.length} expense${exps.length === 1 ? '' : 's'}`);
}

function houseTaxSettings() {
  const due = S.settings.houseTaxDue || [], row = (i, label) => {
    const d = due[i] || {};
    return `<fieldset class="tax-due-row"><legend>${label}</legend>
      <label class="field"><span>Due month</span><select name="taxMonth${i}"><option value="">Not set</option>${monthOptions(d.month)}</select></label>
      <label class="field"><span>Due day</span><input type="number" name="taxDay${i}" min="1" max="31" value="${esc(d.day || '')}"></label></fieldset>`;
  };
  return `<form class="card stack" data-form="houseTax">
    <h2>House tax</h2>
    <p class="hint">Each flat pays its own house tax in two half-yearly instalments. Set the last date to pay each one; flats see a reminder on Home before it is due.</p>
    <div class="form-grid">${row(0, '1st half-year')}${row(1, '2nd half-year')}
      <label class="field"><span>Remind this many days before</span><input type="number" name="houseTaxRemindDays" min="1" max="120" value="${esc(taxDueDays())}"></label>
      <label class="field span2"><span>Online payment link</span><input type="url" name="houseTaxPayUrl" maxlength="300" value="${esc(taxPayUrl())}" placeholder="https://…">
        <small class="muted">Opens when a flat taps Pay online. Leave empty to hide the button.</small></label></div>
    <div><button class="btn primary">Save</button></div>
  </form>`;
}

// ----- family members (private, like the rest of the flat's details) -----
const MAX_FAMILY = 20;
const FAMILY_KEYS = ['name', 'relation', 'age', 'phone'];
const FAMILY_RELATIONS = ['Self', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandparent', 'Grandchild', 'Other'];

function familyRow(i, m = {}) {
  return `<fieldset class="family-row" data-family-row="${i}">
    <legend>Member ${i + 1}</legend>
    <label class="field fam-name"><span>Name</span><input name="fm_name_${i}" maxlength="60" value="${esc(m.name || '')}"></label>
    <label class="field"><span>Relation</span><input name="fm_relation_${i}" maxlength="30" list="familyRelations" value="${esc(m.relation || '')}" placeholder="e.g. Spouse"></label>
    <label class="field"><span>Age</span><input type="number" name="fm_age_${i}" min="0" max="120" inputmode="numeric" value="${esc(m.age ?? '')}"></label>
    <label class="field"><span>Mobile (optional)</span><input type="tel" name="fm_phone_${i}" maxlength="20" inputmode="tel" value="${esc(m.phone || '')}"></label>
  </fieldset>`;
}

// Rows beyond the "Family members" number are dropped; completely empty rows are not saved.
function readFamily(fd, count) {
  const n = Math.min(Math.max(count, 0), MAX_FAMILY);
  return Array.from({ length: n }, (_, i) => {
    const v = k => String(fd.get(`fm_${k}_${i}`) || '').trim();
    return { name: v('name'), relation: v('relation'), age: v('age') ? Math.round(Number(v('age'))) : null, phone: v('phone') };
  }).filter(m => m.name || m.relation || m.age !== null || m.phone);
}

// focusField: a form input name (from profileCompleteness) to scroll to and highlight, for "Complete now".
function profileModal(flatId, focusField) {
  const f = flatById(flatId), p = S.db.flatProfiles[flatId] || {};
  const occ = ['Owner', 'Tenant', 'Vacant'], noVehicles = p.vehicles === NO_VEHICLES;
  const step = (n, title) => `<h3 class="form-step span2"><span>${n}</span>${title}</h3>`;
  openModal(`Flat ${flatId} details`, `
    <p class="muted">Your name is shown to other residents. Phone numbers and other details are visible only to this flat and the treasurer.</p>
    <div data-pc></div>
    ${isAdmin() ? `<div class="logins-box"><span class="pc-title">Logins for this flat</span>${loginsHtml(flatId)}</div>` : ''}
    <div class="form-grid">
      ${step(1, 'Owner and who lives here')}
      <label class="field span2"><span>Owner name</span><input name="owner" required maxlength="60" autocomplete="name" value="${esc(f.owner)}"></label>
      <label class="field"><span>Living here</span><select name="occupancy">${occ.map(o => `<option${o === (p.occupancy || 'Owner') ? ' selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="field"><span>Tenant name (if rented)</span><input name="residentName" maxlength="60" value="${esc(p.residentName || '')}"></label>
      ${step(2, 'Contact')}
      <label class="field"><span>Mobile (WhatsApp)</span><input type="tel" name="phone" maxlength="20" inputmode="tel" autocomplete="tel" value="${esc(p.phone || '')}" placeholder="10-digit mobile number"></label>
      <label class="field"><span>Other phone</span><input type="tel" name="altPhone" maxlength="20" inputmode="tel" value="${esc(p.altPhone || '')}"></label>
      <label class="field span2"><span>Email</span><input type="email" name="email" maxlength="80" autocomplete="email" value="${esc(p.email || '')}"></label>
      ${step(3, 'Family and vehicles')}
      <label class="field"><span>Family members</span><input type="number" name="members" min="0" max="${MAX_FAMILY}" value="${esc(p.members || '')}"></label>
      <div class="family-rows span2" data-family-rows></div>
      ${datalist('familyRelations', FAMILY_RELATIONS)}
      <label class="field check"><input type="checkbox" name="noVehicles"${noVehicles ? ' checked' : ''}><span>No vehicles</span></label>
      <label class="field span2"><span>Vehicles</span><input name="vehicles" maxlength="120" value="${esc(noVehicles ? '' : p.vehicles || '')}" placeholder="Registration numbers, e.g. car and bike"${noVehicles ? ' disabled' : ''}></label>
      ${step(4, 'Emergency contact')}
      <label class="field"><span>Emergency contact name</span><input name="emergencyName" maxlength="60" value="${esc(p.emergencyName || '')}"></label>
      <label class="field"><span>Emergency contact phone</span><input type="tel" name="emergencyPhone" maxlength="20" inputmode="tel" value="${esc(p.emergencyPhone || '')}"></label>
    </div>`, {
    onSubmit: async fd => {
      const owner = fd.get('owner').trim();
      if (owner !== (f.owner || '')) await save('flats', { ...f, owner }, `Flat ${flatId} owner name`);
      const doc = { ...p, id: flatId };
      for (const k of PROFILE_FIELDS) doc[k] = String(fd.get(k) || '').trim();
      if (fd.get('noVehicles')) doc.vehicles = NO_VEHICLES;
      doc.members = Number(doc.members) || 0;
      const family = readFamily(fd, doc.members);
      // Only write `family` when it's used (or being cleared), so flats that skip it never send the field.
      if (family.length || p.family) doc.family = family;
      await save('flatProfiles', doc, `Flat ${flatId} details`);
      await refresh('Details saved');
    },
  });

  // Live "% complete" while typing, and the "No vehicles" tick switching the vehicles box off.
  const form = $modal.querySelector('form'), out = form.querySelector('[data-pc]'), el = form.elements;
  const update = () => {
    el.vehicles.disabled = el.noVehicles.checked;
    out.innerHTML = completenessBar(profileCompleteness({ owner: el.owner.value }, {
      occupancy: el.occupancy.value, residentName: el.residentName.value, phone: el.phone.value, members: el.members.value,
      vehicles: el.noVehicles.checked ? NO_VEHICLES : el.vehicles.value, emergencyName: el.emergencyName.value, emergencyPhone: el.emergencyPhone.value,
    }));
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();

  // One row per family member, following the "Family members" number. Rows keep what was typed when
  // the number goes down and back up again (until the form is saved).
  const famBox = form.querySelector('[data-family-rows]');
  const typed = [...(p.family || [])];
  const renderFamily = () => {
    famBox.querySelectorAll('[data-family-row]').forEach(row => {
      const i = Number(row.dataset.familyRow);
      typed[i] = Object.fromEntries(FAMILY_KEYS.map(k => [k, el[`fm_${k}_${i}`].value]));
    });
    const n = Math.min(Math.max(parseInt(el.members.value, 10) || 0, 0), MAX_FAMILY);
    famBox.innerHTML = n ? `<p class="hint">Please add each person living in the flat.</p>${Array.from({ length: n }, (_, i) => familyRow(i, typed[i])).join('')}` : '';
  };
  el.members.addEventListener('input', renderFamily);
  renderFamily();

  const target = focusField && el[focusField];
  if (target) {
    target.closest('.field')?.classList.add('pc-focus');
    target.scrollIntoView({ block: 'center' });
    target.focus();
  }
}

// ---------- staff and pay slips ----------
// Staff (watchman, cleaner…) are kept in the vendors collection with kind: 'staff', so they share
// its access rules: every member can see their phone and duties, only admins change them.
// A salary payment is an ordinary expense with a `payslip` snapshot (month, breakdown, duties) so
// it counts in the monthly statement and the slip never changes when the profile is edited later.
const staffList = () => S.db.vendors.filter(v => v.kind === 'staff').sort((a, b) => a.name.localeCompare(b.name));
const staffById = id => S.db.vendors.find(v => v.id === id && v.kind === 'staff');
const slipsFor = id => S.db.expenses.filter(e => e.payslip?.staffId === id)
  .sort((a, b) => b.payslip.month.localeCompare(a.payslip.month) || b.date.localeCompare(a.date));
const slipNo = e => `PS-${e.payslip.month}-${String(e.payslip.staffId).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`;
const telLink = n => `tel:${String(n).replace(/[^\d+]/g, '')}`;

function upiLink(st, amount, month) {
  const q = new URLSearchParams({ pa: st.upi, pn: st.name, am: String(amount), cu: 'INR', tn: `Salary ${monthLabel(month, true)}` });
  return `upi://pay?${q}`;
}

function viewStaff() {
  const list = staffList(), cm = curMonth();
  return `
    <div class="page-head"><div><h1>Staff</h1><p class="muted">Contact details and duties${isAdmin() ? ', salary payments and pay slips' : ''}.</p></div>
      ${isAdmin() ? `<div class="actions"><button class="btn primary" data-action="add-staff">${icon('plus')}<span>Add staff</span></button></div>` : ''}</div>
    <div class="cards">${list.map(st => {
      const slips = slipsFor(st.id), paidNow = slips.some(e => e.payslip.month === cm), last = slips[0];
      const wa = waNumber(st.phone);
      return `
      <article class="card vendor staff" data-staff="${esc(st.id)}">
        <div class="vendor-top"><div><h2>${esc(st.name)}</h2><p class="muted">${esc(st.role || 'Staff')}${st.joinedOn ? ' · since ' + dateLabel(st.joinedOn) : ''}</p></div>
          ${isAdmin() ? `<span class="badge ${paidNow ? 'ok' : 'warn'}">${monthLabel(cm)} ${paidNow ? 'paid' : 'not paid'}</span>` : ''}</div>
        <dl class="details compact">
          ${st.phone ? `<div><dt>Mobile</dt><dd><a href="${telLink(st.phone)}">${esc(st.phone)}</a></dd></div>` : ''}
          ${st.shift ? `<div><dt>Working hours</dt><dd>${esc(st.shift)}</dd></div>` : ''}
          ${isAdmin() && st.salary ? `<div><dt>Monthly salary</dt><dd>${money(st.salary)}</dd></div>` : ''}
          ${isAdmin() && last ? `<div><dt>Last paid</dt><dd>${monthLabel(last.payslip.month, true)} · ${money(last.amount)}</dd></div>` : ''}
        </dl>
        ${st.duties?.length ? `<div><h3 class="duties-title">Duties</h3><ul class="duties">${st.duties.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>` : ''}
        <div class="row-btns">
          ${st.phone ? `<a class="btn sm ghost" href="${telLink(st.phone)}">${icon('phone')}<span>Call</span></a>` : ''}
          ${wa ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/${wa}">${icon('chat')}<span>WhatsApp</span></a>` : ''}
          ${isAdmin() ? `<button class="btn sm primary" data-action="pay-staff" data-id="${esc(st.id)}">${icon('wallet')}<span>Pay salary</span></button>
            <button class="btn sm ghost" data-action="edit-staff" data-id="${esc(st.id)}">Edit</button>` : ''}
        </div>
        ${isAdmin() && slips.length ? `<details class="slips"><summary>Pay slips (${slips.length})</summary><div class="list">${slips.map(e => `
          <button type="button" class="row slip-row" data-action="view-slip" data-id="${esc(e.id)}">
            <span class="row-main"><strong>${monthLabel(e.payslip.month, true)}</strong><small>Paid ${dateLabel(e.date)}${e.mode ? ' · ' + esc(e.mode) : ''}</small></span>
            <span class="row-amt">${money(e.amount)}</span></button>`).join('')}</div></details>` : ''}
      </article>`; }).join('') || `<div class="card">${empty(isAdmin() ? 'No staff yet. Add the watchman with his phone number and duties.' : 'No staff details yet.')}</div>`}</div>`;
}

function staffModal(st) {
  const isNew = !st;
  st ||= { duties: [] };
  const roleCat = categoryList().find(c => st.role && c.toLowerCase().includes(st.role.toLowerCase()));
  openModal(isNew ? 'Add staff' : `Edit ${st.name}`, `
    <div class="form-grid">
      <label class="field"><span>Name</span><input name="name" required maxlength="60" value="${esc(st.name || '')}"></label>
      <label class="field"><span>Role</span><input name="role" required maxlength="40" value="${esc(st.role || '')}" placeholder="e.g. Watchman"></label>
      <label class="field"><span>Mobile</span><input type="tel" name="phone" maxlength="20" inputmode="tel" value="${esc(st.phone || '')}" placeholder="10-digit mobile number"></label>
      <label class="field"><span>Monthly salary (₹)</span><input type="number" name="salary" min="0" step="1" value="${esc(st.salary || '')}"></label>
      <label class="field"><span>Working hours</span><input name="shift" maxlength="60" value="${esc(st.shift || '')}" placeholder="e.g. 6 PM – 6 AM"></label>
      <label class="field"><span>Joined on</span><input type="date" name="joinedOn" value="${esc(st.joinedOn || '')}"></label>
      <label class="field span2"><span>Duties (one per line)</span><textarea name="duties" rows="6" maxlength="1500">${esc((st.duties || []).join('\n'))}</textarea></label>
      <label class="field"><span>Expense category for salary</span><input name="category" required maxlength="60" list="staffCatList" value="${esc(st.category || roleCat || '')}"></label>
      ${datalist('staffCatList', categoryList())}
      <label class="field"><span>Usual payment mode</span><input name="payMode" maxlength="30" list="staffModeList" value="${esc(st.payMode || modeList()[0] || '')}"></label>
      ${datalist('staffModeList', modeList())}
      <label class="field span2"><span>UPI ID (optional)</span><input name="upi" maxlength="80" value="${esc(st.upi || '')}" placeholder="name@bank"></label>
    </div>`, {
    footer: isNew ? '' : `<button type="button" class="btn danger-ghost" data-action="delete-staff" data-id="${esc(st.id)}">Delete</button><span class="spacer"></span>`,
    onSubmit: async fd => {
      const doc = { ...st, kind: 'staff' };
      for (const k of ['name', 'role', 'phone', 'shift', 'joinedOn', 'category', 'payMode', 'upi']) doc[k] = String(fd.get(k) || '').trim();
      doc.salary = Math.round(Number(fd.get('salary')) || 0);
      doc.duties = String(fd.get('duties') || '').split('\n').map(d => d.trim()).filter(Boolean); // duties may contain commas
      // Keep the vendor fields in step so the person also reads sensibly anywhere vendors are listed.
      Object.assign(doc, { service: doc.role, contractAmount: doc.salary, period: 'Monthly' });
      await save('vendors', doc, `Staff: ${doc.name}${doc.role ? ' – ' + doc.role : ''}`);
      await refresh(isNew ? 'Staff added' : 'Staff updated');
    },
  });
}

function payStaffModal(st, month = curMonth()) {
  const already = slipsFor(st.id).filter(e => e.payslip.month === month);
  openModal(`Pay ${st.name}`, `
    ${already.length ? `<p class="banner warn"><span>${monthLabel(month, true)} salary was already paid on ${dateLabel(already[0].date)} (${money(already[0].amount)}).</span></p>` : ''}
    <div class="form-grid">
      <label class="field"><span>Salary for month</span><input type="month" name="month" required value="${month}"></label>
      <label class="field"><span>Paid on</span><input type="date" name="paidOn" required value="${todayISO()}"></label>
      <label class="field"><span>Monthly salary (₹)</span><input type="number" name="salary" required min="0" step="1" value="${esc(st.salary || '')}"></label>
      <label class="field"><span>Extra / bonus (₹)</span><input type="number" name="extra" min="0" step="1" value="0"></label>
      <label class="field"><span>Advance / deductions (₹)</span><input type="number" name="deductions" min="0" step="1" value="0"></label>
      <label class="field"><span>Payment mode</span><input name="mode" maxlength="30" list="payStaffModes" value="${esc(st.payMode || modeList()[0] || '')}"></label>
      ${datalist('payStaffModes', modeList())}
      <label class="field span2"><span>Note on the slip (optional)</span><input name="note" maxlength="140" placeholder="e.g. ₹500 advance taken on 15 Oct"></label>
      <label class="field check span2"><input type="checkbox" name="includeDuties"${st.duties?.length ? ' checked' : ' disabled'}><span>Show duties on the pay slip</span></label>
    </div>
    <p class="pay-net">Net paid: <strong data-net>${money(st.salary || 0)}</strong></p>`, {
    submitLabel: 'Save payment',
    onSubmit: async fd => {
      const m = fd.get('month'), salary = Math.round(Number(fd.get('salary')) || 0);
      const extra = Math.round(Number(fd.get('extra')) || 0), deductions = Math.round(Number(fd.get('deductions')) || 0);
      const net = salary + extra - deductions;
      if (!(net > 0)) throw new Error('Net paid must be more than ₹0. Check the deductions.');
      const dup = slipsFor(st.id).find(e => e.payslip.month === m);
      if (dup && !confirm(`${monthLabel(m, true)} salary for ${st.name} was already paid (${money(dup.amount)}). Record another payment?`)) return;
      const payslip = {
        staffId: st.id, month: m, salary, extra, deductions, note: String(fd.get('note') || '').trim(),
        name: st.name, role: st.role || '', phone: st.phone || '', duties: fd.get('includeDuties') ? st.duties || [] : [],
      };
      const doc = {
        date: fd.get('paidOn'), amount: net, category: st.category || st.role || 'Staff salary',
        description: `${st.role || 'Staff'} salary – ${monthLabel(m, true)}`, vendor: st.name,
        mode: String(fd.get('mode') || '').trim(), paidBy: S.settings.treasurer || S.user.name, payslip,
      };
      const saved = await save('expenses', doc, `${doc.description} — ${money(net)} to ${st.name}`);
      await refresh('Salary payment recorded');
      showSlip(saved.id);
    },
  });
  // Keep the net figure in step while the treasurer types.
  const form = $modal.querySelector('form'), out = form.querySelector('[data-net]');
  form.addEventListener('input', () => {
    const v = k => Math.round(Number(form.elements[k].value) || 0);
    out.textContent = money(v('salary') + v('extra') - v('deductions'));
  });
}

// WhatsApp text version of the slip (*bold* is WhatsApp formatting). Optional lines are null and dropped.
function slipText(e) {
  const p = e.payslip, line = (k, v) => `${k}: ${v}`;
  return [
    `*${societyName()}*`,
    `Salary slip – ${monthLabel(p.month, true)}`,
    line('Slip no', slipNo(e)),
    '',
    line('Name', `${p.name}${p.role ? ` (${p.role})` : ''}`),
    p.phone ? line('Mobile', p.phone) : null,
    line('Paid on', `${dateLabel(e.date)}${e.mode ? ' · ' + e.mode : ''}`),
    '',
    line('Monthly salary', money(p.salary)),
    p.extra ? line('Extra / bonus', '+ ' + money(p.extra)) : null,
    p.deductions ? line('Advance / deductions', '− ' + money(p.deductions)) : null,
    `*${line('Net paid', money(e.amount))}*`,
    p.note ? line('Note', p.note) : null,
    ...(p.duties?.length ? ['', 'Duties:', ...p.duties.map(d => `• ${d}`)] : []),
    '',
    `Paid by ${e.paidBy || S.settings.treasurer || ''}. Thank you!`,
  ].filter(l => l !== null).join('\n');
}

function slipHtml(e) {
  const p = e.payslip;
  const row = (k, v, cls = '') => `<tr class="${cls}"><td>${k}</td><td class="num">${v}</td></tr>`;
  return `
    <article class="slip">
      <header class="st-head">
        <div><img src="icons/icon-192.png" alt="" width="40" height="40"><div><h2>${esc(societyName())}</h2><p>${esc(S.settings.address || '')}</p></div></div>
        <div class="st-title"><strong>Salary slip</strong><span>${monthLabel(p.month, true)}</span><small>${slipNo(e)}</small></div>
      </header>
      <dl class="details">
        <div><dt>Name</dt><dd>${esc(p.name)}</dd></div>
        <div><dt>Role</dt><dd>${esc(p.role || '—')}</dd></div>
        ${p.phone ? `<div><dt>Mobile</dt><dd>${esc(p.phone)}</dd></div>` : ''}
        <div><dt>Paid on</dt><dd>${dateLabel(e.date)}${e.mode ? ' · ' + esc(e.mode) : ''}</dd></div>
      </dl>
      <table class="st-table">
        <tbody>
          ${row('Monthly salary', money(p.salary))}
          ${p.extra ? row('Extra / bonus', '+ ' + money(p.extra)) : ''}
          ${p.deductions ? row('Advance / deductions', '− ' + money(p.deductions)) : ''}
          ${row('Net paid', money(e.amount), 'grand')}
        </tbody>
      </table>
      ${p.note ? `<p class="slip-note">Note: ${esc(p.note)}</p>` : ''}
      ${p.duties?.length ? `<h3 class="st-section">Duties</h3><ul class="duties">${p.duties.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      <footer class="slip-sign"><span>Paid by<br><strong>${esc(e.paidBy || '')}</strong></span><span>Received by<br><strong>${esc(p.name)}</strong></span></footer>
    </article>`;
}

function showSlip(id) {
  const e = S.db.expenses.find(x => x.id === id);
  if (!e?.payslip) return;
  const wa = waNumber(e.payslip.phone || staffById(e.payslip.staffId)?.phone);
  openModal(`Pay slip · ${monthLabel(e.payslip.month, true)}`, slipHtml(e), {
    footer: `<button type="button" class="btn ghost" data-action="print-slip" data-id="${esc(e.id)}">${icon('print')}<span>Print / PDF</span></button>
      <button type="button" class="btn ghost" data-action="copy-slip" data-id="${esc(e.id)}">${icon('copy')}<span>Copy</span></button>
      <span class="spacer"></span>
      <a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(slipText(e))}">${icon('chat')}<span>Send on WhatsApp</span></a>`,
  });
}

// Prints only the slip: it is copied into #printArea and everything else is hidden by the print CSS.
function printSlip(id) {
  const e = S.db.expenses.find(x => x.id === id);
  let area = document.getElementById('printArea');
  if (!area) { area = Object.assign(document.createElement('div'), { id: 'printArea' }); document.body.append(area); }
  area.innerHTML = slipHtml(e);
  document.body.classList.add('print-slip');
  closeModal();
  const done = () => { document.body.classList.remove('print-slip'); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(() => { if (!matchMedia('print').matches) done(); }, 1000);
}

// ---------- reports ----------
function viewReports() {
  const tab = S.ui.reportTab;
  return `
    <div class="page-head no-print"><div><h1>Reports</h1><p class="muted">Monthly statement in the notebook format. Print or save as PDF to share.</p></div>
      <div class="actions"><button class="btn primary" data-action="print">${icon('print')}<span>Print / PDF</span></button></div></div>
    <div class="seg no-print" role="tablist">
      <button role="tab" aria-selected="${tab === 'monthly'}" class="${tab === 'monthly' ? 'active' : ''}" data-action="report-tab" data-tab="monthly">Monthly statement</button>
      <button role="tab" aria-selected="${tab === 'annual'}" class="${tab === 'annual' ? 'active' : ''}" data-action="report-tab" data-tab="annual">Annual summary</button>
    </div>
    ${tab === 'monthly' ? monthlyReport() : annualReport()}`;
}

function statementHeader(title, sub) {
  return `<header class="st-head">
    <div><img src="icons/icon-192.png" alt="" width="40" height="40"><div><h2>${esc(societyName())}</h2><p>${esc(S.settings.address || '')}</p></div></div>
    <div class="st-title"><strong>${esc(title)}</strong><span>${esc(sub)}</span></div></header>`;
}

function monthlyReport() {
  const s = S.settings, cm = curMonth();
  const first = [s.startMonth, ...S.db.expenses.map(e => e.date.slice(0, 7))].sort()[0];
  const months = monthsBetween(first, cm).reverse();
  // Default to the most recent month that has entries.
  const mk = S.ui.reportMonth || months.find(m => S.collections[m] || S.db.expenses.some(e => e.date.startsWith(m))) || cm;
  const prev = addMonths(mk, -1), next = addMonths(mk, 1);
  const opening = balanceThrough(prev), received = S.collections[mk] || 0;
  const exps = S.db.expenses.filter(e => e.date.startsWith(mk)).sort(byExpenseOrder);
  const spent = sum(exps, e => e.amount), closing = opening + received - spent;
  const short = m => monthLabel(m).replace(' ', " '");

  // "Receipts (@ ₹1,000 × 8)" when every payment for this month's dues was the standard amount.
  const pays = isAdmin() ? S.db.payments.filter(p => (p.month || p.paidOn.slice(0, 7)) === mk) : [];
  const rate = billingFor(mk);
  const uniform = pays.length && rate.billing !== 'sqft' && pays.every(p => Number(p.amount) === Number(rate.fixedAmount));
  const receiptsLabel = uniform ? `Receipts (@ ${money(rate.fixedAmount)} × ${pays.length})` : 'Receipts (maintenance collected)';
  const paidCount = S.db.flats.filter(f => status(f, mk).key === 'paid').length;

  return `
    <div class="toolbar-inline no-print">
      <label class="field inline-field"><span>Month</span>
        <select data-change="report-month">${months.map(m => `<option value="${m}"${m === mk ? ' selected' : ''}>${monthLabel(m, true)}</option>`).join('')}</select></label>
    </div>
    <article class="card statement printable">
      ${statementHeader('Maintenance', monthLabel(mk, true))}
      <table class="st-table">
        <tbody>
          <tr><td>${esc(receiptsLabel)}</td><td class="num">${money(received)}</td></tr>
          <tr><td>Balance from ${short(prev)}</td><td class="num">${money(opening)}</td></tr>
          <tr class="subtotal"><td>Total</td><td class="num">${money(opening + received)}</td></tr>
        </tbody>
      </table>
      <h3 class="st-section">Expenditure</h3>
      <table class="st-table">
        <tbody>
          ${exps.map((e, i) => `<tr><td><span class="st-n">${i + 1}.</span> ${esc(e.description)}${e.vendor && !e.description.includes(e.vendor) ? ` <small>(${esc(e.vendor)})</small>` : ''}</td><td class="num">${money(e.amount)}</td></tr>`).join('')
            || '<tr><td colspan="2" class="muted">No expenses recorded for this month.</td></tr>'}
          <tr class="subtotal"><td>Total expenditure</td><td class="num">${money(spent)}</td></tr>
        </tbody>
      </table>
      <table class="st-table">
        <tbody>
          <tr><td>Total available</td><td class="num">${money(opening + received)}</td></tr>
          <tr><td>Less: expenditure</td><td class="num">− ${money(spent)}</td></tr>
          <tr class="grand"><td>Balance carried to ${short(next)} maintenance</td><td class="num">${money(closing)}</td></tr>
        </tbody>
      </table>
      ${exps.length ? `<h3 class="st-section">By category</h3><table class="st-table compact"><tbody>
        ${categoryTotals(exps).map(c => `<tr><td>${esc(c.label)}</td><td class="num">${money(c.value)}</td></tr>`).join('')}</tbody></table>` : ''}
      <footer class="st-foot">
        ${isAdmin() ? `<span>${paidCount} of ${S.db.flats.length} flats paid ${monthLabel(mk, true)} maintenance</span>` : ''}
        <span>${s.treasurer ? 'Prepared by ' + esc(s.treasurer) + ' · ' : ''}${dateLabel(todayISO())}</span>
      </footer>
    </article>`;
}

function annualReport() {
  const s = S.settings, cm = curMonth();
  const fy = S.ui.reportFy || fyStart(cm, s.fyStartMonth);
  const months = monthsBetween([fy, s.startMonth].sort().pop(), [addMonths(fy, 11), cm].sort()[0]);
  const spent = spentByMonth();
  const exps = S.db.expenses.filter(e => months.includes(e.date.slice(0, 7)));
  const cats = categoryTotals(exps), totalSpent = sum(cats, c => c.value);
  const totalIn = sum(months, m => S.collections[m] || 0);
  const opening = months.length ? balanceThrough(addMonths(months[0], -1)) : 0;
  return `
    <div class="toolbar-inline no-print">${fyNav(fy, 'rfy-prev', 'rfy-next')}</div>
    <article class="card statement printable">
      ${statementHeader('Annual summary', fyLabel(fy))}
      ${months.length ? `
      <div class="table-scroll"><table class="data st-annual">
        <thead><tr><th>Month</th><th class="num">Collected</th><th class="num">Spent</th><th class="num">Net</th><th class="num">Balance</th></tr></thead>
        <tbody><tr class="muted-row"><td>Opening balance</td><td></td><td></td><td></td><td class="num">${money(opening)}</td></tr>
          ${months.map(m => { const i = S.collections[m] || 0, o = spent[m] || 0; return `<tr><td><span class="wide-only">${monthLabel(m, true)}</span><span class="narrow-only">${monthLabel(m)}</span></td><td class="num">${money(i)}</td><td class="num">${money(o)}</td>
            <td class="num ${i - o < 0 ? 'neg' : ''}">${money(i - o)}</td><td class="num">${money(balanceThrough(m))}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><th>Total</th><th class="num">${money(totalIn)}</th><th class="num">${money(totalSpent)}</th><th class="num">${money(totalIn - totalSpent)}</th><th class="num">${money(balanceThrough(months.at(-1)))}</th></tr></tfoot>
      </table></div>
      <h3 class="st-section">Spending by category</h3>
      <div class="cat-bars">${cats.map(c => `<div class="cat-bar"><span>${esc(c.label)}</span>
        <div class="track"><i style="width:${(c.value / (cats[0]?.value || 1) * 100).toFixed(1)}%"></i></div>
        <strong>${money(c.value)}</strong><small>${Math.round(c.value / (totalSpent || 1) * 100)}%</small></div>`).join('') || empty('No expenses this year.')}</div>`
      : empty('No months recorded in this year.')}
    </article>`;
}

// ---------- vendors ----------
function vendorBadge(v) {
  if (!v.amcRenewal) return '';
  const d = daysUntil(v.amcRenewal);
  if (d < 0) return `<span class="badge bad">Expired ${dateLabel(v.amcRenewal)}</span>`;
  if (d <= 30) return `<span class="badge warn">Renew in ${d} day${d === 1 ? '' : 's'}</span>`;
  return `<span class="badge ok">Valid till ${dateLabel(v.amcRenewal)}</span>`;
}

function viewVendors() {
  const list = S.db.vendors.filter(v => v.kind !== 'staff').sort((a, b) => (a.amcRenewal || '9999').localeCompare(b.amcRenewal || '9999') || a.name.localeCompare(b.name));
  const spentWith = name => sum(S.db.expenses.filter(e => e.vendor === name), e => e.amount);
  return `
    <div class="page-head"><div><h1>Vendors & contracts</h1><p class="muted">Service providers, contract amounts and AMC renewal dates.</p></div>
      ${isAdmin() ? `<div class="actions"><button class="btn primary" data-action="add-vendor">${icon('plus')}<span>Add vendor</span></button></div>` : ''}</div>
    <div class="cards">${list.map(v => `
      <article class="card vendor">
        <div class="vendor-top"><div><h2>${esc(v.name)}</h2><p class="muted">${esc(v.service)}</p></div>${vendorBadge(v)}</div>
        <dl class="details compact">
          ${v.contractAmount ? `<div><dt>Contract</dt><dd>${money(v.contractAmount)}${v.period ? ' · ' + esc(v.period) : ''}</dd></div>` : v.period ? `<div><dt>Billing</dt><dd>${esc(v.period)}</dd></div>` : ''}
          <div><dt>Paid so far</dt><dd>${money(spentWith(v.name))}</dd></div>
          ${v.notes ? `<div><dt>Notes</dt><dd>${esc(v.notes)}</dd></div>` : ''}
        </dl>
        <div class="row-btns">
          ${v.phone ? `<a class="btn sm ghost" href="tel:${esc(v.phone.replace(/\s/g, ''))}">${icon('phone')}<span>${esc(v.phone)}</span></a>` : ''}
          ${isAdmin() ? `<button class="btn sm ghost" data-action="edit-vendor" data-id="${esc(v.id)}">Edit</button>` : ''}
        </div>
      </article>`).join('') || `<div class="card">${empty('No vendors yet.')}</div>`}</div>`;
}

function vendorModal(v) {
  const isNew = !v;
  v ||= {};
  openModal(isNew ? 'Add vendor' : 'Edit vendor', `
    <div class="form-grid">
      <label class="field span2"><span>Name</span><input name="name" required maxlength="80" value="${esc(v.name || '')}"></label>
      <label class="field span2"><span>Service</span><input name="service" maxlength="80" value="${esc(v.service || '')}"></label>
      <label class="field"><span>Phone</span><input type="tel" name="phone" maxlength="20" value="${esc(v.phone || '')}"></label>
      <label class="field"><span>Contract amount (₹)</span><input type="number" name="contractAmount" min="0" value="${esc(v.contractAmount || '')}"></label>
      <label class="field"><span>Billing period</span><input name="period" list="periodList" maxlength="30" value="${esc(v.period || '')}" placeholder="e.g. Monthly"></label>
      ${datalist('periodList', periodList())}
      <label class="field"><span>AMC / contract renewal</span><input type="date" name="amcRenewal" value="${esc(v.amcRenewal || '')}"></label>
      <label class="field span2"><span>Notes</span><textarea name="notes" rows="2" maxlength="300">${esc(v.notes || '')}</textarea></label>
    </div>`, {
    footer: isNew ? '' : `<button type="button" class="btn danger-ghost" data-action="delete-vendor" data-id="${esc(v.id)}">Delete</button><span class="spacer"></span>`,
    onSubmit: async fd => {
      const doc = { ...v };
      for (const k of ['name', 'service', 'phone', 'period', 'amcRenewal', 'notes']) doc[k] = String(fd.get(k) || '').trim();
      doc.contractAmount = Number(fd.get('contractAmount')) || 0;
      await save('vendors', doc, `${doc.name}${doc.service ? ' – ' + doc.service : ''}`);
      await refresh(isNew ? 'Vendor added' : 'Vendor updated');
    },
  });
}

// ---------- notices ----------
function viewNotices() {
  const list = [...S.db.notices].sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date));
  return `
    <div class="page-head"><div><h1>Notices</h1><p class="muted">Announcements from the association.</p></div>
      ${isAdmin() ? `<div class="actions"><button class="btn primary" data-action="add-notice">${icon('plus')}<span>Post notice</span></button></div>` : ''}</div>
    <div class="stack">${list.map(n => `
      <article class="card notice ${n.pinned ? 'pinned' : ''}">
        <div class="vendor-top"><div><h2>${esc(n.title)}</h2><p class="muted">${dateLabel(n.date)}${n.pinned ? ' · 📌 Pinned' : ''}</p></div>
          ${isAdmin() ? `<button class="btn sm ghost" data-action="edit-notice" data-id="${esc(n.id)}">Edit</button>` : ''}</div>
        <p class="notice-body">${esc(n.body)}</p>
      </article>`).join('') || `<div class="card">${empty('No notices yet.')}</div>`}</div>`;
}

function noticeModal(n) {
  const isNew = !n;
  n ||= { date: todayISO(), pinned: true };
  openModal(isNew ? 'Post notice' : 'Edit notice', `
    <div class="form-grid">
      <label class="field span2"><span>Title</span><input name="title" required maxlength="100" value="${esc(n.title || '')}"></label>
      <label class="field span2"><span>Message</span><textarea name="body" rows="5" required maxlength="1500">${esc(n.body || '')}</textarea></label>
      <label class="field"><span>Date</span><input type="date" name="date" required value="${esc(n.date)}"></label>
      <label class="field check"><input type="checkbox" name="pinned"${n.pinned ? ' checked' : ''}><span>Pin to home page</span></label>
    </div>`, {
    submitLabel: isNew ? 'Post' : 'Save',
    footer: isNew ? '' : `<button type="button" class="btn danger-ghost" data-action="delete-notice" data-id="${esc(n.id)}">Delete</button><span class="spacer"></span>`,
    onSubmit: async fd => {
      const doc = { ...n, title: fd.get('title').trim(), body: fd.get('body').trim(), date: fd.get('date'), pinned: !!fd.get('pinned') };
      await save('notices', doc, doc.title);
      await refresh(isNew ? 'Notice posted' : 'Notice updated');
    },
  });
}

// ---------- settings ----------
const monthOptions = sel => Array.from({ length: 12 }, (_, i) =>
  `<option value="${i + 1}"${+sel === i + 1 ? ' selected' : ''}>${new Date(2000, i, 1).toLocaleDateString('en-IN', { month: 'long' })}</option>`).join('');

// Fields shared by the first-run setup screen and the Settings page.
function societyFields(s) {
  return `
    <label class="field span2"><span>Society / apartment name</span><input name="name" required maxlength="80" value="${esc(s.name || '')}"></label>
    <label class="field span2"><span>Address</span><input name="address" maxlength="200" value="${esc(s.address || '')}"></label>
    <label class="field span2"><span>Treasurer (shown on statements)</span><input name="treasurer" maxlength="60" value="${esc(s.treasurer || '')}"></label>
    <label class="field"><span>Tracking starts (month)</span><input type="month" name="startMonth" required value="${esc(s.startMonth || curMonth())}"></label>
    <label class="field"><span>Balance brought forward into that month (₹)</span><input type="number" name="openingBalance" step="1" value="${esc(s.openingBalance ?? '')}"></label>
    <label class="field"><span>Financial year starts in</span><select name="fyStartMonth">${monthOptions(s.fyStartMonth)}</select></label>
    <label class="field span2"><span>How residents should pay</span><textarea name="payNote" rows="2" maxlength="300">${esc(s.payNote || '')}</textarea></label>
    <label class="field"><span>Expense categories (one per line)</span><textarea name="categories" rows="6">${esc((s.categories || []).join('\n'))}</textarea></label>
    <label class="field"><span>Payment modes (one per line)</span><textarea name="paymentModes" rows="6">${esc((s.paymentModes || []).join('\n'))}</textarea></label>
    <label class="field span2"><span>Monthly bills quick links (one per line)</span><textarea name="quickExpenses" rows="4">${esc(quickList().join('\n'))}</textarea>
      <small class="muted">Shown on Home and Expenses for quick entry each month. Leave empty to hide.</small></label>`;
}

function societyPatch(fd) {
  const patch = {};
  for (const k of ['name', 'address', 'treasurer', 'startMonth', 'payNote']) patch[k] = String(fd.get(k) || '').trim();
  patch.openingBalance = Number(fd.get('openingBalance')) || 0;
  patch.fyStartMonth = Number(fd.get('fyStartMonth')) || FALLBACK.fyStartMonth;
  patch.categories = uniq(lines(fd.get('categories')));
  patch.paymentModes = uniq(lines(fd.get('paymentModes')));
  if (fd.has('quickExpenses')) patch.quickExpenses = uniq(String(fd.get('quickExpenses') || '').split('\n').map(x => x.trim()));
  return patch;
}

function viewSettings() {
  return `
    <div class="page-head"><div><h1>Settings</h1><p class="muted">Society details, members and data.</p></div></div>
    <form class="card stack" data-form="settings">
      <h2>Society</h2>
      <div class="form-grid">${societyFields(S.settings)}</div>
      <div><button class="btn primary">Save</button></div>
    </form>
    ${renameCategoryCard()}
    ${houseTaxSettings()}
    ${membersCard()}
    <div class="card">
      <div class="card-head"><h2>Activity log</h2><span class="muted">Last ${S.db.auditLog.length} changes</span></div>
      <ul class="audit">${S.db.auditLog.map(a => `<li><time>${dateTimeLabel(a.at)}</time><span><strong>${esc(a.byName)}</strong> ${a.action}d ${esc(ENTITY_LABELS[a.entity] || a.entity)}: ${esc(a.summary)}</span></li>`).join('') || '<li class="muted">No activity yet.</li>'}</ul>
    </div>
    <div class="card stack">
      <h2>Data</h2>
      <p class="muted">Download a full backup, or import a data file (for example an earlier month from the notebook). Imported records with the same ID replace existing ones.</p>
      <div class="row-btns">
        <button class="btn ghost" data-action="backup">${icon('download')}<span>Download backup (JSON)</span></button>
        <label class="btn ghost">${icon('upload')}<span>Import data file</span><input type="file" accept="application/json,.json" data-change="import" hidden></label>
      </div>
    </div>`;
}

const ENTITY_LABELS = {
  flats: 'flat', flatProfiles: 'flat details', expenses: 'expense', payments: 'payment', vendors: 'vendor',
  notices: 'notice', meta: 'settings', users: 'member', all: 'data',
};

function membersCard() {
  const users = [...S.db.users].sort((a, b) => (a.role === 'pending' ? -1 : 0) - (b.role === 'pending' ? -1 : 0) || (a.name || '').localeCompare(b.name || ''));
  const flatOpts = sel => `<option value="">—</option>` + S.db.flats.map(f => `<option value="${esc(f.id)}"${f.id === sel ? ' selected' : ''}>${esc(f.id)}</option>`).join('');
  const roleOpts = sel => ['pending', 'resident', 'admin'].map(r => `<option${r === sel ? ' selected' : ''}>${r}</option>`).join('');
  return `<div class="card">
    <div class="card-head"><h2>Members</h2><span class="muted">Approve residents and link them to their flat</span></div>
    ${users.length ? `<div class="table-scroll"><table class="data stack members-table">
      <thead><tr><th>Name</th><th>Role</th><th>Flat</th><th></th></tr></thead>
      <tbody>${users.map(u => `<tr data-uid="${esc(u.id)}">
        <td class="stack-full"><strong>${esc(u.name || '')}</strong><br><small class="muted">${esc(u.email || '')}${u.phone ? ' · ' + esc(u.phone) : ''}</small>
          ${u.role === 'pending' && u.requestedFlat ? `<br><span class="badge warn">Asks for Flat ${esc(u.requestedFlat)}</span>` : ''}</td>
        <td data-label="Role"><select class="select-sm" name="role" aria-label="Role">${roleOpts(u.role === 'pending' && u.requestedFlat ? 'resident' : u.role)}</select></td>
        <td data-label="Flat"><select class="select-sm" name="flatId" aria-label="Flat">${flatOpts(u.flatId || u.requestedFlat)}</select></td>
        <td class="num stack-full"><button class="btn sm ${u.role === 'pending' ? 'primary' : 'ghost'}" data-action="save-member" data-id="${esc(u.id)}">${u.role === 'pending' ? 'Approve' : 'Save'}</button></td></tr>`).join('')}</tbody>
    </table></div>` : empty('Nobody has signed in yet. Share the site link with residents.')}</div>`;
}

const IMPORT_COLLECTIONS = ['flats', 'flatProfiles', 'expenses', 'payments', 'vendors', 'notices'];

function backupJson() {
  const { id, ...settings } = S.settings;
  return JSON.stringify({
    app: 'svln-paradise', version: 1, exportedAt: new Date().toISOString(), settings,
    flats: S.db.flats, flatProfiles: Object.values(S.db.flatProfiles), expenses: S.db.expenses,
    payments: S.db.payments, vendors: S.db.vendors, notices: S.db.notices,
  }, null, 2);
}

async function importData(file) {
  const b = JSON.parse(await file.text());
  if (b.app !== 'svln-paradise') throw new Error('This file is not a data file for this site.');
  const counts = IMPORT_COLLECTIONS.map(c => [c, (b[c] || []).length]).filter(([, n]) => n);
  const summary = counts.map(([c, n]) => `${n} ${ENTITY_LABELS[c] || c}${n === 1 ? '' : 's'}`).join(', ');
  if (!confirm(`Import ${file.name}?\n\n${summary || 'No records'}${b.settings ? '\n+ society settings' : ''}`)) return;
  if (b.settings) await saveSettings(b.settings, `Settings imported from ${file.name}`);
  for (const [col] of counts) for (const d of b[col]) await store.put(col, d);
  await refreshCollectionTotals();
  await audit('create', 'all', '', `Imported ${file.name}: ${summary}`);
  await refresh('Import finished');
}

// ---------- sign-in, first-run setup and waiting screens ----------
function renderNotConfigured() {
  renderBare(`
    <section class="auth card">
      <img src="icons/icon-192.png" alt="" width="64" height="64">
      <h1>Not connected yet</h1>
      <p>This ${ENV} copy of the site isn't connected to its Firebase database yet.</p>
      <p class="muted">Add the Firebase web app config for <strong>${ENV}</strong> in <code>docs/js/config.js</code>. See the README.</p>
    </section>`);
}

// ---------- install as a phone app ----------
// Chrome only offers one-tap install (`beforeinstallprompt`) after the visitor has tapped the page and stayed
// a little while, apps' built-in browsers (WhatsApp, Facebook…) can't install at all, and on iPhone only
// Safari can add to the home screen. So phones always get the steps that work for their browser, and the
// one-tap Install button is added whenever Chrome offers it.
let installEvent = null;
const UA = () => navigator.userAgent;
const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIPhone = () => /iphone|ipad|ipod/i.test(UA());
const isAndroid = () => /android/i.test(UA());
const isInAppBrowser = () => /\bwv\b|FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat/i.test(UA());
const isIPhoneOtherBrowser = () => isIPhone() && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(UA());

// What this visitor should do to install, or null on computers where the browser shows its own install icon.
function installHelp() {
  if (installEvent) return { title: 'Install the SVLN app', text: 'Open it from your home screen, like any other app.', oneTap: true };
  if (isIPhone()) {
    return isInAppBrowser() || isIPhoneOtherBrowser()
      ? { title: 'Add SVLN to your home screen', text: 'Open this page in Safari first (tap ⋯ or the compass icon → “Open in Safari”). Then tap Share ⎙ → “Add to Home Screen”.' }
      : { title: 'Add SVLN to your home screen', text: 'Tap the Share button ⎙ at the bottom, then “Add to Home Screen” → “Add”.' };
  }
  if (isAndroid()) {
    return isInAppBrowser()
      ? { title: 'Install the SVLN app', text: 'Open this page in Chrome first: tap ⋮ (top right) → “Open in Chrome”. Then tap ⋮ → “Install app” or “Add to Home screen”.' }
      : { title: 'Install the SVLN app', text: 'Tap the browser menu ⋮ (top right) → “Install app” or “Add to Home screen”. Opened from WhatsApp? First tap ⋮ → “Open in Chrome”.' };
  }
  return null;
}

function installBanner() {
  if (isInstalled() || lsGet('svln-install-dismissed')) return '';
  const h = installHelp();
  if (!h) return '';
  return `<div class="banner install"><img src="icons/icon-192.png" alt="" width="44" height="44"><div>
    <strong>${h.title}</strong><span>${h.text}</span>
    <div class="row-btns">${h.oneTap ? '<button type="button" class="btn primary sm" data-action="install-app">Install</button>' : ''}
      <button type="button" class="btn ghost sm" data-action="dismiss-install">Not now</button></div></div></div>`;
}

// Re-draw whichever screen is showing so the install banner appears or disappears.
function refreshInstallBanner() {
  if (S.user && S.hasSettings && !document.body.classList.contains('bare')) rerender();
  else if (!S.user && $view.querySelector('form[data-form="login"]')) renderLogin();
}

function renderLogin() {
  renderBare(`
    <section class="auth card">
      <img src="icons/icon-192.png" alt="" width="64" height="64">
      <h1>${esc(S.info?.name || 'Maintenance accounts')}</h1>
      ${S.info?.address ? `<p class="muted">${esc(S.info.address)}</p>` : ''}
      <p>${S.info ? 'Sign in to see the maintenance accounts.' : 'Sign in to set up your society\'s accounts.'}</p>
      ${installBanner()}
      <button class="btn primary block" data-action="login-google">Continue with Google</button>
      <div class="or"><span>or use email</span></div>
      <form data-form="login" class="stack">
        <label class="field"><span>Your name (only for new accounts)</span><input name="name" autocomplete="name"></label>
        <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>
        <label class="field"><span>Password</span><input type="password" name="password" required minlength="6" autocomplete="current-password"></label>
        <div class="row-btns"><button class="btn primary" name="mode" value="signin">Sign in</button><button class="btn ghost" name="mode" value="signup">Create account</button></div>
      </form>
    </section>`);
}

function renderSetup() {
  renderBare(`
    <section class="card setup">
      <h1>Set up your society</h1>
      <p class="muted">You're the first person here, so you'll be the treasurer (admin). These details are saved in the database
        and can be changed later in Settings. Flats and past months can be added afterwards, or imported from a data file.</p>
      <form data-form="setup" class="stack">
        <div class="form-grid">
          ${societyFields({ treasurer: S.user.name, fyStartMonth: FALLBACK.fyStartMonth })}
          <label class="field"><span>Maintenance per flat each month (₹)</span><input type="number" name="fixedAmount" min="0" step="1" required></label>
          <label class="field"><span>Due by day of month</span><input type="number" name="dueDay" min="1" max="28" required value="${FALLBACK.dueDay}"></label>
          <label class="field span2"><span>Flat numbers (one per line or comma separated)</span><textarea name="flats" rows="3"></textarea></label>
        </div>
        <div><button class="btn primary">Save and continue</button></div>
      </form>
    </section>`);
}

function renderPending() {
  renderBare(`
    <section class="auth card">
      <img src="icons/icon-192.png" alt="" width="64" height="64">
      <h1>${S.user.requestedFlat ? 'Waiting for approval' : 'Which flat is yours?'}</h1>
      <p>You're signed in as <strong>${esc(S.user.email)}</strong>.
        ${S.user.requestedFlat ? `You asked to join <strong>Flat ${esc(S.user.requestedFlat)}</strong>. The treasurer will approve it soon. You can change the details below if needed.`
          : 'Tell us your flat number. The treasurer will approve it once, and after that you can see the accounts and update your flat\'s details.'}</p>
      <form data-form="request-flat" class="stack">
        <label class="field"><span>Flat number</span><input name="requestedFlat" required maxlength="12" inputmode="numeric" value="${esc(S.user.requestedFlat || '')}"></label>
        <label class="field"><span>Your name</span><input name="name" required maxlength="60" autocomplete="name" value="${esc(S.user.name || '')}"></label>
        <label class="field"><span>Mobile</span><input type="tel" name="phone" maxlength="20" inputmode="tel" autocomplete="tel" value="${esc(S.user.phone || '')}"></label>
        <button class="btn primary">${S.user.requestedFlat ? 'Update request' : 'Send request'}</button>
      </form>
    </section>`);
}

function renderNotReady() {
  renderBare(`
    <section class="auth card">
      <img src="icons/icon-192.png" alt="" width="64" height="64">
      <h1>Not set up yet</h1>
      <p>The treasurer hasn't finished setting up the accounts. Please check back later.</p>
    </section>`);
}

// ---------- event wiring ----------
const ACTIONS = {
  'close-modal': closeModal,
  async 'install-app'() {
    const e = installEvent;
    installEvent = null;
    closeModal();
    if (!e) return;
    await e.prompt();
    const choice = await e.userChoice;
    refreshInstallBanner();
    if (choice?.outcome === 'accepted') toast('SVLN app installed');
  },
  'dismiss-install': () => { lsSet('svln-install-dismissed', '1'); refreshInstallBanner(); },
  theme() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    lsSet('svln-theme', root.dataset.theme);
  },
  more() {
    const h = !isInstalled() && installHelp();
    openModal('More', `<nav class="sheet">${navItems().slice(4).map(([id, label, ic]) =>
      `<a href="#/${id}" data-action="nav" class="${S.route === id ? 'active' : ''}">${icon(ic)}<span>${label}</span></a>`).join('')}
      ${h ? `<button type="button" class="sheet-install" data-action="install-help"><img src="icons/icon-192.png" alt="" width="24" height="24"><span>Install SVLN app</span></button>` : ''}</nav>`);
  },
  // Always reachable (even after "Not now") from More.
  'install-help'() {
    const h = installHelp();
    if (!h) return;
    openModal(h.title, `<div class="install-help"><img src="icons/icon-192.png" alt="" width="72" height="72"><p>${h.text}</p></div>`, {
      footer: h.oneTap ? '<button type="button" class="btn primary" data-action="install-app">Install</button>' : '',
    });
  },
  nav(ds, el) { closeModal(); location.hash = el.getAttribute('href'); },
  print() { window.print(); },
  lang: () => { setLang(getLang() === 'te' ? 'en' : 'te'); location.reload(); },
  'sign-out': async () => { await stopPresence(); return store.signOut(); },
  'login-google': () => store.signInGoogle(),

  'add-expense': () => openModal('Add expense', expenseForm(), { onSubmit: fd => submitExpense(fd) }),
  'quick-expense': ds => openQuickExpense(quickList()[+ds.i]),
  'view-expense': ds => showExpense(ds.id),
  'edit-expense': ds => {
    const e = S.db.expenses.find(x => x.id === ds.id);
    openModal('Edit expense', expenseForm(e), { onSubmit: fd => submitExpense(fd, e) });
  },
  async 'delete-expense'(ds) {
    const e = S.db.expenses.find(x => x.id === ds.id);
    if (!confirm(`Delete “${e.description}” (${money(e.amount)})?`)) return;
    await del('expenses', e.id, `${e.description} — ${money(e.amount)}`);
    closeModal();
    await refresh('Expense deleted');
  },
  'export-csv': exportCsv,

  'dues-tab': ds => { S.ui.duesTab = ds.tab; rerender(); },
  'fy-prev': () => { S.ui.fy = addMonths(S.ui.fy || fyStart(curMonth(), S.settings.fyStartMonth), -12); rerender(); },
  'fy-next': () => { S.ui.fy = addMonths(S.ui.fy || fyStart(curMonth(), S.settings.fyStartMonth), 12); rerender(); },
  pay: ds => payModal(ds.flat, ds.month),
  async 'delete-payment'(ds) {
    const p = S.db.payments.find(x => x.id === ds.id);
    if (!confirm(`Remove ${money(p.amount)} payment from Flat ${p.flatId}?`)) return;
    await del('payments', p.id, `${money(p.amount)} from Flat ${p.flatId} for ${monthLabel(p.month, true)}`);
    await refresh('Payment removed');
    payModal(p.flatId, p.month);
  },
  'copy-reminder': ds => { const f = flatById(ds.flat); return copyText(reminderText(f, outstanding(f))); },
  'copy-all-reminders': () => copyText(S.db.flats.map(f => ({ f, o: outstanding(f) })).filter(r => r.o.total > 0)
    .map(r => reminderText(r.f, r.o)).join('\n\n')),
  'edit-profile': ds => profileModal(ds.id),
  'edit-tax': ds => houseTaxModal(ds.id),
  'tax-paid': ds => taxPaidModal(ds.id, ds.date),
  'view-tax-doc': ds => viewTaxDoc(ds.id),
  'open-tax': () => { S.ui.duesTab = 'tax'; location.hash = '#/dues'; if (S.route === 'dues') rerender(); },
  'complete-profile': ds => profileModal(ds.id, ds.field),
  'toggle-incomplete': () => { S.ui.incompleteOnly = !S.ui.incompleteOnly; rerender(); },
  'open-flats': () => { S.ui.duesTab = 'flats'; S.ui.incompleteOnly = true; location.hash = '#/dues'; },
  'remind-profile': ds => copyText(profileReminder(flatById(ds.id)), 'Reminder copied — paste it in WhatsApp'),
  'copy-profile-reminders': () => copyText(S.db.flats.filter(f => completenessOf(f).missing.length).map(profileReminder).join('\n\n'),
    'Reminders copied — paste them in WhatsApp'),
  'add-flat': () => flatModal(),
  'edit-flat': ds => flatModal(flatById(ds.id)),
  async 'delete-flat'(ds) {
    const n = S.db.payments.filter(p => p.flatId === ds.id).length;
    if (!confirm(`Delete flat ${ds.id}?${n ? ` Its ${n} payment record(s) stay in the accounts.` : ''}`)) return;
    await del('flats', ds.id, `Flat ${ds.id}`);
    closeModal();
    await refresh('Flat deleted');
  },

  'report-tab': ds => { S.ui.reportTab = ds.tab; rerender(); },
  'rfy-prev': () => { S.ui.reportFy = addMonths(S.ui.reportFy || fyStart(curMonth(), S.settings.fyStartMonth), -12); rerender(); },
  'rfy-next': () => { S.ui.reportFy = addMonths(S.ui.reportFy || fyStart(curMonth(), S.settings.fyStartMonth), 12); rerender(); },

  'add-staff': () => staffModal(),
  'edit-staff': ds => staffModal(staffById(ds.id)),
  'pay-staff': ds => payStaffModal(staffById(ds.id)),
  async 'delete-staff'(ds) {
    const st = staffById(ds.id);
    if (!confirm(`Delete ${st.name}? Past salary payments and pay slips are kept.`)) return;
    await del('vendors', st.id, `Staff: ${st.name}`);
    closeModal();
    await refresh('Staff deleted');
  },
  'view-slip': ds => showSlip(ds.id),
  'copy-slip': ds => copyText(slipText(S.db.expenses.find(e => e.id === ds.id)), 'Pay slip copied — paste it in WhatsApp'),
  'print-slip': ds => printSlip(ds.id),
  'add-vendor': () => vendorModal(),
  'edit-vendor': ds => vendorModal(S.db.vendors.find(v => v.id === ds.id)),
  async 'delete-vendor'(ds) {
    const v = S.db.vendors.find(x => x.id === ds.id);
    if (!confirm(`Delete vendor ${v.name}? Past expenses are kept.`)) return;
    await del('vendors', v.id, v.name);
    closeModal();
    await refresh('Vendor deleted');
  },

  'add-notice': () => noticeModal(),
  'edit-notice': ds => noticeModal(S.db.notices.find(n => n.id === ds.id)),
  async 'delete-notice'(ds) {
    const n = S.db.notices.find(x => x.id === ds.id);
    if (!confirm(`Delete notice “${n.title}”?`)) return;
    await del('notices', n.id, n.title);
    closeModal();
    await refresh('Notice deleted');
  },

  async 'save-member'(ds) {
    const row = document.querySelector(`tr[data-uid="${CSS.escape(ds.id)}"]`);
    const u = S.db.users.find(x => x.id === ds.id);
    const doc = { ...u, role: row.querySelector('[name=role]').value, flatId: row.querySelector('[name=flatId]').value };
    await save('users', doc, `${u.name || u.email}: ${doc.role}${doc.flatId ? ', flat ' + doc.flatId : ''}`);
    await refresh('Member updated');
  },
  backup: () => download(`${fileSlug()}-backup-${todayISO()}.json`, backupJson(), 'application/json'),
};

const FORMS = {
  async billing(fd) {
    const s = S.settings;
    const dueDay = Math.min(Math.max(parseInt(fd.get('dueDay'), 10) || FALLBACK.dueDay, 1), 28);
    const rate = { billing: fd.get('billing'), fixedAmount: Number(fd.get('fixedAmount')) || 0, ratePerSqft: Number(fd.get('ratePerSqft')) || 0 };
    const from = fd.get('from') || curMonth();
    // The first change records what applied until now, from the month tracking started.
    const history = s.billingHistory?.length ? s.billingHistory
      : [{ from: s.startMonth, billing: s.billing, fixedAmount: s.fixedAmount, ratePerSqft: s.ratePerSqft }];
    const billingHistory = [...history.filter(e => e.from !== from), { from, ...rate }].sort((a, b) => a.from.localeCompare(b.from));
    const latest = billingHistory.at(-1);
    await saveSettings({ billing: latest.billing, fixedAmount: latest.fixedAmount, ratePerSqft: latest.ratePerSqft, dueDay, billingHistory },
      `Maintenance ${rate.billing === 'sqft' ? `₹${rate.ratePerSqft}/sq. ft.` : money(rate.fixedAmount)} from ${monthLabel(from, true)}`);
    await refresh('Maintenance amount saved');
  },
  async settings(fd) {
    await saveSettings(societyPatch(fd), 'Society settings updated');
    await refresh('Settings saved');
  },
  async renameCategory(fd) {
    await renameCategory(String(fd.get('from') || ''), String(fd.get('to') || '').trim());
  },
  async houseTax(fd) {
    const houseTaxDue = ['1st half-year', '2nd half-year'].map((label, i) => ({ label, month: Number(fd.get('taxMonth' + i)) || 0, day: Number(fd.get('taxDay' + i)) || 0 }));
    for (const d of houseTaxDue) {
      if (!d.month !== !d.day) throw new Error(`Set both the month and the day for the ${d.label}, or neither.`);
      if (d.day > 31) throw new Error('Due day must be between 1 and 31.');
    }
    const houseTaxPayUrl = String(fd.get('houseTaxPayUrl') || '').trim();
    if (houseTaxPayUrl && !/^https:\/\/\S+$/.test(houseTaxPayUrl)) throw new Error('The payment link must start with https://');
    await saveSettings({ houseTaxDue: houseTaxDue.filter(d => d.month), houseTaxRemindDays: Number(fd.get('houseTaxRemindDays')) || 30, houseTaxPayUrl }, 'House tax due dates updated');
    await refresh('House tax settings saved');
  },
  async setup(fd) {
    const now = new Date().toISOString();
    // The first sign-in on an empty database becomes admin (firestore.rules only allow this before public/info exists).
    if (!isAdmin()) {
      await store.put('users', { id: S.user.uid, email: S.user.email, name: S.user.name, role: 'admin', createdAt: now });
      S.user.role = 'admin';
    }
    const dueDay = Math.min(Math.max(parseInt(fd.get('dueDay'), 10) || FALLBACK.dueDay, 1), 28);
    await saveSettings({ ...societyPatch(fd), billing: 'fixed', fixedAmount: Number(fd.get('fixedAmount')) || 0, ratePerSqft: 0, dueDay }, 'Society set up');
    for (const id of uniq(lines(fd.get('flats')))) {
      await store.put('flats', { id, owner: '', sqft: 0, createdAt: now, createdBy: S.user.name });
    }
    await start();
    toast('Society set up');
  },
  async 'request-flat'(fd) {
    const prof = await store.get('users', S.user.uid);
    const patch = { requestedFlat: fd.get('requestedFlat').trim(), name: fd.get('name').trim(), phone: fd.get('phone').trim() };
    await store.put('users', { ...prof, ...patch });
    Object.assign(S.user, patch);
    renderPending();
    toast('Request sent to the treasurer');
  },
  async login(fd) {
    const email = fd.get('email').trim(), pw = fd.get('password');
    if (fd.get('mode') === 'signup') await store.signUpEmail(email, pw, fd.get('name').trim());
    else await store.signInEmail(email, pw);
  },
};

const CHANGES = {
  'report-month': v => { S.ui.reportMonth = v; rerender(); },
  'spend-view': v => { S.ui.spendView = v; rerender(); },
  'demo-account': v => { S.ui.reportMonth = null; S.ui.spendView = null; store.switchAccount(v); },
  async import(_, input) {
    const file = input.files[0];
    input.value = '';
    if (file) await importData(file);
  },
};

function bindEvents() {
  // Links that copy something first (Pay online copies the assessment number); the link still opens.
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-copy]');
    if (!a || !navigator.clipboard) return;
    navigator.clipboard.writeText(a.dataset.copy)
      .then(() => toast(`Assessment number ${a.dataset.copy} copied — paste it on the payment page`)).catch(() => {});
  });
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    if (isBusy(el)) return;
    try {
      // Only actions that wait (they return a promise) get the loading letters; instant ones never flash them.
      const result = fn(el.dataset, el);
      if (result && typeof result.then === 'function') await withBusy(el, () => result);
    } catch (err) { console.error(err); toast(friendlyError(err), 'bad'); }
  });
  document.addEventListener('input', e => {
    const key = e.target.dataset?.filter;
    if (!key) return;
    S.ui.exp[key] = e.target.value;
    $('#expList').innerHTML = expList();
  });
  document.addEventListener('change', async e => {
    const t = e.target;
    if (!t.dataset.change) return;
    // A hidden file input lives inside a label styled as a button (Import data file): spin that.
    const shown = t.type === 'file' ? t.closest('.btn') : null;
    try { await withBusy(shown, () => CHANGES[t.dataset.change](t.value, t)); }
    catch (err) { console.error(err); toast(friendlyError(err), 'bad'); }
  });
  document.addEventListener('submit', async e => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    // Read the form (including which button was pressed) before disabling that button:
    // disabled buttons are left out of FormData.
    const btn = e.submitter || form.querySelector('[type=submit], button:not([type])');
    if (isBusy(btn)) return;
    const fd = new FormData(form, e.submitter);
    try { await withBusy(btn, () => FORMS[form.dataset.form](fd, form)); }
    catch (err) { console.error(err); toast(friendlyError(err), 'bad'); }
  });
  $modal.addEventListener('click', e => { if (e.target === $modal) closeModal(); });
  window.addEventListener('hashchange', route);
}

// ---------- boot ----------
async function start() {
  await loadData();
  if (!S.hasSettings) return isAdmin() ? renderSetup() : renderNotReady();
  document.body.classList.remove('bare');
  renderChrome();
  route();
  startPresence();
}

async function onAuthChange(fbUser) {
  if (!fbUser) { S.user = null; return renderLogin(); }
  let prof = await store.get('users', fbUser.uid);
  S.user = { uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName || fbUser.email };
  if (!prof) {
    // Empty database: the first person to sign in sets the society up and becomes admin.
    if (!S.info) { S.user.role = 'pending'; return renderSetup(); }
    prof = { id: fbUser.uid, email: fbUser.email, name: S.user.name, role: 'pending', createdAt: new Date().toISOString() };
    await store.put('users', prof);
  }
  Object.assign(S.user, { email: prof.email, name: prof.name, role: prof.role, flatId: prof.flatId, requestedFlat: prof.requestedFlat, phone: prof.phone });
  if (!['admin', 'resident'].includes(prof.role)) return renderPending();
  await start();
}

async function boot() {
  const theme = lsGet('svln-theme');
  if (theme) document.documentElement.dataset.theme = theme;
  if (getLang() === 'te') startTelugu();
  bindEvents();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; refreshInstallBanner(); });
  window.addEventListener('appinstalled', () => { installEvent = null; refreshInstallBanner(); });
  if (!store) return renderNotConfigured();
  try {
    await store.init();
    S.info = await store.get('public', 'info');
  } catch (err) {
    console.error(err);
    return renderBare(`<div class="card">${empty('Could not connect to the database: ' + (err.message || err))}</div>`);
  }
  renderBrand();
  store.onAuth(async fbUser => {
    try { await onAuthChange(fbUser); }
    catch (err) { console.error(err); toast(friendlyError(err), 'bad'); }
  });
}

boot();
