# Financier — Your Pocket Financier

> **Privacy-First, Zero-Cloud Personal Finance & Subscription Tracker**

Financier is a mobile-first Progressive Web App (PWA) accompanied by **Kipp the Chameleon**—your local finance companion. It is designed to give you total sovereignty over your financial data. Track credit card limits, forecast multi-month installment liabilities, and detect hidden recurring subscriptions—all processed **100% locally on your device**.

---

## 🛡️ The Zero-Cloud Promise

* **No External Servers:** Your bank statements, credit card limits, and transaction history never leave your phone or computer.
* **Client-Side Parsing:** Local PDF and CSV statement parsing happens entirely inside your browser using WebAssembly and JavaScript.
* **Local Storage:** All financial records are stored securely in your device's `IndexedDB` / `SQLite-Wasm`.

---

## ✨ Key Features

* 💳 **Credit Card & Limit Tracker:** Monitor total limits, statement balances, and closing dates across all your credit cards in one place.
* 📈 **Cash Flow & Installment Projections:** Visualize upcoming 3, 6, and 12-month payment liabilities so you never get surprised by card bills.
* 🔍 **Sub-Radar & Fee Inspector:** Automatically flag repeating charges and silent price increases on your subscriptions.
* 💬 **Kipp Companion:** Ask natural questions locally like *"What is my available limit on Card A?"* or *"Show my upcoming installments"*.
* 📱 **Mobile-First PWA:** Install it on iOS or Android directly from your browser via "Add to Home Screen"—no app store friction required.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
* **Node.js** 18.x or higher
* **npm** or **pnpm**

### Installation

```bash
# Clone the repository
git clone [https://github.com/keremozmeen/financier.git](https://github.com/keremozmeen/financier.git)

# Navigate into the project directory
cd financier

# Install dependencies
npm install

# Start the local development server
npm run dev