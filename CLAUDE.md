# CLAUDE.md — Instructions for building Financier

You are the developer of **Financier**, a mobile-first, 100% local, zero-cloud personal finance PWA with **Kipp the Chameleon** as its companion. The project owner (Kerem) makes product decisions; you make implementation decisions within the rules below and flag anything that would change product scope.

## Read first

1. `DECISIONS.md` — the binding architecture decisions (storage, money, parsing, Kipp, backup, i18n, privacy, stack, data model). Follow them. If a decision turns out to be wrong in practice, stop and propose an edit to that file instead of silently deviating.
2. `PLAN.md` — the phased build plan.
3. `WORKFLOWS.md` — product vision, modules and folder structure.
4. `USAGE.md` — the user-facing behavior the app must match.

## Non-negotiable rules

- **Zero-Cloud:** never add code or dependencies that send data off the device: no analytics, telemetry, error reporting, remote fonts, CDN assets or external API calls. The CSP in `index.html` (`connect-src 'self'`) must stay intact.
- **Money is integer minor units** with a currency code. Never use floats for amounts.
- **Business logic lives in `src/core/` and `src/parsers/` as pure, tested TypeScript** with no React or Dexie imports. Components stay thin.
- **Data access goes through `src/db/` repositories.** Components and hooks never call Dexie tables directly.
- **Every user-visible string goes through `src/i18n/`** with both `en` and `tr` entries.
- **Imports are never saved without the user's review**, and must be deduplicated by fingerprint.
- **English** for code, comments and commit messages (Conventional Commits).
- **Cards are credit or debit** (`DECISIONS.md` D11–D14). Every feature must state how it treats each type: limits, statements, payments, installments, blocking and debt apply to credit cards only; spending, imports, Sub-Radar and Kipp cover both.

## Commands

```bash
npm run dev        # start dev server
npm run build      # type-check and production build
npm run test       # vitest
npm run lint       # eslint
```

A task is done only when `lint`, `test` and `build` all pass. New logic in `core/` or `parsers/` needs tests in the same change.

## Build plan

The phases live in **`PLAN.md`**. Work phase by phase, finish each phase with passing checks and a pull request titled after the phase, and do not start a later phase's features early.

## Working style

- Prefer small, focused commits. Keep dependencies minimal and justify each new one.
- When something is ambiguous at the product level, ask Kerem; when it is purely technical, decide, and note the choice in the PR description.
- Test data must be synthetic. Never commit real financial data.
- **`synthetic/` is the local manual-testing folder.** It holds synthetic statement files (CSV, Excel, later PDF) and test instructions (`TEST-TALIMATLARI.md`) for manual testing. It is gitignored and is never committed or pushed. For each task, create or update the files there that the manual tests need, keep the instructions' expected results in sync with the code, and leave the existing files in place unless a task changes what they expect. Automated test fixtures stay in the repo next to their tests, as before.

## Commits and pull requests

These rules apply to every commit message and every pull request (title, description and comments):

- Every commit message ends its body with the phase its work comes from, as `From PLAN.md: Phase N — <name>` (for example `From PLAN.md: Phase 4.5 — Design pass`). Work outside a phase says `From PLAN.md: maintenance`.
- Always write in the first person plural ("we add", "we skip") or the imperative mood ("add", "skip").
- Never append "🤖 Generated with Claude Code", "Generated with Claude Code" or any similar signature, footer or trailer.
- Never refer to Kerem in the third person (e.g. not "Kerem's bank exports records like this"). Describe the thing neutrally ("the bank's export", "the sample export") or say "we".
