# CLAUDE.md — Instructions for building Financier

You are the developer of **Financier**, a mobile-first, 100% local, zero-cloud personal finance PWA with **Kipp the Chameleon** as its companion. The project owner (Kerem) makes product decisions; you make implementation decisions within the rules below and flag anything that would change product scope.

## Read first

1. `docs/DECISIONS.md` — the binding architecture decisions (storage, money, parsing, Kipp, backup, i18n, privacy, stack, data model). Follow them. If a decision turns out to be wrong in practice, stop and propose an edit to that file instead of silently deviating.
2. `WORKFLOWS.md` — product vision, modules and folder structure.
3. `USAGE.md` — the user-facing behavior the app must match.

## Non-negotiable rules

- **Zero-Cloud:** never add code or dependencies that send data off the device: no analytics, telemetry, error reporting, remote fonts, CDN assets or external API calls. The CSP in `index.html` (`connect-src 'self'`) must stay intact.
- **Money is integer minor units** with a currency code. Never use floats for amounts.
- **Business logic lives in `src/core/` and `src/parsers/` as pure, tested TypeScript** with no React or Dexie imports. Components stay thin.
- **Data access goes through `src/db/` repositories.** Components and hooks never call Dexie tables directly.
- **Every user-visible string goes through `src/i18n/`** with both `en` and `tr` entries.
- **Imports are never saved without the user's review**, and must be deduplicated by fingerprint.
- **English** for code, comments and commit messages (Conventional Commits).

## Commands

```bash
npm run dev        # start dev server
npm run build      # type-check and production build
npm run test       # vitest
npm run lint       # eslint
```

A task is done only when `lint`, `test` and `build` all pass. New logic in `core/` or `parsers/` needs tests in the same change.

## Build plan

Work phase by phase. Finish each phase with passing checks and a pull request (or commit) titled after the phase, then summarize what was built and what is next. Do not start a later phase's features early.

### Phase 0 — Foundation
- Scaffold Vite + React + TypeScript (strict), Tailwind v4, ESLint, Prettier, Vitest.
- Folder structure from `WORKFLOWS.md`, plus `src/i18n/`, `src/platform/`, `src/core/insights/`, `src/core/kipp/`, `src/parsers/common/`.
- CSP meta tag, self-hosted font, dark theme tokens (light theme toggle), hash router, app shell with bottom tab navigation: Dashboard, Cards, Import, Sub-Radar, Settings.
- `vite-plugin-pwa`: manifest (name, icons, theme color), offline precache, update prompt.
- i18n module with `en`/`tr` and locale detection.
- GitHub Actions: lint, test, build, zero-cloud source check, deploy to GitHub Pages (`base: '/financier/'`).

### Phase 1 — Data layer and cards
- Dexie schema v1 from the data model in `DECISIONS.md`; repositories; `navigator.storage.persist()`.
- Money and date utilities with tests (formatting per locale, installment split with remainder on the first installment).
- Cards CRUD screen; manual transaction entry with optional installment count.
- Card limit gauges (SVG) on the dashboard: limit, used, available, utilization color.

### Phase 2 — Finance core and cash flow
- `core/finance`: available limit, utilization, total debt, statement period for a date, due-date calculation, installment schedule, 3/6/12-month liability projection, fixed vs. variable monthly spend.
- Dashboard: cash-flow bar chart (Recharts) with 3/6/12 toggle, upcoming payments list, recent activity.
- Due-soon banner, app badge, and `.ics` calendar export for due dates.

### Phase 3 — CSV import
- Import screen with file picker and drag-and-drop.
- PapaParse parsing, Turkish number/date utilities, column-mapping wizard, saved import profiles matched by header signature.
- Review screen (edit/drop rows, confidence flags), fingerprint deduplication, import history with undo.

### Phase 4 — Sub-Radar
- `core/subscriptions`: merchant normalization, recurring detection (cadence 28–31 days, also weekly and yearly), price-hike detection, duplicate-charge detection.
- Sub-Radar tab: active subscriptions, monthly/yearly cost, red alert for price hikes, confirm/ignore/mark cancelled.

### Phase 5 — Kipp
- `core/insights`: the rules listed in `DECISIONS.md` D4, ranked by severity, each with its numbers and a suggested action.
- `core/kipp`: Turkish/English intent parser with fuzzy card-name matching; answers built from `core/finance` functions.
- Kipp mascot component (SVG) whose color and mood reflect overall health; insight cards on the dashboard; chat bar with suggested questions.

### Phase 6 — PDF import
- `pdfjs-dist` with a locally bundled worker; password prompt for protected PDFs.
- Generic heuristic adapter, then bank adapters one at a time (Garanti BBVA, Yapı Kredi, İş Bankası, Akbank, QNB, Enpara). Each adapter needs an anonymized sample fixture and tests. Ask Kerem for samples before writing an adapter; never commit real statements.

### Phase 7 — Backup, settings, polish
- Encrypted export/restore (PBKDF2 + AES-GCM, replace or merge), Clear All Data with confirmation.
- Settings: language, theme, monthly income, primary currency, storage persistence status, privacy explanation.
- First-run onboarding with Kipp, empty states, accessibility pass (contrast, labels, touch targets ≥ 44px), Lighthouse PWA check.

## Working style

- Prefer small, focused commits. Keep dependencies minimal and justify each new one.
- When something is ambiguous at the product level, ask Kerem; when it is purely technical, decide, and note the choice in the PR description.
- Test data must be synthetic. Never commit real financial data.
