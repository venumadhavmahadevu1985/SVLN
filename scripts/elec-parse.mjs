// Reads Eastern Power's (APEPDCL) consumption-and-payment history page (the reply of getConAndPayDetails)
// into plain data. Used by the nightly job; kept separate so it can be tested with a saved page.
const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

// "02-NOV-26" → "2026-11-02"; "NOV-26" → "2026-11"
export function apDate(s) {
  const m = /^(\d{1,2})-([A-Z]{3})-(\d{2})$/i.exec(String(s).trim());
  return m && MONTHS[m[2].toUpperCase()] ? `20${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}` : '';
}
export function apMonth(s) {
  const m = /^([A-Z]{3})-(\d{2})$/i.exec(String(s).trim());
  return m && MONTHS[m[1].toUpperCase()] ? `20${m[2]}-${MONTHS[m[1].toUpperCase()]}` : '';
}
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const num = s => { const n = Number(String(s).replace(/[,\s₹]/g, '')); return Number.isFinite(n) ? n : 0; };

export function parseHistory(html) {
  const bills = [], payments = [];
  for (const row of String(html).split(/<tr\b/i).slice(1)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (cells.length < 4) continue;
    const c = cells.map(text);
    // Bill: Bill Date | Bill Month | Units | Amount (in an <input value=…>) | Due Date | E-Bill link
    if (apDate(c[0]) && apMonth(c[1])) {
      const amount = /value="([\d.,]+)"/i.exec(cells[3])?.[1] ?? c[3];
      const ebill = /href="(https:\/\/www\.apeasternpower\.com\/viewEbill\?id=[^"\s]+)/i.exec(cells[5] || '')?.[1] || '';
      bills.push({ billDate: apDate(c[0]), month: apMonth(c[1]), units: num(c[2]), amount: num(amount), dueDate: apDate(c[4] || ''), ebill });
      continue;
    }
    // Payment: Paid Date | Paid Amount | Receipt No | Source | Receipt
    if (apDate(c[0]) && /^[\d.,]+$/.test(c[1]) && c[2]) payments.push({ paidOn: apDate(c[0]), amount: num(c[1]), receiptNo: c[2], source: c[3] || '' });
  }
  return { bills, payments };
}

// Two years' pages merged: newest first, one entry per bill month / receipt.
export function mergeHistory(...parts) {
  const bills = new Map(), payments = new Map();
  for (const p of parts) {
    for (const b of p.bills) if (!bills.has(b.month)) bills.set(b.month, b);
    for (const x of p.payments) if (!payments.has(x.receiptNo + x.paidOn)) payments.set(x.receiptNo + x.paidOn, x);
  }
  return {
    bills: [...bills.values()].sort((a, b) => b.billDate.localeCompare(a.billDate)),
    payments: [...payments.values()].sort((a, b) => b.paidOn.localeCompare(a.paidOn)),
  };
}

// Eastern Power's years run April–March, written "2026-2027".
export function apYear(iso, back = 0) {
  const [y, m] = iso.split('-').map(Number), start = (m >= 4 ? y : y - 1) - back;
  return `${start}-${start + 1}`;
}
