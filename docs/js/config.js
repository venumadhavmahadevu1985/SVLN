// Which copy of the site is running. The stage branch is published under /stage/ and is
// also what you get on localhost, so tests never touch the real (prod) accounts.
export const ENV = /\/stage(\/|$)/.test(location.pathname) || ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'stage' : 'prod';

// Paste each Firebase web app config here to switch from demo mode (browser-only data)
// to live mode (shared data, sign-in, roles). Use two separate Firebase projects so stage
// testing never changes real data. See README.md → "Demo mode vs live mode".
const firebaseConfigs = {
  prod: null,
  stage: null,
  // prod: {
  //   apiKey: "…",
  //   authDomain: "svln-paradise.firebaseapp.com",
  //   projectId: "svln-paradise",
  //   storageBucket: "svln-paradise.appspot.com",
  //   messagingSenderId: "…",
  //   appId: "…",
  // },
};
export const firebaseConfig = firebaseConfigs[ENV];

export const DEFAULT_SETTINGS = {
  name: 'SVLN Paradise',
  address: '1-1, Sample Colony, Visakhapatnam',
  treasurer: 'Treasurer',
  billing: 'fixed',        // 'fixed' = same amount for every flat, 'sqft' = rate × flat area
  fixedAmount: 1000,
  ratePerSqft: 1,
  dueDay: 10,              // maintenance is due by this day of each month
  fyStartMonth: 4,         // Indian financial year: April–March
  openingBalance: 3969,    // balance brought forward from September 2026
  startMonth: '2026-10',   // first month tracked in this app (YYYY-MM)
  payNote: 'Pay by UPI or cash to the treasurer and share the payment screenshot in the WhatsApp group.',
};

export const CATEGORIES = [
  'Watchman / Security',
  'Electricity (common areas)',
  'Water (municipal / tanker)',
  'GVMC charges',
  'Housekeeping / Cleaning',
  'Lift maintenance',
  'Plumbing & motor',
  'Electrical repairs',
  'Festival / Mamullu',
  'Gardening',
  'Pest control',
  'Painting / Civil work',
  'Admin / Stationery',
  'Miscellaneous',
];

export const PAYMENT_MODES = ['UPI', 'Cash', 'Bank transfer', 'Cheque'];

export const VENDOR_PERIODS = ['Monthly', 'Quarterly', 'Yearly', 'Per visit', 'On call'];
