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
2. **CSV import with automatic column mapping.** Financier finds the header row (skipping the bank's info rows above it), the columns (date, description, amount or a Borç/Alacak pair, installments, and for account statements Referans and İşlem Türü / İşlem) and the formats (decimal separator, date order, and whether charges are negative) on its own. It imports without asking when it is confident: the header row names known columns, the date, description and amount columns were found by their header names, and at least half of the rows read a date and an amount. Otherwise a short screen asks only for the columns, by the file's own header names, with the formats folded away unless the preview finds unreadable values. Either way the mapping is saved as a profile, without asking, and reused for the next file with the same headers. A profile keeps the columns and the sign; number and date formats are read from each file, because a bank's .xlsx and HTML .xls of the same statement write numbers differently (D18). The review screen shows how the file was read ("Columns: Date: İşlem Tarihi · …") with a way to change it.
3. **PDF import via bank adapters.** `pdfjs-dist` extracts positioned text locally; each supported bank gets a small adapter that turns that text into transactions. Start with the most common Turkish credit cards, one bank at a time, each developed against an anonymized sample statement:
   - Garanti BBVA (Bonus), Yapı Kredi (World), İş Bankası (Maximum), Akbank (Axess), QNB (CardFinans), Enpara.
   - A **generic heuristic adapter** (date + description + amount line detection) handles unknown banks, with lower confidence.

**Why:** Every bank formats statements differently, so no single PDF parser is reliable. CSV covers most banks quickly; adapters add precision where it matters. Turkish number formats (`1.234,56`), Turkish dates (`26.10.2026`), and installment markers (`3/6`, `Taksit 3/6`) are parsed by shared utilities in `src/parsers/common/`.

**Rules that apply to every import path:**
- Nothing is saved until the user confirms the **review screen**, which shows each parsed row with a confidence flag and lets the user edit or drop it.
- **Duplicate protection:** each transaction gets a fingerprint (`cardId + date + amount + normalized description`); re-importing the same statement does not create duplicates. Fingerprint dedup applies to imports only: manual entries are never deduplicated, so two identical dinners on the same card and day both save.
- **Imports vs. manual entries:** at import review (Phase 3), an imported charge that matches a manual entry (same card, same amount, date within ±3 days) is flagged "Already logged" and merged by default, taking the bank's description if the manual entry has none. The user can unmerge it on the review screen.
- **Manual descriptions are optional.** An entry without one is shown as "Charge", "Refund", "Income" or "Installment purchase" (from `src/i18n/`).
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

## D11. Card "used" amount and limit blocking

Turkish banks block the full value of an installment purchase against the card limit and release it as each installment is billed and paid. A 12,000 ₺ purchase in 6 installments blocks 12,000 ₺ on day one.

- used = unpaid single-payment charges + remaining unpaid balance of all installment plans
- available = limit − used, never negative. When used exceeds the limit, the card is treated as full; see D12. A credit balance adds to available (D15).
- utilization = used / limit, shown with the D4 colors: under 30% healthy, 30–70% warning, over 70% alert.

**Balance override:**
- The user can enter the card's current balance from their banking app, saved with the date it was entered ("as of" date).
- When an override exists: used = override balance + single charges dated after the as-of date + the full remaining value of installment plans created after the as-of date. Everything before the as-of date is assumed to be included in the override.
- Without an override, used is calculated from the recorded transactions alone.
- **Older statements count as paid:** statements that closed before the latest closed one are treated as paid, as overdue bills are in D14. Their single charges and the payments made for them are left out, and installments billed in them no longer block the limit; installments billed later still do. So used covers the latest closed statement, the open one and the unbilled installments. An imported year of history without payments would otherwise show a year of charges as debt. A bank balance override dated after the latest settled statement still applies; an older one is replaced by this rule.
- Updating the override (for example after paying the bill) replaces the previous one. Keep a history of past overrides so later phases can use it.
- The card screen shows whether used is "calculated" or "from your bank balance on <date>", and suggests updating it if the as-of date is more than 30 days old.

Payments and statements are tracked from Phase 2 on. Until then, the override is how the user reflects a paid bill.

**Implementation notes:**
- Refunds are transactions with a negative amount; they lower used. Installment plans are charges only.
- An installment purchase is stored as one `installmentPlans` row plus one transaction (the purchase, full amount, linked by `installmentPlanId`). Only the plan counts toward used, so the purchase is not counted twice.
- "Remaining unpaid balance" is `totalAmount` minus the installments paid. Until Phase 2 records payments, no installment counts as paid.
- "After the as-of date" is strict: entries dated on the as-of day are assumed to be in the override. The current override is the most recently entered one; older entries stay as history.
- Only amounts in the card's currency count toward used (D2: no FX conversion).
- Utilization boundaries: below 30% healthy, 30% to 70% inclusive warning, above 70% alert. A card whose used exceeds its limit follows D12.

---

## D12. No over-limit spending (Türkiye)

Turkish banks decline purchases that exceed the available limit, so a recorded charge above the available limit means the app's data is out of date, not that the user overspent.

- Manual charges and new installment purchases larger than the card's current available limit are blocked in the entry form, with a message like "Your bank would decline this: only <available> is available." and two actions: "Update bank balance" and "Edit card limit". Refunds are never blocked. Editing an existing entry checks against the available limit without that entry.
- `core/finance` exposes a pure function (`checkSpendAllowed`) with tests for exact-limit, one-kuruş-over, installment total, refund and edit cases.
- If used still exceeds the limit (interest, fees, a limit reduced by the bank, or Phase 3 imports), treat the card as full: gauge at 100%, available 0, alert color, with a hint that explains the cause instead of suggesting the user overspent: "Your balance is above your limit, usually because of interest, fees or a lowered limit. Your bank won't approve new spending until it is below the limit. If this doesn't match your bank, update your balance or limit." There is no separate "over limit" wording in the UI. Spending can never push a Turkish card past its limit; a balance above it comes from interest, fees or a limit the bank lowered (or from out-of-date data).

**Implementation notes:**
- A charge exactly equal to the available limit is allowed; one kuruş more is blocked. An installment purchase is checked by its full total, since the bank blocks the whole amount (D11).
- When the card is already full, available is 0 and every new charge is blocked until the balance or limit is updated.
- Manual entries cannot be edited yet; the edit case is implemented in `checkSpendAllowed` (it leaves the edited entry, and its installment plan, out of the calculation) for when entry editing is added.

---

## D13. Card types

**Decision:** Cards have a type, `'credit' | 'debit'`.

- **Credit (kredi kartı):** unchanged. Limit, statement day, due day, installments, D11 usage and D12 spend blocking all apply.
- **Debit (banka kartı):** no limit, no statement or due day, no installments, no balance override and no spend blocking, because the app does not know the account balance. Debit spending counts toward spending totals, imports and Sub-Radar.
- Tracking bank account balances stays out of scope for v1.

**Implementation notes:**
- `Card` is a discriminated union on `type`: `limit`, `statementDay` and `dueDay` exist only on credit cards, so code cannot read a debit card's limit by mistake.
- Dexie schema v2 adds the type; its upgrade sets `type = 'credit'` on every existing card (D1: never edit an existing version).
- The card form asks for the type first. The type cannot change once the card has entries, like the currency.
- Debit cards show this month's spending (charges minus refunds, never below zero) instead of a limit gauge.
- The credit card form previews the next statement and payment due dates as the days are typed. Equal statement and due days are allowed, with a soft hint that Turkish cards are usually due about 10 days after the statement.

---

## D14. Statements and bill payments

D11 deferred payments to Phase 2. Credit cards only (D13).

- A statement covers one period, from the day after the previous statement day to this statement day (month-end clamped). Its total = single charges and refunds in the period + the installments falling due in that statement. It is computed from data, and stored in `statements` only when the user records a payment.
- The upcoming payments list shows each credit card's next bill with its due date and amount. "Mark as paid" opens a payment form prefilled with the full statement amount, which the user can edit (minimum payment or any partial amount).
- Effect on used (extends D11): a payment dated after the override as-of date reduces used by its amount. A full payment also marks the installments in that statement as paid, so the limit they blocked is released. A partial payment reduces used but marks no installments as paid. Interest on unpaid balances is out of scope; the user reflects it with the bank balance override.
- Due dates: if the computed due date falls on a Saturday or Sunday, show the next Monday, labelled as moved. Public holidays are out of scope for now.
- Debit cards have no statements or payments; their spending counts only in spending totals.
- **Overdue bills:** the latest closed statement, when its due date has passed and it is not fully paid, stays visible as "Overdue" / "Gecikmiş" on the card screen, in the upcoming payments list and in the due-soon banner, ahead of the open statement, until it is paid, the next statement closes, or the user marks it "Paid outside the app" / "Uygulama dışında ödendi". That records a payment of the full remaining amount dated on the due date (flagged `outside`), so it settles the statement and appears in the payment history, where it can be deleted. Statements covered by a bank balance override (closing on or before its as-of date) are never overdue. Older statements are never overdue: once a newer statement closes, the bank carries any unpaid amount into it, and an imported history (often a year of statements) has no payments in the app because they were made at the bank, so flagging each one would list a year of paid bills as overdue.
- **Auto-pay:** each credit card has an "Automatic payment" / "Otomatik ödeme" setting. When it is on, each closed bill counts as fully paid on its due date: the app stores a payment of the remaining amount dated on the due date, flagged `automatic`, so it appears in the payment history and can be deleted. The dashboard and card screen show "Paid automatically" instead of asking, and auto-pay bills stay out of the due-soon banner and badge. Overdue never applies to auto-pay cards.

**Auto-pay implementation notes:**
- Auto-pay counts from the day it is turned on (`autoPaySince`); older unpaid bills are not paid retroactively.
- Payments are recorded when the app opens and when an auto-pay setting changes, in one database transaction that re-reads the data, so repeated or overlapping runs record each payment once.
- Deleting an automatic payment marks its statement (`autoPaySkipped`) so it is not recorded again; use this when the bank did not actually pay.

---

## D15. Credit balance from overpayment (alacak bakiyesi)

Turkish banks accept payments above the bill; the excess becomes a credit balance that adds to the card's spending power. Credit cards only (D13).

- `computeCardUsage` keeps the signed balance: rawUsed = override + singles + plans − payments (D11, D14). used = max(rawUsed, 0); credit = max(−rawUsed, 0); available = limit − rawUsed, so limit + credit. The card limit itself never changes.
- UI: when credit > 0, the figures show a "Credit" / "Fazla ödeme" row with +amount, available includes it, and the gauge shows 0% used.
- D12 blocking checks against this available: a 50.000 limit with 30.000 credit allows a charge of exactly 80.000.
- Credit carries forward: each statement's amount due = max(statement total − credit carried in, 0), and the unused credit carries to the next statement. Projections apply credit to upcoming months in order.
- Payment form: when the amount exceeds the bill's remaining amount, a hint says "₺X will be added to your card as credit" / "₺X kartına alacak olarak eklenecek". There is no hard upper cap.
- Bank balance override: the form has a "The card has a credit balance" / "Kartta alacak var" option that stores a negative balance.
- Refunds that exceed charges also become credit; neither used nor a statement clamps them away.

**Implementation notes:**
- Statements form one chain per card, from the first statement with data, carrying credit from each into the next. With a balance override, the chain starts at the first statement after its as-of date and carries the override's credit; earlier statements are covered by the override.
- A statement's "amount due" is what the bank asks for after credit. A payment settles the statement (D14) when it covers the amount due, and the stored `totalDue` is that amount.
- The credit shown on the card (max(−rawUsed, 0)) and the credit carried between statements can differ while installments are outstanding: the card figure nets the limit still blocked by future installments (D11), while the statement chain applies credit as each installment is billed. Available is the same either way.

---

## D16. Import row types

A card statement is more than purchases: it also lists installment slices, the bill payments the user made, balance lines and bank charges. Importing every line as a charge or refund would double-count installments, turn payments into refunds and inflate spending with summary lines. Every imported row (CSV now, PDF in Phase 6) is therefore classified first. Classification lives in `src/parsers/common/` as pure, tested functions with Turkish and English keywords; the review screen shows each row's type and lets the user change it.

| Type | Recognized by | Credit card | Debit card (D13) |
| :--- | :--- | :--- | :--- |
| **Charge** | Any other row with a positive amount | Imported as a transaction | Same |
| **Refund** | Any other row with a negative (credit) amount ("İADE", "REFUND" raise confidence) | Imported as a negative transaction | Only with a refund keyword ("İADE", "İPTAL", "REFUND"); other money in is income |
| **Income** | Money in on a debit card that is not a refund: maaş, gelen EFT/Havale/FAST (high confidence), or any other money in (medium) | Never: money in on a credit card is a refund or a payment | Saved as income (D17), never counted as spending |
| **Installment slice** | "TAKSİT 3/6", "3/6 TAKSİT", "3. TAKSİT", "(3/6)", "3/6", "installment 3 of 6", or the mapped installment column | Linked to an existing plan, or creates the plan for the remaining installments; never a separate charge | Ignored: imported as a plain charge |
| **Bill payment** | "ÖDEME", "HESAPTAN ÖDEME", "OTOMATİK ÖDEME", "KART ÖDEMESİ", "PAYMENT", "AUTOPAY"… on a credit (negative) row | Offered as a payment against its statement (D14), unless already recorded; never a refund | Recorded on the credit card it paid (D17); skipped when the app has no credit card. An outflow named "KREDİ KARTI ÖDEMESİ", "KK ÖDEME" or "CREDIT CARD PAYMENT" is also a payment, never spending |
| **Balance or summary line** | "ÖNCEKİ DÖNEM BAKİYESİ", "DÖNEM BORCU", "ASGARİ ÖDEME", "TOPLAM", "PREVIOUS BALANCE", "MINIMUM PAYMENT"… | Skipped | Skipped |
| **Interest or fee** | "FAİZ", "BSMV", "KKDF", "KART ÜCRETİ", "ÜYELİK ÜCRETİ", "GECİKME", "INTEREST", "LATE FEE", "ANNUAL FEE"… on a positive row | Imported as a charge with `fee: true`, so later phases can report fees | Same |

**Rules:**
- Keywords are matched on the normalized description (case and Turkish accents folded, as in D3's fingerprint), on whole words. Summary keywords are checked first, so "ASGARİ ÖDEME TUTARI" is a summary line, not a payment. A payment keyword on a positive (charge) row is a merchant name ("IYZICO ÖDEME …"), so that row stays a charge.
- A bare "3/6" without "TAKSİT" counts as a marker only up to 12 installments, so "7/24" in a shop name is not a plan.
- Each row gets a confidence flag: **high** when a keyword or a marker with "TAKSİT" decided it, **medium** for a bare "3/6" marker or a refund with no refund keyword, **low** when the date or amount needed guessing. Unparseable rows are shown as errors and are never saved.
- **Installment slices:** a slice belongs to the statement the import covers, which is the statement period containing the latest date in the file (banks print either the purchase date or the billing date on a slice, so the row's own date is not used). It links to an existing plan on the same card and currency when (a) the descriptions are similar (one contains the other, or they share their first word or most of their words, ignoring the marker; a plan without a description matches on amount alone, and takes the bank's description, like D3's merge), (b) the row's amount is one of the plan's installment amounts, and (c) the plan has an installment due in that statement's month (±1 month). A linked slice saves nothing, since the plan already bills it. Otherwise the import creates a plan for the remaining installments: slice k of n creates n − k + 1 installments of the row's amount, the first due in that statement's month, plus its purchase transaction (D11), and the review screen says "Creates a plan with N installments left". Re-importing the statement then links the slice to that plan.
- **Bill payments** are matched to the latest statement that closed before the payment date. A payment is skipped as already recorded when a payment of the same amount is already stored within ±3 days of its date (manual, "Paid outside the app", automatic or imported), and as covered by auto-pay when the card has automatic payment on and the payment falls within ±3 days of the due date of a bill auto-pay pays (D14). A payment whose statement has nothing to pay is skipped. Paying more than the amount due becomes credit (D15).
- **Duplicates and manual entries (D3):** charges, refunds and fees are first deduplicated by fingerprint against earlier imports. Identical rows within one file are kept (two coffees on the same day): the n-th identical row gets the fingerprint suffix `#n`, so re-importing the same file still adds nothing. A remaining charge or refund that matches a manual entry (same card, same signed amount, date within ±3 days) is "Already logged" and merged by default: nothing new is saved, and the manual entry takes the bank's description if it had none. Each manual entry merges with one row at most, and the user can unmerge a row.
- **Undo** removes everything an import created (its transactions, the plans and payments it created, re-settling those statements as deleting a payment does in D14) and restores the descriptions it filled in on merged entries and linked plans.
- Changing a row's type on the review screen recomputes its outcome. Only types that apply to the card are offered: debit cards have no installment type, and a payment on a debit card follows D17.

---

## D17. Bank account statements (hesap hareketleri)

A bank account export lists more than card purchases: salary and incoming transfers, outgoing transfers, cash withdrawals, utility bills and the payments that settle credit card bills. Importing it as a card statement would count salary as a refund and a credit card payment as spending. An account statement is therefore recognized and classified with its own rules, extending D16.

- **Detection:** a file whose header has at least two of Bakiye, Ek Hesap Bakiyesi, Kanal/Şube and Valör is an account statement. It is imported onto a **debit card** (the account's card, D13); opened on a credit card, the import asks for the debit card instead.
- **Columns:** the date comes from Tarih/Saat (or Tarih), never Valör; times are dropped ("03.11.2026 14:22"). The amount comes from İşlem Tutarı, where money going out is negative. Balance columns (Bakiye, Ek Hesap Bakiyesi), Valör and Kanal/Şube are never mapped. İşlem Türü and İşlem are mapped as labels; Referans as the row's reference.
- **Classification:** İşlem Türü first, then İşlem, then Açıklama; the first text a rule recognizes decides. The keyword lists live in `src/parsers/common/keywords.ts`, so a new bank label is a one-line addition.

| Type | Recognized by | Saved as |
| :--- | :--- | :--- |
| **Card purchase** (charge) | POS, sanal POS, internet alışveriş, temassız, harcama… | A charge on the debit card |
| **Income** | Money in that is not a refund: maaş, gelen EFT/Havale/FAST… (any unlabelled money in, with medium confidence) | An income transaction (negative amount, `income: true`), never a refund and never counted in spending, so Kipp can use it later. The user can leave it out on the review screen. |
| **Refund** | Money in with "İADE", "İPTAL" | A refund on the debit card |
| **Credit card bill payment** | "KREDİ KARTI ÖDEMESİ", "KK ÖDEME"… | A D14 payment on the credit card it paid, never spending. The card is the one picked on the review screen, else the only credit card whose last 4 digits appear in the description, else the only credit card in the app; with none, the row asks the user to pick. Deduplicated like D16 (same amount within ±3 days on that card, any method, and auto-pay due dates). |
| **Automatic bill** | fatura, otomatik ödeme talimatı, elektrik, doğalgaz, su, internet and phone providers… | A charge with `bill: true`, so Sub-Radar can detect it as recurring (Phase 4) |
| **Transfer or cash** | giden EFT/Havale/FAST, virman, ATM, para çekme… | Skipped by default; "Count as spending" saves it as a charge with `transfer: true` |
| **Fee** | masraf, ücret, komisyon (as D16) | A charge with `fee: true` |
| **Summary** | as D16 | Skipped |

- **Income on debit cards everywhere:** income is not limited to account statements. A debit card's own CSV export classifies money in the same way (D16), the review screen offers Income on every debit card, and manual entry on a debit card offers Charge / Refund / Income. A credit card never has income: money in on it is a refund or a bill payment. An imported income row merges (D3) only with a manual income entry, and a charge or refund never merges with one, so a salary is never taken for a refund of the same amount.
- **Referans:** when the file has a reference column, a row's fingerprint is `cardId + "ref" + reference` instead of date + amount + description (D3), so a re-export with a reworded description is still recognized.
- **Undo** (D16) also removes the payments the import recorded on credit cards.

---

## D18. Excel import with SheetJS (vendored)

Many Turkish banks (İş Bankası among them) export `.xls` rather than CSV, and some ".xls" files are HTML tables. Excel import uses **SheetJS Community Edition 0.20.3**.

- **Source:** the official tarball from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (Apache-2.0), downloaded once and committed as `vendor/xlsx-0.20.3.tgz`. `package.json` installs it from that file, so installs and CI never fetch from an outside host. The npm `xlsx` package is not used: it is frozen at 0.18.5, which has a prototype-pollution and a ReDoS advisory with no npm fix.
- **SHA-256:** `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`. `npm run check:vendor` verifies it and runs in CI before `npm ci`. Upgrading means downloading the new tarball from the same site, updating this checksum and `scripts/check-vendor.mjs`, and recording the version here.
- **Formats:** `.xlsx`, legacy `.xls` (BIFF) and HTML saved as `.xls`, told apart by their first bytes, not the file name. HTML cells are read as text without number parsing, so "1.250" stays a Turkish thousand; binary date cells become ISO dates (read as UTC, so no time-zone shift) and number cells plain decimals rounded to the cent. Info rows above the header are skipped by finding the row that names known columns (D17). CSV keeps using PapaParse.
- **Loading:** the import screen is a lazy route, and SheetJS is a dynamic import inside it that loads only when a spreadsheet is opened. It stays out of the main bundle (no chunk-size warning) and is precached for offline use like the rest of the app. SheetJS makes no network calls; the CSP is unchanged.
- PDF import stays in Phase 6.

---

## D19. Sub-Radar: subscriptions, bills and their alerts

Sub-Radar finds charges that repeat, shows what they cost per month and per year, and warns about price increases, double charges and charges after a cancellation. Small raises are the point: ten subscriptions that each go up by ₺10 cost ₺100 a month without anyone noticing, so no percentage threshold hides them. Detection is computed from the stored transactions every time, like statements (D14); only the user's choices are stored. The logic lives in `src/core/subscriptions/` as pure, tested functions.

- **Which entries count:** charges on credit and debit cards (D13). Fees, counted transfers, income, refunds and installment purchases are never subscriptions. Refunds are used only to clear a double-charge alert.
- **Merchant key:** the description is folded (case and Turkish accents, as D3), then payment-processor prefixes (İyzico, PayTR, PayU, Param…), web and company noise (com, www, tr, ltd, şti…), city names and tokens with digits (references, card numbers) are dropped. The key is the first remaining word, or the first two when the first is a platform that bills several services (Google, Apple, Amazon, Microsoft, PayPal, Türk…). "NETFLIX.COM", "NETFLIX COM ISTANBUL" and "IYZICO *NETFLIX" share the key `netflix`. The key is shared across cards, so a subscription moved to another card stays one subscription. **Display name:** a known service's name ("Netflix", "YouTube Premium", "ChatGPT") from a short brand list, else the description's own words without processors, noise and billing words (fatura, abonelik…), in title case ("Kahve Dünyası"). The bank's text is kept in the details.
- **Series:** charges with the same key and currency, by date. One merchant can bill several subscriptions (two Apple plans), so a charge joins the series whose latest amount is within 35% of it, else starts a new one; a price increase stays in its series. Bills are one series per merchant, whatever the amount.
- **Bills:** a series is a bill when any of its charges is marked `bill` (D17) or its description has a bill keyword (`keywords.ts`). Bills appear in their own section with the average of their last 3 charges as the monthly cost, and get no price-increase alert, because their amount changes every month.
- **Cadence:** counted from the latest charge backwards, over consecutive intervals of **weekly** 6–8 days, **monthly** 25–35 days (28–31 plus a few days of posting delay) or **yearly** 355–375 days. A series is a subscription with **3 charges** in a weekly or monthly run, or **2** in a yearly run. A second charge of the same amount within 3 days is a double charge and is left out of the cadence.
- **Active:** the latest charge is at most 14 days (weekly), 45 days (monthly) or 400 days (yearly) old. Older series are listed as "Not seen lately" and leave the totals. The next charge is expected 7 days, one calendar month (clamped to the month's last day) or one year after the latest.
- **Cost:** the latest amount for a subscription, the 3-charge average for a bill. Monthly equivalent: weekly × 52 / 12, monthly × 1, yearly / 12; yearly: weekly × 52, monthly × 12, yearly × 1, rounded to the minor unit. Totals are per currency, over active series that are not ignored or cancelled.
- **Price increase (subscriptions only):** a charge is an increase when it is higher than **each** of up to 3 charges before it. Every increase is caught and counted: the top of the tab sums the monthly equivalent of every current increase ("raises add ₺10,50 a month"), so many small raises can't hide. A price that moves with the exchange rate counts only when it sets a new high. Only a **notable** increase is a red alert: **at least 5 units of the currency (₺5) or 3%**. A smaller one (₺57,99 → ₺58,49, or exchange-rate drift) is shown in grey inside the subscription's details, with no alert and no badge. An increase stays visible while it is among the series' last 3 charges (last 2 for yearly); its alert stays until the user acknowledges that amount ("Got it"), and a later, higher notable increase alerts again.
- **Double charge:** two charges of the same amount in one series within 3 days. The alert clears when a refund of that amount from the same merchant follows within 30 days, or when the user taps "Not a duplicate".
- **User choices** (stored in `subscriptions`, keyed by `merchant key | currency`, plus `#first amount` only when one merchant has several subscription series):
  - No stored row: active. Nothing needs confirming: a found subscription counts until the user says otherwise.
  - **Not a subscription** ("Hide this bill" for bills): hidden from lists, totals and alerts, listed under "Past and hidden" with Restore.
  - **I cancelled it:** stores the date; the series leaves the totals and is listed under "Past and hidden". A charge after that date raises a "charged after you cancelled" alert, with "Still active" (back to active) or "Dismiss" (the cancellation date moves to that charge).
- **Screen (D20):** one total (subscriptions per month, with the yearly cost, the count and the raises on one line), one "Needs your attention (n)" line that opens to the alerts, and a list of names and prices with a red dot on rows that have an alert. Cadence, card, dates, price change, recent charges, the bank's text and the actions open when a row is tapped. Bills are one folded line with their monthly average; inactive, cancelled and hidden series are one folded "Past and hidden" line.
- **Debit:** subscriptions and bills are detected across credit and debit cards together; Sub-Radar uses no limits, statements or due dates. Kipp's subscription insights (D4, Phase 5) read these results.

---

## D20. Simple by default

Financier is for everyday users as much as for people who track every kuruş. A screen that shows everything the app knows overwhelms the first group and slows down the second, and a hard learning curve costs users at launch.

- **One thing first:** each screen leads with the one number or answer the user came for, in a sentence or a large figure.
- **Details on tap:** history, dates, the bank's raw text, secondary figures and actions open when the user taps a row; lists show a name and an amount.
- **Alerts only when worth acting on:** red is for things the user should do something about. Small changes are shown quietly and still counted (D19 price increases).
- **Ask only what can't be inferred:** prefer values the app can read from an import or compute over form fields, and never ask the user to confirm something the app can safely assume (Sub-Radar has no confirm step).
- **Plain words:** no technical terms on screen ("mapping", "fingerprint", "detected"); the same idea uses the same word everywhere, in both languages.
- **Detailed view:** a setting, off by default, for people who track every kuruş. When it is on, the full sections come back inline (a limit gauge per card, the cash-flow chart, every transaction and import row). Simple screens never hide a function: everything stays reachable on tap.
- **Dashboard:** leads with the total due in the next 30 days and the list of those payments. A payment is plain text until 2 days before its due date, amber from then until the due date, and red only once overdue. There is no separate due-soon panel; the app icon badge still counts payments due within 7 days (D5).
- **Card setup:** asks for the name, the type and, for a credit card, the limit. The statement and due days come from the first imported statement when the file states them; until then the card shows one line asking for the due day, and has no bills.
- **Scope:** applied to Sub-Radar and to import column mapping (D3) in Phase 4. The Phase 4.5 design pass applies it to cards, the import review screen (opening on the rows needing a look, with less text) and the dashboard; every later phase follows it.

---

## D21. Visual identity

Testers found the first look generic ("looks AI-made"): navy, Inter, mint and a bordered box around every section. Phase 4.5 replaces it; Phase 8 tunes it.

- **Layout:** white (or charcoal) rounded panels on a soft ground, no borders around sections; lists separated by hairlines; one large figure per screen. Cards appear as small colored cards in their own color.
- **Type:** Bricolage Grotesque for headings and large figures, DM Sans for text; both self-hosted (D8) and checked to contain ₺ and every Turkish letter. Figures use tabular numbers.
- **Colors:** light ground #eef0f3 with white panels; dark is warm charcoal (#121412 ground, #1c1f1b panels), never navy. Kipp green (#b8e986 in dark, a deeper green in light) is the accent. Status colors are amber for "soon" and red for "act now", each with a tinted label background, and pass 4.5:1 contrast in both themes.
- **Theme:** follows the device setting until the user picks light or dark in Settings.
- **Navigation:** a floating pill (white with a soft shadow in light, raised charcoal in dark) with four tabs (Dashboard, Cards, Sub-Radar, Settings) around a round green "+". Only the current tab shows its name. The "+" opens "Upload a statement" (the import screen) and "Add an entry" (asks which card when there are several), so import is the main action rather than a tab.
- **Import start:** one line of intro, the cards as chips with their bank marks, one large "Choose file" button that also takes a dropped file, and the import history folded into one line (hidden before the first import).
- **Bank marks:** a card shows its bank's mark next to its name. The app ships a local list of Turkish banks (name, brand color, mark); the card's bank text is matched against it, so no data changes. Until a bank's logo file is added, the mark is its initials on its brand color. Logos are local files only (D8), added when their use is cleared.

---

## Data model (v4)

| Table | Key fields |
| :--- | :--- |
| `cards` | `id`, `type` (`credit` / `debit`), `name`, `bank`, `last4`, `currency`, `color`, `archived`; credit only: `limit`, `statementDay`, `dueDay`, `autoPay?`, `autoPaySince?` (D14) |
| `transactions` | `id`, `cardId`, `date`, `description`, `normalizedMerchant`, `amount`, `currency`, `category`, `installmentPlanId?`, `fingerprint`, `source` (`manual` / `csv` / `pdf`), `importId?`, `fee?` (interest or bank fee, D16), `income?`, `bill?`, `transfer?` (account statements, D17; income is excluded from spending) |
| `installmentPlans` | `id`, `cardId`, `description`, `totalAmount`, `count`, `purchaseDate`, `firstDueMonth`, `currency`, `importId?` (created by an import, D16; indexed in schema v4) |
| `balanceOverrides` | `id`, `cardId`, `balance` (negative for a credit balance, D15), `currency`, `asOf`, `createdAt` (history of bank balances entered by the user, D11) |
| `statements` | `id`, `cardId`, `periodStart`, `periodEnd`, `dueDate`, `totalDue`, `minimumDue?`, `paid`, `installments`, `autoPaySkipped?` (stored when a payment is recorded, D14) |
| `payments` | `id`, `cardId`, `statementId`, `date`, `amount`, `currency`, `createdAt`, `method?` (`manual` / `outside` / `automatic`; bill payments, credit cards only, D14; added in schema v3), `importId?` (recorded by an import, D16; indexed in schema v4) |
| `subscriptions` | `id` (series key, D19), `normalizedMerchant`, `currency`, `status` (`active` / `ignored` / `cancelled`), `cancelledAt?`, `hikeSeenAmount?`, `dismissedDuplicates?` (only the user's Sub-Radar choices; series, cadence and amounts are computed, D19) |
| `importProfiles` | `id`, `name`, `bank`, `kind` (`csv` / `pdf`), `headerSignature`, `columnMap` (date, description, amount or debit/credit, installment, reference, İşlem Türü, İşlem), `options` (header row, decimal separator, date order, sign convention) |
| `imports` | `id`, `fileName`, `importedAt`, `rowCount`, `profileId?`, `cardId`, `counts` (per outcome), `restore` (descriptions to put back on undo, D16) (lets the user undo a whole import) |
| `settings` | key/value: `locale`, `theme`, `monthlyIncome?`, `primaryCurrency`, `onboardingDone` |

---

## Out of scope for v1

Itemized receipt splitting, bank account (non-card) balances, budgets per category, FX conversion, an on-device LLM, multi-device sync, and native notifications. Each is a candidate for a later phase once the core is solid.
