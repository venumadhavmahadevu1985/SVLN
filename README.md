# SVLN Paradise — Maintenance

A simple, mobile-friendly website for **SVLN Paradise** (1-1, Sample Colony, Visakhapatnam)
to share general maintenance collections and expenses with all 8 flats.

It starts with the **October 2026** page from the society notebook:

| | |
|---|---|
| Receipts (@ ₹1,000 × 8) | ₹8,000 |
| Balance from Sep '26 | ₹3,969 |
| **Total** | **₹11,969** |
| Expenditure (watchman, electricity, GVMC, brooms, municipal water, Dasara mamullu) | ₹8,010 |
| **Balance carried to Nov '26** | **₹3,959** |

## Features

- **Home**: balance in hand, collected and spent this month and this financial year, a chart of collections against spending, a breakdown of spending by category, and the most recent expenses.
- **Expenses**: add, edit or delete expenses, with a receipt photo or PDF. Filter by month, category or vendor, search, sort, and export to CSV for Excel.
- **Dues**: a flats × months grid showing who has paid, a pending list with **Copy** and **WhatsApp** reminder buttons, and settings for the monthly amount (fixed or per sq. ft.).
- **Reports**: a monthly statement laid out like the notebook page (receipts, balance brought forward, itemised expenditure, balance carried forward) and an annual summary. Both can be printed or saved as PDF.
- **My flat** (for residents): each flat signs in and keeps its own details up to date: owner name, owner or tenant, mobile/WhatsApp, email, family members, vehicles and an emergency contact. Other residents see only flat numbers and owner names. Phone numbers are visible only to that flat and the treasurer. WhatsApp reminders go straight to the saved mobile number.
- **Vendors**: contracts, phone numbers, and AMC renewal alerts for anything expiring within 30 days.
- **Notices**: announcements, with pinned notices shown on the home page.
- **Settings**: society details, member approval (live mode), an activity log, and JSON backup and restore.
- Installable on phones (PWA), light and dark themes, and colours taken from the building.

## Project layout

```
docs/                 ← the website (served by GitHub Pages / Firebase Hosting)
  index.html, styles.css, icon.svg, manifest.webmanifest, sw.js
  js/config.js        ← society defaults, categories, Firebase config
  js/app.js           ← pages and logic
  js/store.js         ← data layer (demo = browser storage, live = Firebase)
  js/seed.js          ← starting data (October 2026 notebook page)
  js/charts.js, js/util.js
firestore.rules       ← who can read/write what
storage.rules         ← receipt upload rules
firebase.json
```

No build step is needed. These are plain HTML, CSS and JavaScript modules.

## Run locally

```bash
python -m http.server 5600 --directory docs
```

Then open http://localhost:5600.

## Data model

| Collection | Fields |
|---|---|
| `flats/{flatNo}` | owner, sqft, override (custom monthly amount). Residents can change only `owner` on their own flat |
| `flatProfiles/{flatNo}` | occupancy, residentName, phone, altPhone, email, members, vehicles, emergencyName, emergencyPhone. Private: readable only by that flat and admins |
| `expenses/{id}` | date, category, description, vendor, amount, mode, paidBy, receipt {name, url, path} |
| `payments/{id}` | flatId, month (YYYY-MM the dues are for), amount, paidOn, mode, ref |
| `vendors/{id}` | name, service, phone, contractAmount, period, amcRenewal, notes |
| `notices/{id}` | title, body, date, pinned |
| `meta/settings` | name, address, treasurer, billing, fixedAmount, ratePerSqft, dueDay, fyStartMonth, openingBalance, startMonth, payNote |
| `meta/collections` | byMonth { 'YYYY-MM': total received } (lets residents see totals without other flats' payments) |
| `users/{uid}` | email, name, phone, role (pending / resident / admin), flatId, requestedFlat (set by the user while pending) |
| `auditLog/{id}` | at, by, byName, action, entity, entityId, summary (append-only) |

Every document also has createdAt/createdBy/updatedAt/updatedBy.

## Demo mode vs live mode

**Demo mode** (the default, `firebaseConfig = null`): data is saved only in the browser you use. Use the
"View as" menu at the top to switch between the treasurer and a resident. This is fine for trying things out,
but **residents opening the GitHub Pages link will only see the starting October data**, not your later entries.

**Live mode** shares one set of accounts with everyone:

1. Create a project at https://console.firebase.google.com (the free Spark plan is enough; receipt uploads
   need Cloud Storage, which may ask you to enable billing on newer projects).
2. Add a **Web app** and copy its config into `docs/js/config.js` as `firebaseConfig`.
3. In **Authentication**, turn on the **Google** and **Email/Password** sign-in methods, and add your
   GitHub Pages domain (`venumadhavmahadevu1985.github.io`) under *Authorized domains*.
4. Create the **Firestore** database and **Storage**, then publish the rules:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,storage
   ```
5. Sign in to the site once. In Firestore → `users/<your uid>`, change `role` from `pending` to `admin`.
6. Open **Settings**, check the society details, and enter the October 2026 data (or set *Tracking starts* to
   2026-11 with a balance brought forward of ₹3,959 and continue from November).
7. Share the site link in the building's WhatsApp group. Each resident signs in with Google or email and
   enters their flat number. In **Settings → Members**, their flat is already selected, so tap **Approve**.
   Several people from the same flat (for example a husband and wife) can each have their own login for that flat.
8. Once approved, residents open **My flat** to add their details. They can also see the accounts and their dues.

## Publish on GitHub Pages

1. Push this folder to https://github.com/venumadhavmahadevu1985/SVLN.
2. On GitHub, go to **Settings → Pages → Build and deployment**: *Deploy from a branch*, branch `main`, folder `/docs`.
3. The site will be at https://venumadhavmahadevu1985.github.io/SVLN/.
