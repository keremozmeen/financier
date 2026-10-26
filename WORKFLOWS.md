# `WORKFLOWS.md` — Agent Roles & Execution Guidelines

## 1. Project Overview & Vision
**Financier** is a **Mobile-First, 100% Local, Zero-Cloud Personal Finance Tracker**.
* **Mascot:** **Kipp the Chameleon** (Your local finance buddy that keeps an eye on credit card limits, monthly cash flow, recurring subscriptions, and hidden fees).
* **Core Value:** **Privacy-First & Complete Data Sovereignty**. All bank statements (PDF/CSV), invoices, and transactions are processed strictly on the client's device using local storage (`IndexedDB` via Dexie). **No financial data ever leaves the user's phone or computer.**

---

## 2. Agent Role & Persona
You are acting as the **Lead Autonomous AI Developer** for Financier.

### Core Responsibilities
1. **Architecting Client-Side Logic:** Write clean, modular, and performant TypeScript/React code for full financial tracking, local file parsing, and local storage.
2. **Maintaining Data Privacy Rules:** Strictly enforce the Zero-Cloud promise. Never introduce external API calls, analytics, or server-side dependencies that transmit user data.
3. **Designing Intuitive UI/UX:** Implement a modern, mobile-first dark mode dashboard with Kipp the Chameleon acting as a friendly, interactive finance companion.
4. **Enforcing Commit & Code Standards:** Maintain clean code architecture with English inline documentation and Git commit messages.

---

## 3. Technology Stack

| Layer | Technology Selected |
| :--- | :--- |
| **Framework / Bundler** | React 18+ / Vite / TypeScript |
| **Styling & UI** | Tailwind CSS / Lucide React / Framer Motion |
| **Local Storage** | `IndexedDB` via Dexie |
| **Parsing Engine** | Client-Side PDF (`pdfjs-dist`) & CSV (`PapaParse`) |
| **App Type / Target** | Hybrid PWA (Progressive Web App) → Native via Tauri v2 Mobile (post-v1) |
| **Deployment** | GitHub Pages (Static Client-Side Hosting) |

The binding details behind these choices are in [`DECISIONS.md`](DECISIONS.md).

---

## 4. Module & Feature Breakdown

### Module 1: Comprehensive Financial Core (`/src/core/finance`)
* **Credit Cards & Limits:** Track total limits, available limits, statement balance ratios, and statement closing/payment due dates across all user cards.
* **Cash Flow & Installment Projections:** Calculate multi-month installment liabilities (e.g., 3, 6, 12-month breakdowns) to simulate upcoming monthly payment burdens.
* **Overview Metrics:** Calculate total debt load, monthly fixed vs. variable spending, and available net liquidity in real time.

### Module 2: Local Statement Parser (`/src/parsers`)
* Parse transaction dates, descriptions, amounts, and card tags directly from local PDF/CSV bank statements.
* Support itemized receipt/invoice imports to break down umbrella charges or store receipts into clear sub-categories.

### Module 3: Sub-Radar & Fee Inspector (`/src/core/subscriptions`)
* **Recurring Payment Detection:** Automatically detect periodic transaction patterns (e.g., charges repeating every 28–31 days).
* **Sneaky Cost & Price Hike Alerts:** Compare historical transaction amounts to flag silent price increases, unannounced service price hikes, or duplicate charges.

### Module 4: Kipp Companion UI (`/src/components`)
* **Dashboard:** Unified mobile view showing Card Limit Gauges, Monthly Cash Flow Bar Charts, Recent Activity, and Active Subscriptions.
* **Kipp Natural Query Bar:** A local chat widget where users can ask questions like *"What is my available limit on Card A?"*, *"How much installment do I owe next month?"*, or *"Show my active subscriptions"*.

---

## 5. Development Workflow & Git Standards

### Project Structure
```text
financier/
├── src/
│   ├── assets/          # Kipp mascot artwork, icons, and SVGs
│   ├── components/      # UI components (Dashboard, CardGauges, CashFlow, SubTracker)
│   ├── core/            # Business logic (Finance math, Cash flow, Sub detection)
│   ├── db/              # IndexedDB / Local Storage manager
│   ├── hooks/           # Custom React hooks (useCards, useTransactions, useSubscriptions)
│   ├── parsers/         # Local PDF/CSV and invoice statement parsers
│   ├── types/           # TypeScript interface definitions
│   ├── App.tsx          # Main React Application shell
│   └── main.tsx         # Entry point
├── public/              # PWA Manifest, Service Worker
├── DECISIONS.md         # Binding architecture decisions
├── CLAUDE.md            # Build instructions and phased plan for the AI developer
├── WORKFLOWS.md         # Workflow and developer roles document
└── README.md            # Public project overview & Zero-Cloud manifesto
```
