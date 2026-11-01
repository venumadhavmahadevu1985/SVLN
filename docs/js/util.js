export const pad = n => String(n).padStart(2, '0');

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const money = n => inr.format(Math.round(Number(n) || 0));

export function moneyShort(n) {
  const a = Math.abs(n);
  if (a >= 1e7) return '₹' + +(n / 1e7).toFixed(1) + 'Cr';
  if (a >= 1e5) return '₹' + +(n / 1e5).toFixed(1) + 'L';
  if (a >= 1e3) return '₹' + +(n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  return '₹' + Math.round(n);
}

export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => iso(new Date());
export const curMonth = () => todayISO().slice(0, 7);
export const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
export const daysUntil = s => Math.round((new Date(s + 'T00:00') - new Date(todayISO() + 'T00:00')) / 864e5);

export function addMonths(mk, n) {
  let [y, m] = mk.split('-').map(Number);
  m += n;
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12 + 12) % 12 + 1;
  return `${y}-${pad(m)}`;
}

export function monthsBetween(a, b) {
  const out = [];
  for (let k = a; k <= b; k = addMonths(k, 1)) out.push(k);
  return out;
}

export const lastDay = mk => new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate();
const asDate = mk => new Date(mk + '-01T00:00');
export const monthLabel = (mk, long) =>
  asDate(mk).toLocaleDateString('en-IN', { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' });
export const monthShort = mk => asDate(mk).toLocaleDateString('en-IN', { month: 'short' });
export const dateLabel = s => s ? new Date(s + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const dateTimeLabel = s => new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function fyStart(mk, fyStartMonth = 4) {
  const [y, m] = mk.split('-').map(Number);
  return `${m >= fyStartMonth ? y : y - 1}-${pad(fyStartMonth)}`;
}
export function fyLabel(startMk) {
  const y = +startMk.slice(0, 4);
  return startMk.endsWith('-01') ? `FY ${y}` : `FY ${y}–${pad((y + 1) % 100)}`;
}

export const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const trunc = (s, n) => (s = String(s || '')).length > n ? s.slice(0, n - 1) + '…' : s;
