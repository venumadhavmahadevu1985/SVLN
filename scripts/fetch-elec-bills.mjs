// Nightly job (GitHub Actions, .github/workflows/elec-bills.yml): reads every flat's electricity Service
// Number and the common meter(s) from the database, fetches their bills and payments from Eastern Power,
// and saves them in elecBills/{flatNo} and elecBills/common-{serviceNo}. Web pages cannot read Eastern
// Power's site themselves, so the app shows what this job saved.
// Needs FIREBASE_SA: the project's service-account key (JSON), stored as a GitHub secret.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { parseHistory, mergeHistory, apYear } from './elec-parse.mjs';

const URL = 'https://www.apeasternpower.com/getConAndPayDetails';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // India date

async function history(scno, year) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://www.apeasternpower.com/viewBillDetailsMain', 'User-Agent': 'Mozilla/5.0 (SVLN society app nightly bill check)' },
    body: new URLSearchParams({ ltscno: scno, year, catId: '', subCatId: '', load: '', phase: '' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseHistory(await res.text());
}

async function main() {
  const sa = process.env.FIREBASE_SA;
  if (!sa) { console.log('FIREBASE_SA is not set; nothing to do.'); return; }
  initializeApp({ credential: cert(JSON.parse(sa)) });
  const db = getFirestore();

  const targets = [];
  for (const d of (await db.collection('flatProfiles').get()).docs) {
    const no = String(d.get('elecServiceNo') || '').trim();
    if (no) targets.push({ id: d.id, scno: no, flatId: d.id, label: `Flat ${d.id}` });
  }
  const settings = (await db.doc('meta/settings').get()).data() || {};
  for (const line of String(settings.commonElec || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean)) {
    const i = line.lastIndexOf(':'), no = (i > 0 ? line.slice(i + 1) : line).trim(), label = i > 0 ? line.slice(0, i).trim() : 'Common meter';
    if (no) targets.push({ id: `common-${no.replace(/[^A-Za-z0-9-]/g, '')}`, scno: no, label, common: true });
  }
  console.log(`${targets.length} Service Number(s) to check.`);

  let ok = 0;
  for (const t of targets) {
    try {
      const thisYear = await history(t.scno, apYear(today));
      await sleep(1500);
      const h = mergeHistory(thisYear, await history(t.scno, apYear(today, 1)));
      await db.doc(`elecBills/${t.id}`).set({
        scno: t.scno, label: t.label, ...(t.flatId ? { flatId: t.flatId } : { common: true }),
        bills: h.bills.slice(0, 24), payments: h.payments.slice(0, 24), fetchedAt: new Date().toISOString(),
      });
      console.log(`${t.label}: ${h.bills.length} bills, ${h.payments.length} payments`);
      ok++;
    } catch (err) {
      console.error(`${t.label}: could not fetch (${err.message})`);
    }
    await sleep(2000);   // be gentle with Eastern Power's site
  }
  if (targets.length && !ok) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
