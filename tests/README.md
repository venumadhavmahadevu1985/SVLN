# Test suite

| Layer | Tool | Where | Runs |
|---|---|---|---|
| Unit | Playwright test runner (Node) | `tests/unit/` | locally + CI |
| End-to-end (desktop) | Playwright + Chromium | `tests/e2e/*.spec.ts` | locally + CI |
| End-to-end (phone) | Playwright, Pixel 7 profile | `tests/e2e/*.mobile.spec.ts` | locally + CI |
| Security rules | `@firebase/rules-unit-testing` + Firestore emulator | `tests/rules/` | CI (needs Java 11+) |

```bash
npm ci
```
```bash
npx playwright install chromium
```
```bash
npm test
```
```bash
npm run test:rules
```

`npm test` runs the unit, desktop and phone projects (144 tests, about 30 s). `npm run test:rules` starts the
Firestore emulator, so it needs Java. GitHub Actions runs both on every push and pull request, and
**the site is only published when every test passes** (`.github/workflows/pages.yml`).

## How the end-to-end tests work

- They run against the **demo build** (`/index.html?demo`): the real app code with the sample data from
  `docs/demo-data.json` held in memory. No Firebase account or network is needed, and nothing is saved.
- The clock is frozen at **5 Nov 2026, 10:00 IST** (`tests/fixtures.ts`). November dues are therefore *Due*
  (not yet overdue) and October is the last full month. Tests that need another date set it themselves.
- Starting data: October 2026 notebook page. 8 flats paid ₹1,000, ₹3,969 brought forward,
  9 expenses = ₹8,010, closing balance ₹3,959.
- `App` in `tests/fixtures.ts` holds the page helpers (open as treasurer or resident, add expense,
  record payment, read the statement…).

## Coverage

| Area | Spec | Cases |
|---|---|---|
| Date, money, FY and WhatsApp helpers; sign-in error messages | `unit/util.spec.ts` | month and year rollover, leap years, Apr–Mar FY, Indian digit grouping, ordinals 11–13, HTML escaping, `0`/`+91`/`00` phone prefixes |
| Dashboard | `e2e/dashboard.spec.ts` | KPIs, FY totals, notices, approval alert, charts, menu and routing, unknown route |
| Expenses | `e2e/expenses.spec.ts` | add / edit / delete, totals flow to dashboard and statement, new category, validation (0, negative, decimal, required), filters (month, category, vendor, search, combined, none), sorting, CSV export, read-only for residents |
| Dues | `e2e/dues.spec.ts` | grid states (paid, due, overdue, part-paid), record and remove payments, **late payment counts in its dues month (regression)**, overdue after the 10th, reminders and WhatsApp links, add or duplicate flat, custom amount, **amount change keeps past months (regression)**, billing by area with a zero-area warning, due-day range, resident view |
| Reports | `e2e/reports.spec.ts` | October statement matches the notebook line for line, carry-forward, November, print, resident view, annual summary with negative net |
| Staff and pay slips | `e2e/staff.spec.ts` | card details, Call/WhatsApp links, pay salary with bonus and advance, live net amount, slip contents, WhatsApp text, copy, print only the slip, duties on or off, duplicate-month warning, net ≤ ₹0 refused, salary expense opens its slip, slip history, commas in duties, staff not listed as vendors, delete keeps payments, resident view |
| SVLN app (PWA) | `e2e/pwa.spec.ts` | manifest name and icon sizes, iPhone home-screen tags, Android install prompt, Not now remembered, iPhone instructions, hidden when already installed |
| Notices and vendors | `e2e/notices-vendors.spec.ts` | post (pinned by default), unpinned, max 3 on Home, edit and delete, AMC renewing, expired and far-off, edit and delete vendor, resident restrictions |
| Members, settings, data | `e2e/settings-members.spec.ts` | approve, make admin, move back to pending, rename, opening balance, categories and payment modes, FY start, required fields, backup JSON, import, re-import is idempotent, invalid or broken files |
| Resident journey | `e2e/resident.spec.ts` | menu, blocked admin pages, own dues, update flat details (seen by admin), validation, role switch |
| Edge cases | `e2e/edge-cases.spec.ts` | XSS in every text field, ₹1 crore amounts, negative balance, overpayment, ₹0 payment refused, demo reset, theme persists, deep links, dialog cancel and backdrop, no console errors |
| Phone layout | `e2e/layout.mobile.spec.ts` | no sideways scroll on any page, grid scrolls in place, bottom bar and More, dialogs fit, resident bar |
| Who can do what | `rules/firestore.rules.test.mjs` | visitors, new sign-ups (first-admin bootstrap only on an empty database), pending, residents (own flat only: payments, details, owner name), admins (everything except rewriting the activity log) |

## Bugs the suite found (now fixed)

1. **Changing the maintenance amount rewrote history.** Raising ₹1,000 to ₹1,200 made October part-paid.
   Amounts now have an "Applies from" month, and earlier months keep their old amount.
2. **WhatsApp links broke for numbers typed with a leading 0** (`098480…`) or `0091…`.
3. **Billing by area silently charged ₹0** to flats with no area. There is now a warning listing them.
5. **The pay slip closed as soon as it opened.** A dialog closed itself after saving even when the save had opened the next dialog.
4. **Statement receipts ×7 instead of ×8** when a payment was entered after the month ended (found on the live site,
   now covered by a regression test).
