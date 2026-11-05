# Apartment Maintenance

A mobile-friendly website where an apartment association shares its general maintenance collections and expenses.
Every flat signs in with its own account. The treasurer (admin) manages everything.

- **Prod (live):** https://venumadhavmahadevu1985.github.io/SVLN/
- **Stage (test):** https://venumadhavmahadevu1985.github.io/SVLN/stage/

**No society data is stored in the code.** The name, address, flats, amounts, categories, payment modes, expenses,
payments, vendors and notices all live in **Firebase Firestore**. They're entered through the site or imported from a
data file such as [`data/2026-10-notebook.json`](data/2026-10-notebook.json), which holds the October 2026 notebook page.

## Who can do what

| | Resident (each flat) | Admin (treasurer) |
|---|---|---|
| Sign in with own Google or email account | ✓ | ✓ |
| Dashboard, expenses, reports, vendors, notices | view | view + add / edit / delete |
| Own flat's dues and payment history | ✓ | all flats |
| Own flat's details (owner, phones, family, vehicles) | edit own | view / edit all |
| Record maintenance payments, set amounts | – | ✓ |
| Approve members, link them to flats, make admins | – | ✓ |
| Settings, activity log, backup / import | – | ✓ |

Firestore security rules ([`firestore.rules`](firestore.rules)) enforce this on the server, not just in the screens.
Residents can read payments only for their own flat. Monthly totals come from `meta/collections`.

## Features

- **Home:** balance in hand, collected and spent this month and this financial year, a chart of collections against spending, a breakdown by category, and recent expenses.
  - **Online now** at the top: who is using the app right now, with their flat. It updates live, and anyone not seen for 2½ minutes or who closed the app drops off. Each member keeps their own `presence/{uid}`, stamped with the server time.
  - **Where the money went** opens on the current month; a picker switches to an earlier month or the whole financial year.
- **Monthly bills quick links** (admins, on Home and Expenses): Watchman, Electricity Bill, GVMC and Municipal Water by default, with ✓ once added this month. Tapping one opens Add expense filled from the last such bill (amount, category, vendor, mode, with the month name updated). A staff member's role (Watchman) opens **Pay salary** instead. The list is editable under Settings → Society.
- **House tax (per flat):** each flat keeps its **assessment number**, the **taxpayer name** as on the GVMC bill, the **due amount** per instalment (shown as "Due amount" on the card and in reminders, pre-filled in Mark paid), a photo or PDF of the **tax bill**, and **paid** status for each half-yearly instalment (paid on, amount, receipt number).
  - **Settings → House tax** sets the two due dates and how many days before to remind (default 30). Reminders count from the month tracking started.
  - **Residents** see a reminder on Home (red once overdue) and a House tax card on My flat with **Mark paid**.
  - **Residents' Home reminder** has **Pay now** (copies the assessment number and opens the GVMC link), **Mark paid** and **Details**. While something is due, the House tax card is the first card on My flat.
  - **The treasurer** sees "N of 8 flats not marked paid" on Home and a **Dues → House tax** tab listing every flat, with Mark paid and a **WhatsApp reminder**. That is a courtesy message with the due date, assessment number, taxpayer, due amount, the GVMC pay link and a link to the flat's own page in the app.
  - **Penalty added by GVMC (₹)** is kept apart from the tax. My flat shows **Tax due**, **Penalty** (red) and **Total due** boxes; the treasurer's table has a **Penalty** column; reminders and WhatsApp list tax, penalty and total. Mark paid fills in the total and clears both.
  - **Pay online** copies the flat's assessment number and opens GVMC's payment page (BillDesk `GVMCDetails.jsp`), where the owner pastes it. That page can't be pre-filled from a link. After paying, the owner taps Mark paid. The link is `houseTaxPayUrl` in Settings → House tax (GVMC by default; empty hides the button).
  - Photos are shrunk to a JPEG and saved in `taxDocs/{flatNo}` (PDFs up to 650 KB), so no paid storage is needed.
- **Expenses:** add, edit and delete expenses with a receipt photo or PDF. Filter, search, sort, and export to CSV.
- **Dues:** a flats × months grid of who has paid, a pending list with Copy and WhatsApp reminders, and maintenance amount settings.
- **My flat (residents):** dues history, plus the flat's own details, which are private to that flat and the admin.
  Each owner fills in their own details in a 4-step form with a live "% complete". Entering **Family members = N** shows N rows (Name, Relation, Age, optional Mobile), saved as `family` on the flat's private details.
- **Profile completeness:** each flat gets a score calculated from its details (never stored).
  - **Residents** see a progress bar, what's still needed, and **Complete now** on Home and My flat.
  - **Logins:** each flat's card shows who signs in for it (signed in, waiting for approval, admin). Residents see only their own login.
  - **The treasurer** sees "Flat details: N of 8 complete" on Home, a **Profile** column and a **Show incomplete only** filter in Dues → Flats & amount, and **Remind** / **Copy reminders** for WhatsApp messages listing what each flat is missing.
  - **Required:** owner name, who lives here, mobile, family members, vehicles (or "No vehicles", saved as `None`, so no new field and no rules change), and an emergency contact. Rented flats also need the tenant name; vacant flats need only owner name and mobile.
- **Reports:** a monthly statement in the notebook format (receipts, balance brought forward, itemised expenditure, balance carried forward) and an annual summary. Both print to PDF.
- **Staff:** watchman and other staff with mobile, working hours and duties (visible to every flat). The admin taps **Pay salary** to record the month's salary (with bonus or advance), which adds the expense and creates a **pay slip** to send on WhatsApp, copy or print.
- **Vendors** with AMC renewal alerts, **Notices**, and an **activity log** of every change.
- **Electricity:**
  - **Each flat:** My flat has an **Electricity bill** card. The flat adds its APEPDCL **Service Number** (the Consumer No on the bill or receipt). **View / pay bill** copies the number and opens the Eastern Power bill page, where you paste it (in the installed app it opens in the app window).
  - **Until a flat adds it:** their Home shows *Add your electricity Service Number*. Dues → Electricity shows how many flats have added theirs, **Copy reminders** for the rest, and a WhatsApp button for each flat still missing it. The treasurer can also add a flat's number there.
  - **Current bill, paid / not paid, graph (nightly):** every night at 6:00 am a GitHub job (`.github/workflows/elec-bills.yml`, `scripts/fetch-elec-bills.mjs`) reads each Service Number's bills and payments from Eastern Power (`getConAndPayDetails`) and saves them in `elecBills`. My flat then shows:
    - the current bill: month, amount, units and due date, with **Paid** / **Due in N days** / **Overdue**;
    - **View this bill**, and **Pay now** while it is unpaid;
    - a 12-month units graph and the payments list.

    While unpaid, the flat gets a reminder banner on Home. The treasurer's Dues → Electricity shows every flat's current bill and status, with **Copy bill reminders** and a WhatsApp **Bill reminder** per unpaid flat. The common meter's bill and graph are shown too, and a Home banner appears when the common bill is unpaid within a week of its due date.
  - **Graphs (Reports → Electricity):** units or amount (₹) each month for the last 12 months, with total, monthly average, highest month, the same month a year ago, and a table of bills and payments. Every member sees the common meter; each flat sees its own; the treasurer can pick any flat or **All flats · compare** (latest bill of each flat). Until the nightly data exists, the common graph uses the electricity bills recorded in Expenses. My flat → **Electricity graphs** opens the flat's graph.
  - **Bill history:** **Bill history 2026-2027** (and last year) opens Eastern Power's PDF of that year's monthly units, bills and payments for the Service Number (a form post to `dwnConsPayPDF`; their years run April–March). The app cannot read Eastern Power's pages itself (they don't allow other sites to), so it opens them for you.
  - **Treasurer:** Dues → **Electricity** lists every flat's Service Number with View bill, the common-area meter(s), and recent common bills with meter reading and units.
  - **Settings → Electricity:** the common meter Service Number(s), one per line ("Common lights: 123456P012345678"), and the bill page link.
  - **Meter readings:** electricity bill expenses (category starting Electricity, Power or Current, or a description like "Power bill") take a **Meter reading** and **Units used**. Units are worked out from the previous reading when left empty, and a reading lower than the previous one is refused.
- **IT role:** full access, like an admin, including Usage and Settings. Give it in Settings → Members.
- **Daily backup:** only for members with the **IT** role. The first time they open the app each day, the full backup (JSON) is saved to that phone or computer automatically (Downloads), once per day. Settings → Data shows the last backup (when, by whom, automatic or not) and has a per-device switch to turn it off. The last backup is recorded in `meta/backup`. The demo keeps it off.
- **Split expenses:** one-off costs such as a borewell repair or painting, shared by the flats (Dues → Split expenses → **Split an expense**). Enter what it is for, the total and the category. Then split it equally, by flat area, or by typing each share (0 leaves a flat out); the shares must add up to the total. It can be paid at once or in **2–12 monthly instalments** from a first due date, and a flat may still pay the whole balance at once. Payments fill the earliest instalment first. One tick also adds the cost to Expenses. Each flat sees its share, the instalment schedule, what it has paid and how much the society has collected on My flat, with a banner on Home while anything is pending. The treasurer records payments, sees who has paid, and copies or sends WhatsApp reminders. Money received is counted in the balance and listed in the monthly statement as *Split expense collected: …*.
- **Costs paid by an owner:** if a flat owner paid for something for the building themselves, they tap **Send a cost** on My flat. They give what it was for, the amount, the date, optional details and an optional bill photo or PDF. The treasurer sees it on Home and at the top of Dues → Split expenses and can view the bill. **Approve & split** opens the split form already filled in, and the treasurer decides how it is shared: equally, by area, or by typed shares, with optional instalments. **Not approve** asks for a reason the owner can see. On approval:
  - the whole bill goes into Expenses as paid to that flat;
  - the owner's own share is recorded as paid, as an adjusted payment settled against their bill;
  - the other flats pay their shares as usual.

  So the fund pays the owner back the bill minus their share. The monthly statement shows the adjusted share on its own line, and the split-expense report says how the bill was settled. If the treasurer changes the owner's share later, the adjusted payment follows it. Deleting the split undoes everything: the request waits again, and the repayment and adjusted payment are removed. The repayment can't be deleted from Expenses on its own. An owner can withdraw a request while it is still waiting.
- **Reports → Split expenses:** one printable statement per split expense, showing:
  - what it was for and the date;
  - who paid the bill;
  - how it was shared and the instalments;
  - total cost, collected so far and still to collect;
  - each flat's share, paid, pending and status. Residents see only their own flat's row and the totals.
- **Individual alerts:** the treasurer taps **Alert** on a flat (Dues → Flats & amount, or the House tax table) to show a banner only to that flat, at the top of Home and My flat. It has an optional title, a message, a style (Information / Reminder / Urgent) and an optional **Show until** date. One tap fills in the house tax message, and it can be removed any time. The treasurer's Home lists which flats have an alert on. Stored in `flatAlerts/{flatNo}`; only admins write, and only that flat and admins read.
- **Usage (admins only):** a page showing visits, people, devices, installed-app use, most-tapped buttons, pages opened, recent visits and a per-person **click log** (Today, 7, 30 or 90 days). Every signed-in member's app opens go to `visits/` and taps to `clicks/` (sent in batches). Residents see a note that this is logged. **Clear entries older than 90 days** keeps it small.
- **Telugu (తెలుగు):** the **తె** button in the header switches the app to Telugu, and **EN** switches back. Each phone remembers its own choice.
  - Menus, buttons, labels, banners, dialogs and messages are translated (`docs/js/i18n.js`), and month names show in Telugu.
  - What people typed (names, descriptions, categories, notices) stays as typed. Saved data and WhatsApp messages stay in English.
  - Drop-down choices still save their English value, e.g. Owner / Tenant, or the member role.
- **Phones first:** every page and dialog is checked at 320–430 px wide. On phones, the Flats and Members tables turn into one card per flat or person.
- **Busy buttons:** any button that waits on the database (Save, Delete, Approve, Save payment, Pay salary, Import, Sign in…) shows the animated **S V L N** loading letters and is disabled until it finishes (the app also opens with a large S V L N loader), so double taps can't save twice.
- **SVLN phone app:** installs to the home screen as **SVLN**, with an icon styled on the building's name board (`docs/icons/`). Android shows an **Install** button; iPhone shows the Share → Add to Home Screen steps. Light and dark themes, building colours, and it works offline with the last data it loaded.

## First-time setup (per environment)

1. **Create a Firebase project.** Use one for prod (e.g. `svln-paradise`) and one for stage (e.g. `svln-paradise-stage`).
   - **Build → Authentication:** enable **Google** and **Email/Password**. Under *Settings → Authorized domains*, add `venumadhavmahadevu1985.github.io`.
   - **Build → Firestore Database:** create the database in production mode.
   - Optional, for receipt uploads: **Build → Storage**.
   - **Project settings → Your apps → Web:** register an app and copy the `firebaseConfig` object.
2. Paste the configs into [`docs/js/config.js`](docs/js/config.js) under `prod` and `stage`. These values identify the project and are not secrets.
3. Publish the security rules to each project:
   ```bash
   npm i -g firebase-tools
   ```
   ```bash
   firebase login
   ```
   ```bash
   firebase deploy --only firestore:rules,storage --project <project-id>
   ```
   You can also paste `firestore.rules` into *Firestore → Rules* in the console.
4. Open the site and sign in. **The first person to sign in on an empty database becomes the admin** and sees
   *Set up your society*. Do this straight after deploying.
5. In **Settings → Data → Import data file**, choose `data/2026-10-notebook.json` to load October 2026.
6. Share the link. Each resident signs in, enters their flat number, and you tap **Approve** in **Settings → Members**.

## Data model (Firestore)

| Collection | Fields |
|---|---|
| `public/info` | name, address (shown on the sign-in page) |
| `meta/settings` | name, address, treasurer, billing, fixedAmount, ratePerSqft, dueDay, fyStartMonth, openingBalance, startMonth, payNote, categories[], paymentModes[], quickExpenses[], houseTaxDue[] {label, month, day}, houseTaxRemindDays, houseTaxPayUrl, commonElec (lines "Label: Service Number"), elecBillUrl |
| `meta/collections` | basis: 'dues-month', byMonth { 'YYYY-MM': total paid towards that month's dues }, special { 'YYYY-MM': { levyId: split-expense money received that month } } |
| `levies/{id}` | title, category, total, date, split (equal / area / custom), shares { flatNo: ₹ }, instalments (1–12), dueDate (first instalment), note, expenseId — split expenses; members read, admins write |
| `flats/{flatNo}` | owner, sqft, override |
| `flatProfiles/{flatNo}` | occupancy, residentName, phone, altPhone, email, members, family[] {name, relation, age, phone} (max 20), vehicles, emergencyName, emergencyPhone, taxAssessmentNo, taxOwnerName, taxAmount, taxPenalty, elecServiceNo, taxDoc {name, type, updatedAt}, taxPaid { 'YYYY-MM-DD' due date: {paidOn, amount, receiptNo, by} } (private) |
| `taxDocs/{flatNo}` | name, type, data (data URL under 1 MB) — the house tax bill (private, like flatProfiles) |
| `elecBills/{flatNo}` and `elecBills/common-{serviceNo}` | scno, label, flatId or common: true, bills[] {billDate, month, units, amount, dueDate, ebill}, payments[] {paidOn, amount, receiptNo, source}, fetchedAt — written only by the nightly job; a flat reads its own, members read the common meter, admins read all |
| `flatAlerts/{flatNo}` | title, text (≤500), tone (info / warn / bad), until, at, by |
| `visits/{id}` | uid, name, flatId, role, at, device, installed, lang, screen (members create their own; admins read/clear) |
| `clicks/{id}` | uid, name, flatId, role, at, events[] {t, route, label, action} (max 100 per batch; admins read/clear) |
| `presence/{uid}` | name, role, flatId, online, lastSeen (server time) — who is online now |
| `expenses/{id}` | date, category, description, vendor, amount, mode, paidBy, receipt {name, url, path}; electricity bills may have meterReading, units; salary payments also have `payslip` {staffId, month, salary, extra, deductions, note, name, role, phone, duties[]} |
| `claims/{id}` | flatId, uid, name, title, amount, date, note, hasBill, status (pending / approved / rejected), reason, levyId, at, decidedAt, decidedBy — costs paid by an owner; the flat creates (waiting only) and may withdraw while waiting, admins decide |
| `claimBills/{id}` | flatId, name, type, data (data URL under 1 MB) — the bill for a request (same id) |
| `payments/{id}` | flatId, month, amount, paidOn, mode, ref; a split-expense payment has `levyId` instead of `month`; the owner's adjusted share has `auto: true` (counted under `special[month]['<levyId>:adj']`) |
| `vendors/{id}` | name, service, phone, contractAmount, period, amcRenewal, notes. Staff are vendors with `kind: 'staff'` plus role, salary, shift, joinedOn, duties[], category, payMode, upi |
| `notices/{id}` | title, body, date, pinned |
| `users/{uid}` | email, name, phone, role (pending / resident / admin / it), flatId, requestedFlat |
| `auditLog/{id}` | at, by, byName, action, entity, entityId, summary (append-only) |

## Branches: stage and prod

| Branch | Website | Firebase project |
|---|---|---|
| `prod` | `/SVLN/` | `firebaseConfigs.prod` |
| `stage` | `/SVLN/stage/` (blue STAGE badge) | `firebaseConfigs.stage` |

### Release rule: prod only on approval

0. **Test everything before pushing anywhere.** Run the full suite (`npm test`: every use case, edge case and flow,
   on desktop and phone) and fix every failure *before* pushing to any branch. A versioned git hook enforces this:
   `.githooks/pre-push` syntax-checks the site, runs the whole Playwright suite (and the security-rules tests when
   Java is installed), and refuses the push if anything fails. Enable it once per clone with
   `git config core.hooksPath .githooks`. Never bypass it with `--no-verify`.
1. Every change goes to **`stage` first**. Push it, let CI pass, and check https://venumadhavmahadevu1985.github.io/SVLN/stage/.
2. **Nothing is merged or pushed to `prod` until the owner explicitly says "deploy to PROD".**
   Pushing to `prod` is what changes the live site that residents use.
3. After approval, merge the tested `stage` into `prod` with a **release merge commit** (`--no-ff`), push, and confirm
   `https://venumadhavmahadevu1985.github.io/SVLN/version.txt` shows the new prod commit. GitHub Pages caches for up to 10 minutes.

**Why a merge commit and not a fast-forward:** GitHub Pages ignores a deployment for a commit it has already
deployed. The stage push already deployed the stage commit, with the *old* prod inside it. If `prod` is fast-forwarded to
that same commit, prod's deployment is skipped and the live site keeps the old version. The release commit gives
prod a new commit, so its deployment always goes live.

To make it live (only after approval):
```bash
git switch prod
```
```bash
git merge --no-ff stage -m "Release to prod"
```
```bash
git push origin prod
```
```bash
git switch stage
```
Every push to either branch runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml), which publishes both sites.

## Electricity bills: one-time setup (nightly job)

The job needs a key for each Firebase project so it can save the bills. Do this once for **prod** (svln-paradise) and once for **stage** (svln-paradise-stage):

1. Open Firebase console, choose the project, then ⚙ **Project settings → Service accounts → Generate new private key**. A `.json` file downloads. Keep it private and don't share it.
2. On GitHub, open **SVLN → Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `FIREBASE_SA_PROD` for prod, or `FIREBASE_SA_STAGE` for stage.
   - Secret: paste the whole content of the `.json` file.
3. Run it once now: **Actions → Electricity bills (nightly) → Run workflow**. After that it runs every morning at 6:00 am.

A project without its secret is skipped. You can delete the downloaded `.json` file once it is saved in GitHub.

## Run locally

```bash
python -m http.server 5600 --directory docs
```
Localhost counts as **stage**, so it uses the stage Firebase project.
