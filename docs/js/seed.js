// Starting data: the October 2026 maintenance page from the society notebook.
// Receipts ₹1,000 × 8 flats, balance ₹3,969 brought forward from September,
// expenditure ₹8,010, balance ₹3,959 carried into November.
import { DEFAULT_SETTINGS } from './config.js';

export function buildSeed() {
  const now = new Date().toISOString(), by = 'Notebook (Oct 2026)';
  const db = { flats: {}, flatProfiles: {}, expenses: {}, payments: {}, vendors: {}, notices: {}, meta: {}, auditLog: {} };
  const settings = { ...DEFAULT_SETTINGS, id: 'settings' };
  db.meta.settings = settings;

  // 4 floors × 2 flats per floor. Add owner names and areas in Dues → Flats & amount.
  ['101', '102', '201', '202', '301', '302', '401', '402'].forEach(id => {
    db.flats[id] = { id, owner: '', sqft: 0 };
  });

  // The notebook has no individual dates, so everything is dated the last day of October.
  const oct = '2026-10-31';
  [
    ['Watchman / Security', 'Watchman salary – October', 4000, 'Watchman', 'Cash'],
    ['Electricity (common areas)', 'Electricity bill – common areas', 1565, 'APEPDCL', 'UPI'],
    ['GVMC charges', 'GVMC charges', 200, 'GVMC', 'Cash'],
    ['Housekeeping / Cleaning', 'Brooms', 200, '', 'Cash'],
    ['Water (municipal / tanker)', 'Municipal water', 645, 'GVMC water supply', 'Cash'],
    ['Festival / Mamullu', 'Dasara mamullu – GVMC staff', 500, 'GVMC', 'Cash'],
    ['Festival / Mamullu', 'Dasara mamullu – electricity staff', 500, 'APEPDCL', 'Cash'],
    ['Festival / Mamullu', 'Dasara mamullu – water supply staff', 200, 'GVMC water supply', 'Cash'],
    ['Festival / Mamullu', 'Dasara mamullu – lift technician', 200, '', 'Cash'],
  ].forEach(([category, description, amount, vendor, mode], i) => {
    const id = 'e' + (i + 1);
    db.expenses[id] = { id, date: oct, category, description, amount, vendor, mode, paidBy: settings.treasurer, createdAt: now, createdBy: by, seq: i };
  });

  // Receipts @ ₹1,000 × 8 — the notebook doesn't record payment dates.
  Object.keys(db.flats).forEach((flatId, i) => {
    const id = 'p' + (i + 1);
    db.payments[id] = { id, flatId, month: '2026-10', amount: 1000, paidOn: '2026-10-10', mode: 'Cash', ref: '', createdAt: now, createdBy: by };
  });
  db.meta.collections = { id: 'collections', byMonth: { '2026-10': 8000 } };

  [
    ['Watchman', 'Watchman / Security', '', 4000, 'Monthly'],
    ['APEPDCL', 'Common area electricity', '', 0, 'Monthly'],
    ['GVMC', 'Garbage collection & municipal charges', '', 0, 'Monthly'],
    ['GVMC water supply', 'Municipal water', '', 0, 'Monthly'],
  ].forEach(([name, service, phone, contractAmount, period], i) => {
    const id = 'v' + (i + 1);
    db.vendors[id] = { id, name, service, phone, contractAmount, period, amcRenewal: '', createdAt: now };
  });

  db.notices.n1 = {
    id: 'n1', date: '2026-10-31', pinned: true, createdAt: now,
    title: 'November 2026 maintenance',
    body: 'Maintenance for November is ₹1,000 per flat. The October balance of ₹3,959 has been carried forward to November.',
  };

  db.auditLog.a1 = { id: 'a1', at: now, by: 'system', byName: 'System', action: 'create', entity: 'all', entityId: '', summary: 'October 2026 notebook entries loaded' };
  return db;
}
