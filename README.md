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
- **Expenses:** add, edit and delete expenses with a receipt photo or PDF. Filter, search, sort, and export to CSV.
- **Dues:** a flats × months grid of who has paid, a pending list with Copy and WhatsApp reminders, and maintenance amount settings.
- **My flat (residents):** dues history, plus the flat's own details, which are private to that flat and the admin.
  Each owner fills in their own details in a 4-step form with a live "% complete". Entering **Family members = N** shows N rows (Name, Relation, Age, optional Mobile), saved as `family` on the flat's private details.
- **Profile completeness:** each flat gets a score calculated from its details (never stored).
  - **Residents** see a progress bar, what's still needed, and **Complete now** on Home and My flat.
  - **The treasurer** sees "Flat details: N of 8 complete" on Home, a **Profile** column and a **Show incomplete only** filter in Dues → Flats & amount, and **Remind** / **Copy reminders** for WhatsApp messages listing what each flat is missing.
  - **Required:** owner name, who lives here, mobile, family members, vehicles (or "No vehicles", saved as `None`, so no new field and no rules change), and an emergency contact. Rented flats also need the tenant name; vacant flats need only owner name and mobile.
- **Reports:** a monthly statement in the notebook format (receipts, balance brought forward, itemised expenditure, balance carried forward) and an annual summary. Both print to PDF.
- **Staff:** watchman and other staff with mobile, working hours and duties (visible to every flat). The admin taps **Pay salary** to record the month's salary (with bonus or advance), which adds the expense and creates a **pay slip** to send on WhatsApp, copy or print.
- **Vendors** with AMC renewal alerts, **Notices**, and an **activity log** of every change.
- **Busy buttons:** any button that waits on the database (Save, Delete, Approve, Save payment, Pay salary, Import, Sign in…) shows a spinner and is disabled until it finishes, so double taps can't save twice.
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
| `meta/settings` | name, address, treasurer, billing, fixedAmount, ratePerSqft, dueDay, fyStartMonth, openingBalance, startMonth, payNote, categories[], paymentModes[] |
| `meta/collections` | basis: 'dues-month', byMonth { 'YYYY-MM': total paid towards that month's dues } |
| `flats/{flatNo}` | owner, sqft, override |
| `flatProfiles/{flatNo}` | occupancy, residentName, phone, altPhone, email, members, family[] {name, relation, age, phone} (max 20), vehicles, emergencyName, emergencyPhone (private) |
| `expenses/{id}` | date, category, description, vendor, amount, mode, paidBy, receipt {name, url, path}; salary payments also have `payslip` {staffId, month, salary, extra, deductions, note, name, role, phone, duties[]} |
| `payments/{id}` | flatId, month, amount, paidOn, mode, ref |
| `vendors/{id}` | name, service, phone, contractAmount, period, amcRenewal, notes. Staff are vendors with `kind: 'staff'` plus role, salary, shift, joinedOn, duties[], category, payMode, upi |
| `notices/{id}` | title, body, date, pinned |
| `users/{uid}` | email, name, phone, role (pending / resident / admin), flatId, requestedFlat |
| `auditLog/{id}` | at, by, byName, action, entity, entityId, summary (append-only) |

## Branches: stage and prod

| Branch | Website | Firebase project |
|---|---|---|
| `prod` | `/SVLN/` | `firebaseConfigs.prod` |
| `stage` | `/SVLN/stage/` (blue STAGE badge) | `firebaseConfigs.stage` |

### Release rule: prod only on approval

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

## Run locally

```bash
python -m http.server 5600 --directory docs
```
Localhost counts as **stage**, so it uses the stage Firebase project.
