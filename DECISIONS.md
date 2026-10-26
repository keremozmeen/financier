# Architecture Decisions

This file records the decisions that turn the open questions in `WORKFLOWS.md` into a buildable plan. Each entry states the decision, the reasoning, and what it rules out. Change a decision only by editing this file, so the codebase and the docs never drift apart.

---

## D1. Storage: IndexedDB via Dexie

**Decision:** Use [Dexie](https://dexie.org) on top of IndexedDB, with `dexie-react-hooks` (`useLiveQuery`) for reactive reads. SQLite-Wasm is dropped.

**Why:** Dexie is small, works offline in every target browser, gives typed tables, indexes, transactions and versioned schema migrations, and its live queries make the UI update automatically when data changes. SQLite-Wasm adds roughly 1 MB of Wasm and has persistence quirks on iOS Safari for no benefit at this data size (a person's transactions fit comfortably in IndexedDB).

**Details:**
- On first launch call `navigator.storage.persist()` so the browser does not evict the database under storage pressure. Show the result in Settings ("Storage: protected / may be cleared by the browser").
- All schema changes go through Dexie `version(n).stores(...).upgrade(...)`. Never edit an existing version.
- The database lives behind a repository layer in `src/db/`. Components and hooks never call Dexie directly, which keeps a later Tauri/SQLite swap possible.

---

## D2. Money and dates

**Decision:** Store every amount as an **integer in minor units** (kuruş for TRY, cents for USD/EUR) together with an ISO 4217 currency code. Store dates as ISO `YYYY-MM-DD` strings.

**Why:** Floating-point money produces rounding errors in sums and installment splits. Date strings avoid timezone shifts when a statement date is stored and read back.

**Details:**
- Primary currency is **TRY**. Each card and transaction carries its own `currency` so foreign-currency charges are recorded faithfully. Totals are shown per currency; there is no automatic FX conversion (that would need a network call).
- Installment splitting: when a total does not divide evenly, the remainder kuruş go on the **first** installment, matching how Turkish banks bill.
- Formatting uses `Intl.NumberFormat` with the active locale (`1.234,56 ₺` in Turkish, `₺1,234.56` in English).

---

## D3. Statement import: CSV-first, then bank adapters for PDF

**Decision:** Build import in three layers, in this order:

1. **Manual entry** for cards, transactions and installments. Always available, and the fallback for anything a parser misses.
2. **CSV import with a column-mapping wizard.** The user maps columns (date, description, amount, installments) once; the mapping is saved as a named profile ("Garanti BBVA CSV") and reused automatically when a file with the same headers is imported.
3. **PDF import via bank adapters.** `pdfjs-dist` extracts positioned text locally; each supported bank gets a small adapter that turns that text into transactions. Start with the most common Turkish credit cards, one bank at a time, each developed against an anonymized sample statement:
   - Garanti BBVA (Bonus), Yapı Kredi (World), İş Bankası (Maximum), Akbank (Axess), QNB (CardFinans), Enpara.
   - A **generic heuristic adapter** (date + description + amount line detection) handles unknown banks, with lower confidence.

**Why:** Every bank formats statements differently, so no single PDF parser is reliable. CSV covers most banks quickly; adapters add precision where it matters. Turkish number formats (`1.234,56`), Turkish dates (`26.10.2026`), and installment markers (`3/6`, `Taksit 3/6`) are parsed by shared utilities in `src/parsers/common/`.

**Rules that apply to every import path:**
- Nothing is saved until the user confirms the **review screen**, which shows each parsed row with a confidence flag and lets the user edit or drop it.
- **Duplicate protection:** each transaction gets a fingerprint (`cardId + date + amount + normalized description`); re-importing the same statement does not create duplicates.
- The PDF.js worker is **bundled locally** (no CDN), and password-protected PDFs prompt for the password locally.
- Itemized receipt splitting (Module 2's invoice feature) is **deferred to after v1**. It is a large feature and not needed for the core value.

---

## D4. Kipp's intelligence: a local insight engine, not a cloud LLM

**Decision:** Kipp is powered by two deterministic, on-device components:

1. **Insight engine** (`src/core/insights/`): a set of rules that run over the user's data and produce ranked, explainable insights about financial responsibility. Each insight has a severity (`info`, `warn`, `alert`), a message, the numbers behind it, and a suggested action. Initial rules:
   - **Card utilization** above 30% (warn) and 70% (alert), per card and overall.
   - **Installment burden:** next month's committed installments as a share of the user's stated monthly income (warn above 30%, alert above 50%). Income is an optional setting; without it, Kipp compares against the user's average monthly spend.
   - **Upcoming due dates** within 7 days, with the amount due.
   - **Subscription price hikes** and **possible duplicate charges** (from Sub-Radar).
   - **Installment cliff:** a month where several installment plans end at once (good news) or start at once (warning).
   - **Spending trend:** this month versus the 3-month average.
   - **Positive reinforcement:** utilization dropping, a plan fully paid off, no new installments this month.
2. **Query parser** (`src/core/kipp/`): an intent matcher for the chat bar that understands Turkish and English phrasing (keywords plus fuzzy card-name matching) and answers from the same calculation functions the dashboard uses. Supported intents in v1: available limit, total debt, installments for a given month, upcoming due dates, active subscriptions, price hikes, monthly spending, and "how am I doing?" (which returns the top insights). Unrecognized questions get a friendly reply listing what Kipp can answer.

**Why:** Financial answers must be numerically exact, and LLMs are unreliable at arithmetic. A rule engine is instant, works offline, adds almost nothing to bundle size, keeps every answer explainable ("because 4,200 ₺ of your 6,000 ₺ limit is used"), and keeps the Zero-Cloud promise without exceptions.

**Personality:** Kipp's mood (and color, since he is a chameleon) reflects overall financial health: green when things are healthy, yellow for warnings, red for alerts. Messages are short, warm, and never shaming.

**Later (post-v1, optional):** an opt-in on-device language model (for example WebLLM) could rephrase the engine's results more conversationally. Numbers would still come only from the engine. This is deferred because model downloads are multi-gigabyte and perform poorly on most phones.

---

## D5. Due-date reminders: in-app + calendar export

**Decision:** A PWA cannot reliably schedule notifications without a push server (iOS in particular), so v1 uses:
- **In-app reminders:** Kipp and a dashboard banner surface due dates within 7 days every time the app opens.
- **App icon badge** (Badging API, where supported) showing the number of due-soon payments.
- **Calendar export:** a button that generates a local `.ics` file with each card's monthly due date as a recurring event with a 3-day alarm. The phone's own calendar then delivers real reminders, fully offline, with no server.

**Later:** native scheduled notifications arrive with the Tauri v2 build.

---

## D6. Backup: passphrase-encrypted JSON

**Decision:** Export uses the Web Crypto API: **PBKDF2-SHA256 (600,000 iterations)** derives a key from the user's passphrase, and the database snapshot is encrypted with **AES-256-GCM** using a random salt and IV. The file is a `.json` envelope (`{ format, version, kdf, salt, iv, ciphertext }`).

**Rules:**
- The export screen states plainly that a forgotten passphrase cannot be recovered.
- Restore validates the format version and offers **replace** or **merge** (merge uses the duplicate fingerprints from D3).
- "Clear All Data" requires typing a confirmation word and offers a backup first.

---

## D7. Languages: Turkish and English from day one

**Decision:** Ship both languages in v1, defaulting to the browser locale with a switch in Settings. Use a small typed dictionary module (`src/i18n/`) rather than a full i18n framework; TypeScript enforces that every key exists in both languages.

**Why:** The target users bank in Turkey, while the code, docs and commits stay in English per `WORKFLOWS.md`. Adding i18n later means touching every component, so it is cheapest now.

---

## D8. Enforcing Zero-Cloud technically

The promise is enforced by the build, not just by convention:
- A **Content Security Policy** in `index.html` with `connect-src 'self'` (and `default-src 'self'`), so the browser blocks any outbound request to another origin, even from a dependency.
- No analytics, telemetry, error-reporting SDKs, remote fonts or CDN assets. Fonts are self-hosted.
- A **CI check** fails the build if source code contains `fetch(`/`XMLHttpRequest`/`navigator.sendBeacon` calls to non-relative URLs.
- A Settings → Privacy screen explains what is stored and where.

---

## D9. Application stack details

| Concern | Choice |
| :--- | :--- |
| Runtime | Node 20.19+ (Node 18 is end-of-life and not supported by current Vite) |
| Framework | React 18+ / Vite / TypeScript (`strict`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), dark mode default with a light theme option |
| Icons / motion | Lucide React / Motion (the current name of Framer Motion) |
| Charts | Recharts for the cash-flow bars; card gauges are hand-built SVG |
| Routing | React Router in **hash mode**, so deep links work on GitHub Pages without server rewrites |
| State | Dexie live queries for data; React state/context for UI. No Redux. |
| PWA | `vite-plugin-pwa` (Workbox), precached app shell, works fully offline, update prompt when a new version is deployed |
| Testing | Vitest for all `core/` and `parsers/` logic (target: every calculation and parser has tests); Testing Library for key components |
| Quality | ESLint + Prettier, enforced in CI |
| Commits | Conventional Commits in English (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) |

---

## D10. Deployment and native

- **Deploy to GitHub Pages** through a GitHub Actions workflow (lint, test, build, deploy on push to `main`). Vite `base` is set to `/financier/`. Vercel remains an option later but adds nothing for a static app.
- **Tauri v2 mobile is post-v1.** The code stays platform-agnostic (storage behind the repository layer, no browser-only APIs outside `src/platform/`) so the native wrapper can be added without a rewrite.

---

## Data model (v1)

| Table | Key fields |
| :--- | :--- |
| `cards` | `id`, `name`, `bank`, `last4`, `currency`, `limit`, `statementDay`, `dueDay`, `color`, `archived` |
| `transactions` | `id`, `cardId`, `date`, `description`, `normalizedMerchant`, `amount`, `currency`, `category`, `installmentPlanId?`, `fingerprint`, `source` (`manual` / `csv` / `pdf`), `importId?` |
| `installmentPlans` | `id`, `cardId`, `description`, `totalAmount`, `count`, `firstDueMonth`, `currency` |
| `statements` | `id`, `cardId`, `periodStart`, `periodEnd`, `dueDate`, `totalDue`, `minimumDue`, `paid` |
| `subscriptions` | `id`, `normalizedMerchant`, `cadenceDays`, `lastAmount`, `previousAmount`, `status` (`active` / `ignored` / `cancelled`), `confirmedByUser` |
| `importProfiles` | `id`, `name`, `bank`, `kind` (`csv` / `pdf`), `headerSignature`, `columnMap` |
| `imports` | `id`, `fileName`, `importedAt`, `rowCount`, `profileId?` (lets the user undo a whole import) |
| `settings` | key/value: `locale`, `theme`, `monthlyIncome?`, `primaryCurrency`, `onboardingDone` |

---

## Out of scope for v1

Itemized receipt splitting, bank account (non-card) balances, budgets per category, FX conversion, an on-device LLM, multi-device sync, and native notifications. Each is a candidate for a later phase once the core is solid.
