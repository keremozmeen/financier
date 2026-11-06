# PLAN.md — Financier build plan

The phased plan for building Financier. `CLAUDE.md` holds the rules every phase follows; `DECISIONS.md` holds the architecture decisions the phases refer to.

Phases run in this order: 0, 1, 2, 3, 4, 4.5, **C**, **S**, 5, 6, 7, 8. Phase C (categories) and Phase S (security) come before Kipp because Kipp's insights read categories and run on data that Phase S protects.

Work phase by phase. Finish each phase with passing checks and a pull request (or commit) titled after the phase, then summarize what was built and what is next. Do not start a later phase's features early.

Every commit message names the phase it comes from with a line `From PLAN.md: Phase N — <name>` (see `CLAUDE.md`, "Commits and pull requests").

## Phase 0 — Foundation
- Scaffold Vite + React + TypeScript (strict), Tailwind v4, ESLint, Prettier, Vitest.
- Folder structure from `WORKFLOWS.md`, plus `src/i18n/`, `src/platform/`, `src/core/insights/`, `src/core/kipp/`, `src/parsers/common/`.
- CSP meta tag, self-hosted font, dark theme tokens (light theme toggle), hash router, app shell with bottom tab navigation: Dashboard, Cards, Import, Sub-Radar, Settings.
- `vite-plugin-pwa`: manifest (name, icons, theme color), offline precache, update prompt.
- i18n module with `en`/`tr` and locale detection.
- GitHub Actions: lint, test, build, zero-cloud source check, deploy to GitHub Pages (`base: '/financier/'`).

## Phase 1 — Data layer and cards
- Dexie schema v1 from the data model in `DECISIONS.md`; repositories; `navigator.storage.persist()`.
- Money and date utilities with tests (formatting per locale, installment split with remainder on the first installment).
- Cards CRUD screen; manual transaction entry with optional installment count.
- Card limit gauges (SVG) on the dashboard: limit, used, available, utilization color.

## Phase 2 — Finance core and cash flow
- Statements and bill payments per `DECISIONS.md` D14: computed statements, upcoming payments with "Mark as paid", full vs. partial payment effect on used and installments, weekend due-date shift.
- `core/finance`: available limit, utilization, total debt, statement period for a date, due-date calculation, installment schedule, 3/6/12-month liability projection, fixed vs. variable monthly spend.
- Dashboard: cash-flow bar chart (Recharts) with 3/6/12 toggle, upcoming payments list, recent activity.
- Due-soon banner, app badge, and `.ics` calendar export for due dates.
- Debit: liabilities, statements, payments and due dates are credit-only; debit counts in spending and recent activity.

## Phase 3 — CSV import
- Import screen with file picker and drag-and-drop.
- PapaParse parsing, Turkish number/date utilities, column-mapping wizard, saved import profiles matched by header signature.
- Review screen (edit/drop rows, confidence flags), fingerprint deduplication, import history with undo.
- Debit: an import is assigned to one card of either type; installment columns are ignored for debit cards.

## Phase 4 — Sub-Radar
- `core/subscriptions`: merchant normalization, recurring detection (cadence 28–31 days, also weekly and yearly), price-hike detection, duplicate-charge detection.
- Sub-Radar tab: active subscriptions, monthly/yearly cost, red alert for price hikes, confirm/ignore/mark cancelled.
- Debit: subscriptions are detected across credit and debit cards.

## Phase 4.5 — Design pass
- Apply `DECISIONS.md` D20 to the dashboard, cards, card setup and the import review screen, with a "Detailed view" setting (off by default) that brings back the full sections.
- New look per D21: layout, type, colors (light and charcoal dark) and bank marks on cards.
- Dashboard leads with what is due in the next 30 days; no separate due-soon panel.
- Card setup asks for name, type and (credit) limit; statement and due days come from the first import when the file has them.
- Import review opens on the rows needing a look.

## Phase C — Categories
- `core/categories` per `DECISIONS.md` D22: the category list with subcategories, the brand list, keywords and the order of evidence, all pure and tested. The merchant key and display name from D19 move to one shared module for Sub-Radar and categories.
- Dexie schema v5: the `merchantRules` table; `transactions.category` keeps the user's pick for one entry (`uncategorized` means none).
- A category chip on entry rows, the category list on tap, and "Apply to all entries from <merchant>?" that stores a rule; rules listed and removable in Settings (detailed view).
- The import review shows each row's category and lets **Change** set it, without adding rows to "need a look".
- Dashboard: one "Where your money went" line with the month's top three categories, opening a breakdown; the detailed view adds subcategories and a month-by-month comparison.
- Debit: categories cover credit and debit cards alike; limits, statements and bills are untouched.

## Phase S — Security and trust
- A spike first: the encryption-at-rest scheme for D23 (which fields stay readable for indexes, cost on a large database, WebAuthn PRF support on iOS). Record the result in D23 before building.
- App lock: 6-digit passcode, optional Face ID / Touch ID (WebAuthn platform authenticator), auto-lock after time in the background, lock screen without numbers. Offered on the first run with "Turn on" highlighted.
- Encryption at rest when the lock is on, per the spike; a forgotten passcode cannot be recovered and turning the lock on offers a backup first.
- Privacy screen in the app switcher and a "Hide amounts" switch.
- First run: what the app does, the privacy promise, the in-app privacy notice (KVKK) and terms in Turkish and English, then the app lock offer.
- Permissions asked only when needed, each after one plain sentence explaining why; Settings → Privacy & permissions lists what is granted, what is stored and the storage used.
- Moved here from Phase 7: encrypted export and restore (D6, replace or merge), Clear All Data with confirmation, and the privacy explanation (D8). A readable CSV export that escapes formula characters.
- Hardening: Trusted Types in the CSP, a 10 MB cap on imported files, `npm audit` in CI, `SECURITY.md`.
- Debit: backup, restore, export and encryption include every card of both types.

## Phase 5 — Kipp
- `core/insights`: the rules listed in `DECISIONS.md` D4, ranked by severity, each with its numbers and a suggested action.
- `core/kipp`: Turkish/English intent parser with fuzzy card-name matching; answers built from `core/finance` functions.
- Kipp mascot component (SVG) whose color and mood reflect overall health; insight cards on the dashboard; chat bar with suggested questions.
- Debit: Kipp's limit, utilization and debt insights are credit-only; spending and subscription insights cover both; the parser understands "banka kartı" / "debit card".

## Phase 6 — PDF and screenshot import
- `pdfjs-dist` with a locally bundled worker; password prompt for protected PDFs.
- Generic heuristic adapter, then bank adapters one at a time (Garanti BBVA, Yapı Kredi, İş Bankası, Akbank, QNB, Enpara). Each adapter needs an anonymized sample fixture and tests. Ask Kerem for samples before writing an adapter; never commit real statements.
- Screenshot import per `DECISIONS.md` D24: **Paste text** first (text copied from a screenshot with the phone's Live Text, read by the existing parsers), then **Choose screenshot** with on-device OCR. Rows go through the same review, deduplication and categories as every import.
- Screenshot test imports: synthetic screenshots of bank app lists (made-up values, rendered in code or drawn for the test) as fixtures for the OCR and line-reading tests, plus matching files in `synthetic/` for manual tests. Real screenshots are used only locally for diagnosis and never committed.
- Debit and credit: screenshots of either card type import the same way; installment markers are read only for credit cards.

## Phase 7 — Settings and polish
- Encrypted backup, Clear All Data and the privacy explanation moved to Phase S.
- Settings: language, theme, monthly income, primary currency, storage persistence status.
- Kipp joins the first run from Phase S; empty states, accessibility pass (contrast, labels, touch targets ≥ 44px), Lighthouse PWA check.

## Phase 8 — Final UI polish
- After every functional phase is in: a last pass over every screen with tester feedback (spacing, motion, empty and loading states, copy, icons, bank logos), in light and dark, at phone and desktop widths.
- Only presentation changes: no new features or data model changes. Anything functional that comes up goes back to the owning phase's module.
