// Every value shown on screen (society name, flats, amounts, categories, expenses…) is read from
// Firestore. The code only holds layout and wording, never society data.
import { ENV } from './config.js';
import { store } from './store.js';
import { barChart, donutChart } from './charts.js';
import {
  esc, money, todayISO, curMonth, addMonths, monthsBetween, monthLabel, monthShort, dateLabel, dateTimeLabel,
  fyStart, fyLabel, daysUntil, pad, lastDay, trunc, ordinal,
} from './util.js';

// Technical fallbacks for settings fields that may be missing (not society data).
const FALLBACK = { billing: 'fixed', fixedAmount: 0, ratePerSqft: 0, dueDay: 10, fyStartMonth: 4, openingBalance: 0, categories: [], paymentModes: [] };

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
  },
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
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + kind;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = ''), 3200);
}

// Firebase errors arrive as "Firebase: Error (auth/…)"; show residents something they can act on.
const AUTH_MESSAGES = {
  'auth/email-already-in-use': 'An account with this email already exists. Use Sign in instead.',
  'auth/invalid-credential': 'Email or password is wrong. New here? Use Create account.',
  'auth/invalid-login-credentials': 'Email or password is wrong. New here? Use Create account.',
  'auth/wrong-password': 'Wrong password. Try again.',
  'auth/user-not-found': 'No account with this email. Use Create account.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'That email address doesn\'t look right.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
  'auth/popup-blocked': 'The browser blocked the Google sign-in window. Allow pop-ups and try again.',
  'auth/network-request-failed': 'No internet connection. Check your network and try again.',
  'auth/unauthorized-domain': 'This website address is not allowed to sign in yet. Please tell the treasurer.',
  'permission-denied': 'You don\'t have permission to do that.',
};
function friendlyError(err) {
  const code = err?.code || String(err?.message || '').match(/\(([^)]+)\)/)?.[1];
  return AUTH_MESSAGES[code] || err?.message || String(err);
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
function dueAmount(f) {
  if (Number(f.override) > 0) return Number(f.override);
  return S.settings.billing === 'sqft' ? Math.round((Number(f.sqft) || 0) * Number(S.settings.ratePerSqft)) : Number(S.settings.fixedAmount) || 0;
}
const paymentsFor = (flatId, mk) => S.db.payments.filter(p => p.flatId === flatId && p.month === mk);
function status(f, mk) {
  const due = dueAmount(f), paid = sum(paymentsFor(f.id, mk), p => p.amount);
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
  S.collections = meta.find(m => m.id === 'collections')?.byMonth || {};
  if (isAdmin()) {
    S.db.auditLog = (await store.list('auditLog')).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
    S.db.users = await store.list('users');
  }
}

async function audit(action, entity, entityId, summary) {
  await store.put('auditLog', { at: new Date().toISOString(), by: S.user.uid, byName: S.user.name, action, entity, entityId, summary });
}

// Collections per month (by date received) are kept in meta/collections so residents can see
// totals without being able to read other flats' payment records.
async function refreshCollectionTotals() {
  const byMonth = {};
  for (const p of await store.list('payments')) {
    const k = p.paidOn.slice(0, 7);
    byMonth[k] = (byMonth[k] || 0) + Number(p.amount);
  }
  await store.put('meta', { id: 'collections', byMonth, updatedAt: new Date().toISOString() });
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
    btn.disabled = true; err.hidden = true;
    try { await onSubmit(new FormData(form), form); closeModal(); }
    catch (ex) { console.error(ex); err.textContent = ex.message || String(ex); err.hidden = false; }
    finally { btn.disabled = false; }
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
  ['vendors', 'Vendors', 'tool'],
  ['notices', 'Notices', 'megaphone'],
  ['settings', 'Settings', 'gear', true],
];
const navItems = () => NAV.filter(n => !n[3] || isAdmin());

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
  $('#userBox').innerHTML = stagePill() + who + themeBtn();
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
  $('#userBox').innerHTML = stagePill() + (!S.user ? '' : store?.demo ? demoSwitcher() : '<button class="btn sm ghost" data-action="sign-out">Sign out</button>') + themeBtn();
  $view.innerHTML = html;
}

// ---------- routing ----------
const VIEWS = {
  dashboard: viewDashboard, expenses: viewExpenses, dues: viewDues, reports: viewReports,
  vendors: viewVendors, notices: viewNotices, settings: viewSettings,
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
  const fyExp = S.db.expenses.filter(e => e.date.slice(0, 7) >= fy);
  const donut = topCategories(fyExp);
  const recent = [...S.db.expenses].sort((a, b) => byExpenseOrder(b, a)).slice(0, 5);
  const pinned = S.db.notices.filter(n => n.pinned).sort((a, b) => b.date.localeCompare(a.date))[0];
  const prev = addMonths(cm, -1);
  const needsData = isAdmin() && !S.db.flats.length && !S.db.expenses.length;
  const waiting = isAdmin() ? S.db.users.filter(u => u.role === 'pending') : [];

  return `
    <div class="page-head"><div><h1>Overview</h1><p class="muted">${esc(monthLabel(cm, true))} · ${fyLabel(fy)}</p></div></div>
    ${store.demo ? `<div class="banner info">${icon('home')}<div><strong>Demo with sample data</strong>
      <span>Use “View as” at the top to switch between the treasurer and a resident. Try anything — changes are not saved and reset when you reload.</span></div></div>` : ''}
    ${waiting.length ? `<a class="banner warn" href="#/settings">${icon('home')}<div>
      <strong>${waiting.length} ${waiting.length === 1 ? 'person is' : 'people are'} waiting for approval</strong>
      <span>${waiting.map(u => esc(u.name || u.email) + (u.requestedFlat ? ` (Flat ${esc(u.requestedFlat)})` : '')).join(', ')} · approve in Settings → Members</span></div></a>` : ''}
    ${needsData ?`<a class="banner info" href="#/settings">${icon('upload')}<div><strong>No accounts yet</strong><span>Add flats under Dues → Flats & amount, or import a data file in Settings.</span></div></a>` : ''}
    ${pinned ? `<a class="banner notice" href="#/notices">${icon('megaphone')}<div><strong>${esc(pinned.title)}</strong><span>${esc(trunc(pinned.body, 140))}</span></div></a>` : ''}
    ${isAdmin() ? vendorAlerts() : ''}
    ${!isAdmin() && S.user.flatId ? myDuesBanner() : ''}
    ${!isAdmin() && flatById(S.user.flatId) && !S.db.flatProfiles[S.user.flatId] ? `<a class="banner info" href="#/dues">${icon('home')}<div>
      <strong>Add your flat's details</strong><span>Owner name, phone number and family details help the treasurer reach you.</span></div></a>` : ''}
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
        <div class="card-head"><h2>Where the money went</h2><span class="muted">${fyLabel(fy)}</span></div>
        ${donut.length ? donutChart(donut) : empty('No expenses recorded this year yet.')}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Recent expenses</h2><a href="#/expenses" class="link">See all</a></div>
      <div class="list">${recent.map(expenseRow).join('') || empty('No expenses yet.')}</div>
    </section>`;
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
      : '<p class="muted">No receipt attached.</p>'}`,
    {
      footer: isAdmin() ? `<button type="button" class="btn danger-ghost" data-action="delete-expense" data-id="${esc(e.id)}">Delete</button>
        <span class="spacer"></span><button type="button" class="btn primary" data-action="edit-expense" data-id="${esc(e.id)}">Edit</button>` : '',
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

const billingSummary = () => `${S.settings.billing === 'sqft' ? `₹${S.settings.ratePerSqft}/sq. ft.` : money(S.settings.fixedAmount) + ' per flat'} each month · due by the ${ordinal(S.settings.dueDay)}`;

function duesAdmin() {
  const tab = S.ui.duesTab;
  const tabs = [['grid', 'Who has paid'], ['pending', 'Pending dues'], ['flats', 'Flats & amount']];
  return `
    <div class="page-head"><div><h1>Maintenance dues</h1><p class="muted">${billingSummary()}</p></div></div>
    <div class="seg" role="tablist">${tabs.map(([id, l]) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? 'active' : ''}" data-action="dues-tab" data-tab="${id}">${l}</button>`).join('')}</div>
    ${tab === 'grid' ? duesGrid() : tab === 'pending' ? duesPending() : duesFlats()}`;
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
  const s = S.settings;
  return `
    <form class="card stack" data-form="billing">
      <h2>Monthly maintenance amount</h2>
      <div class="radio-row">
        <label><input type="radio" name="billing" value="fixed"${s.billing !== 'sqft' ? ' checked' : ''}> Same for every flat</label>
        <label><input type="radio" name="billing" value="sqft"${s.billing === 'sqft' ? ' checked' : ''}> By flat area (₹ per sq. ft.)</label>
      </div>
      <div class="form-grid three">
        <label class="field"><span>Amount per flat (₹)</span><input type="number" name="fixedAmount" min="0" step="1" value="${esc(s.fixedAmount)}"></label>
        <label class="field"><span>Rate per sq. ft. (₹)</span><input type="number" name="ratePerSqft" min="0" step="0.01" value="${esc(s.ratePerSqft)}"></label>
        <label class="field"><span>Due by day of month</span><input type="number" name="dueDay" min="1" max="28" value="${esc(s.dueDay)}"></label>
      </div>
      <div><button class="btn primary">Save amount</button></div>
    </form>
    <div class="card">
      <div class="card-head"><h2>Flats (${S.db.flats.length})</h2><button class="btn sm ghost" data-action="add-flat">${icon('plus')}<span>Add flat</span></button></div>
      ${S.db.flats.length ? `<div class="table-scroll"><table class="data">
        <thead><tr><th>Flat</th><th>Owner / resident</th><th>Contact</th><th class="num">Area (sq. ft.)</th><th class="num">Monthly</th><th></th></tr></thead>
        <tbody>${S.db.flats.map(f => { const p = S.db.flatProfiles[f.id]; return `<tr>
          <td><strong>${esc(f.id)}</strong></td>
          <td>${esc(f.owner) || '<span class="muted">Not set</span>'}${p?.occupancy === 'Tenant' && p.residentName ? `<br><small class="muted">Tenant: ${esc(p.residentName)}</small>` : p?.occupancy === 'Vacant' ? '<br><small class="muted">Vacant</small>' : ''}</td>
          <td>${p?.phone ? `<a href="tel:${esc(p.phone.replace(/\s/g, ''))}">${esc(p.phone)}</a>` : '<span class="muted">—</span>'}</td>
          <td class="num">${f.sqft || '—'}</td><td class="num">${money(dueAmount(f))}${Number(f.override) > 0 ? ' <small class="muted">custom</small>' : ''}</td>
          <td class="num"><div class="row-btns end"><button class="btn sm ghost" data-action="edit-profile" data-id="${esc(f.id)}">Details</button>
            <button class="btn sm ghost" data-action="edit-flat" data-id="${esc(f.id)}">Billing</button></div></td></tr>`; }).join('')}</tbody>
      </table></div>` : empty('No flats yet. Add each flat number.')}
    </div>`;
}

function duesResident() {
  const f = flatById(S.user.flatId);
  if (!f) return `<div class="page-head"><div><h1>My flat</h1></div></div><div class="card">${empty('Your account is not linked to a flat yet. Ask the treasurer to link it.')}</div>`;
  const o = outstanding(f);
  const months = billingMonths().slice().reverse();
  return `
    <div class="page-head"><div><h1>Flat ${esc(f.id)}</h1><p class="muted">${f.owner ? esc(f.owner) + ' · ' : ''}${money(dueAmount(f))} per month, due by the ${ordinal(S.settings.dueDay)}</p></div></div>
    ${flatDetailsCard(f)}
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

// wa.me needs the full international number; 10-digit Indian mobiles get +91.
function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length === 10 ? '91' + d : d.length >= 11 ? d : '';
}

function flatDetailsCard(f) {
  const p = S.db.flatProfiles[f.id];
  const item = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
  const tel = n => n ? `<a href="tel:${esc(n.replace(/\s/g, ''))}">${esc(n)}</a>` : '';
  return `<div class="card">
    <div class="card-head"><h2>Flat details</h2>
      <button class="btn sm ${p ? 'ghost' : 'primary'}" data-action="edit-profile" data-id="${esc(f.id)}">${p ? 'Edit details' : 'Add details'}</button></div>
    ${p ? `<dl class="details">
        ${item('Owner', esc(f.owner))}${item('Living here', esc(p.occupancy))}${item('Tenant', esc(p.residentName))}
        ${item('Mobile', tel(p.phone))}${item('Other phone', tel(p.altPhone))}${item('Email', esc(p.email))}
        ${item('Family members', p.members ? esc(p.members) : '')}${item('Vehicles', esc(p.vehicles))}
        ${item('Emergency contact', esc([p.emergencyName, p.emergencyPhone].filter(Boolean).join(' · ')))}
      </dl>
      <p class="hint">Updated ${p.updatedAt ? dateTimeLabel(p.updatedAt) : ''}${p.updatedBy ? ' by ' + esc(p.updatedBy) : ''}. Phone numbers are visible only to this flat and the treasurer.</p>`
      : '<p class="muted">No details yet. Add the owner name and a phone number so the treasurer can reach this flat.</p>'}
  </div>`;
}

function profileModal(flatId) {
  const f = flatById(flatId), p = S.db.flatProfiles[flatId] || {};
  const occ = ['Owner', 'Tenant', 'Vacant'];
  openModal(`Flat ${flatId} details`, `
    <p class="muted">Your name is shown to other residents. Phone numbers and other details are visible only to this flat and the treasurer.</p>
    <div class="form-grid">
      <label class="field span2"><span>Owner name</span><input name="owner" required maxlength="60" autocomplete="name" value="${esc(f.owner)}"></label>
      <label class="field"><span>Living here</span><select name="occupancy">${occ.map(o => `<option${o === (p.occupancy || 'Owner') ? ' selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="field"><span>Tenant name (if rented)</span><input name="residentName" maxlength="60" value="${esc(p.residentName || '')}"></label>
      <label class="field"><span>Mobile (WhatsApp)</span><input type="tel" name="phone" maxlength="20" inputmode="tel" autocomplete="tel" value="${esc(p.phone || '')}" placeholder="10-digit mobile number"></label>
      <label class="field"><span>Other phone</span><input type="tel" name="altPhone" maxlength="20" inputmode="tel" value="${esc(p.altPhone || '')}"></label>
      <label class="field"><span>Email</span><input type="email" name="email" maxlength="80" autocomplete="email" value="${esc(p.email || '')}"></label>
      <label class="field"><span>Family members</span><input type="number" name="members" min="0" max="20" value="${esc(p.members || '')}"></label>
      <label class="field span2"><span>Vehicles</span><input name="vehicles" maxlength="120" value="${esc(p.vehicles || '')}" placeholder="Registration numbers, e.g. car and bike"></label>
      <label class="field"><span>Emergency contact name</span><input name="emergencyName" maxlength="60" value="${esc(p.emergencyName || '')}"></label>
      <label class="field"><span>Emergency contact phone</span><input type="tel" name="emergencyPhone" maxlength="20" inputmode="tel" value="${esc(p.emergencyPhone || '')}"></label>
    </div>`, {
    onSubmit: async fd => {
      const owner = fd.get('owner').trim();
      if (owner !== (f.owner || '')) await save('flats', { ...f, owner }, `Flat ${flatId} owner name`);
      const doc = { ...p, id: flatId };
      for (const k of PROFILE_FIELDS) doc[k] = String(fd.get(k) || '').trim();
      doc.members = Number(doc.members) || 0;
      await save('flatProfiles', doc, `Flat ${flatId} details`);
      await refresh('Details saved');
    },
  });
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
    <div><img src="icon.svg" alt="" width="40" height="40"><div><h2>${esc(societyName())}</h2><p>${esc(S.settings.address || '')}</p></div></div>
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

  // "Receipts (@ ₹1,000 × 8)" when every payment received this month was the standard amount.
  const pays = isAdmin() ? S.db.payments.filter(p => p.paidOn.startsWith(mk)) : [];
  const uniform = pays.length && s.billing !== 'sqft' && pays.every(p => Number(p.amount) === Number(s.fixedAmount));
  const receiptsLabel = uniform ? `Receipts (@ ${money(s.fixedAmount)} × ${pays.length})` : 'Receipts (maintenance collected)';
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
          ${months.map(m => { const i = S.collections[m] || 0, o = spent[m] || 0; return `<tr><td>${monthLabel(m, true)}</td><td class="num">${money(i)}</td><td class="num">${money(o)}</td>
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
  const list = [...S.db.vendors].sort((a, b) => (a.amcRenewal || '9999').localeCompare(b.amcRenewal || '9999') || a.name.localeCompare(b.name));
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
  n ||= { date: todayISO() };
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
    <label class="field"><span>Payment modes (one per line)</span><textarea name="paymentModes" rows="6">${esc((s.paymentModes || []).join('\n'))}</textarea></label>`;
}

function societyPatch(fd) {
  const patch = {};
  for (const k of ['name', 'address', 'treasurer', 'startMonth', 'payNote']) patch[k] = String(fd.get(k) || '').trim();
  patch.openingBalance = Number(fd.get('openingBalance')) || 0;
  patch.fyStartMonth = Number(fd.get('fyStartMonth')) || FALLBACK.fyStartMonth;
  patch.categories = uniq(lines(fd.get('categories')));
  patch.paymentModes = uniq(lines(fd.get('paymentModes')));
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
    ${users.length ? `<div class="table-scroll"><table class="data">
      <thead><tr><th>Name</th><th>Role</th><th>Flat</th><th></th></tr></thead>
      <tbody>${users.map(u => `<tr data-uid="${esc(u.id)}">
        <td><strong>${esc(u.name || '')}</strong><br><small class="muted">${esc(u.email || '')}${u.phone ? ' · ' + esc(u.phone) : ''}</small>
          ${u.role === 'pending' && u.requestedFlat ? `<br><span class="badge warn">Asks for Flat ${esc(u.requestedFlat)}</span>` : ''}</td>
        <td><select class="select-sm" name="role">${roleOpts(u.role === 'pending' && u.requestedFlat ? 'resident' : u.role)}</select></td>
        <td><select class="select-sm" name="flatId">${flatOpts(u.flatId || u.requestedFlat)}</select></td>
        <td class="num"><button class="btn sm ${u.role === 'pending' ? 'primary' : 'ghost'}" data-action="save-member" data-id="${esc(u.id)}">${u.role === 'pending' ? 'Approve' : 'Save'}</button></td></tr>`).join('')}</tbody>
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
      <img src="icon.svg" alt="" width="64" height="64">
      <h1>Not connected yet</h1>
      <p>This ${ENV} copy of the site isn't connected to its Firebase database yet.</p>
      <p class="muted">Add the Firebase web app config for <strong>${ENV}</strong> in <code>docs/js/config.js</code>. See the README.</p>
    </section>`);
}

function renderLogin() {
  renderBare(`
    <section class="auth card">
      <img src="icon.svg" alt="" width="64" height="64">
      <h1>${esc(S.info?.name || 'Maintenance accounts')}</h1>
      ${S.info?.address ? `<p class="muted">${esc(S.info.address)}</p>` : ''}
      <p>${S.info ? 'Sign in to see the maintenance accounts.' : 'Sign in to set up your society\'s accounts.'}</p>
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
      <img src="icon.svg" alt="" width="64" height="64">
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
      <img src="icon.svg" alt="" width="64" height="64">
      <h1>Not set up yet</h1>
      <p>The treasurer hasn't finished setting up the accounts. Please check back later.</p>
    </section>`);
}

// ---------- event wiring ----------
const ACTIONS = {
  'close-modal': closeModal,
  theme() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    lsSet('svln-theme', root.dataset.theme);
  },
  more() {
    openModal('More', `<nav class="sheet">${navItems().slice(4).map(([id, label, ic]) =>
      `<a href="#/${id}" data-action="nav" class="${S.route === id ? 'active' : ''}">${icon(ic)}<span>${label}</span></a>`).join('')}</nav>`);
  },
  nav(ds, el) { closeModal(); location.hash = el.getAttribute('href'); },
  print() { window.print(); },
  'sign-out': () => store.signOut(),
  'login-google': () => store.signInGoogle(),

  'add-expense': () => openModal('Add expense', expenseForm(), { onSubmit: fd => submitExpense(fd) }),
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
    const dueDay = Math.min(Math.max(parseInt(fd.get('dueDay'), 10) || FALLBACK.dueDay, 1), 28);
    await saveSettings({ billing: fd.get('billing'), fixedAmount: Number(fd.get('fixedAmount')) || 0, ratePerSqft: Number(fd.get('ratePerSqft')) || 0, dueDay },
      'Maintenance amount updated');
    await refresh('Maintenance amount saved');
  },
  async settings(fd) {
    await saveSettings(societyPatch(fd), 'Society settings updated');
    await refresh('Settings saved');
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
  'demo-account': v => { S.ui.reportMonth = null; store.switchAccount(v); },
  async import(_, input) {
    const file = input.files[0];
    input.value = '';
    if (file) await importData(file);
  },
};

function bindEvents() {
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    try { await fn(el.dataset, el); }
    catch (err) { console.error(err); toast(friendlyError(err), 'bad'); }
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
    try { await CHANGES[t.dataset.change](t.value, t); }
    catch (err) { console.error(err); toast(friendlyError(err), 'bad'); }
  });
  document.addEventListener('submit', async e => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    // Read the form (including which button was pressed) before disabling that button:
    // disabled buttons are left out of FormData.
    const fd = new FormData(form, e.submitter);
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    try { await FORMS[form.dataset.form](fd, form); }
    catch (err) { console.error(err); toast(friendlyError(err), 'bad'); }
    finally { if (btn) btn.disabled = false; }
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
  bindEvents();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
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
