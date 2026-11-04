# 📖 Financier User Guide

Welcome to **Financier**! Guided by **Kipp the Chameleon**, this guide explains how to install, import data, and get the most out of your private, local-first finance companion.

---

## 📲 How to Install Financier on Your Phone

Financier is a **Progressive Web App (PWA)**, meaning you don't need to visit an App Store to install it.

### On iOS (iPhone / iPad)
1. Open the Financier web link in **Safari**.
2. Tap the **Share button** (the square with an upward arrow at the bottom of the screen).
3. Scroll down and select **"Add to Home Screen"**.
4. Tap **Add**. Financier will now appear as an app icon on your home screen and operate offline.

### On Android
1. Open the Financier web link in **Google Chrome**.
2. Tap the **three dots menu** in the top right corner.
3. Select **"Install app"** or **"Add to Home screen"**.
4. Confirm the installation prompt.

---

## 📥 How to Import Statements Privately

All processing happens **on your phone**. No file is ever uploaded anywhere.

1. Download your statement as **CSV** or **Excel** (`.xls`, `.xlsx`) from your bank's website or app. Card statements and bank account statements (hesap hareketleri) both work. PDF import comes in a later version.
2. Open the **Import** tab, pick the card the statement belongs to, and choose or drag in the file.
3. The first time, match the columns (date, description, amount, and optionally the installment column). Financier remembers the mapping and reuses it for files with the same headers.
4. Review every row before anything is saved. Each row shows its type, which you can change:
   * **Charges, refunds and fees** (interest, BSMV, KKDF, card fees) are added as entries; fees are marked so you can see what the bank charged.
   * **Installment slices** ("TAKSİT 3/6") join your existing installment plan, or create a plan for the installments left. They never count twice.
   * **Bill payments** ("HESAPTAN ÖDEME") are recorded against the statement they paid, unless you already recorded that payment (or automatic payment covers it).
   * **Balance lines** ("ÖNCEKİ DÖNEM BAKİYESİ", "DÖNEM BORCU") are skipped.
   * Entries you already typed in by hand are shown as **Already logged** and merged, and rows you imported before are skipped, so importing the same file twice adds nothing.
5. Tap **Import**. Changed your mind? **Import history** lets you undo a whole import.

Debit card files work the same way, without installments. Money coming into a debit card is **income** (salary, incoming EFT/Havale/FAST, or any other money in), unless it says it is a refund ("İADE", "İPTAL"). Income is never counted as spending.

**Bank account statements (hesap hareketleri)** are imported onto the account's debit card. Financier recognizes:
* **Income** (salary, incoming EFT/Havale/FAST): saved as income, never counted as spending. Untick it to leave it out.
* **Card purchases** (POS, internet, contactless) and **automatic bills** (electricity, water, gas, internet, phone): saved as spending; bills are marked so Sub-Radar can track them.
* **Credit card payments:** recorded as a payment on the credit card they paid, matched by its last 4 digits or picked by you, and never counted as spending. A payment you already recorded, or one automatic payment made, is not added again.
* **Transfers and ATM withdrawals:** skipped unless you tap **Count as spending**.
* Balance columns are ignored, and rows are matched by the bank's reference number, so importing the same file again adds nothing.

---

## 💳 Managing Cards & Cash Flow

Financier tracks two kinds of cards. You pick the type when you add a card, and it cannot change once the card has entries.

* **Credit cards (kredi kartı):** have a limit, a statement day and a payment due day. They show a **limit gauge** (limit, used, available), support installment purchases, appear in upcoming payments and debt totals, and Financier stops you from recording a charge your bank would decline.
* **Debit cards (banka kartı):** spend straight from your bank account, so they have no limit, statements, due dates or installments. They show **this month's spending** instead of a gauge, and their charges count in your spending totals, recent activity, imports and Sub-Radar. You can also add **income** (salary, money sent to you) to a debit card; it is kept apart from refunds and never counts as spending.

* **Card Gauges:** View your total limit vs. current spent amount across all your credit cards in real time.
* **Cash Flow Forecast:** Check the **Installment Projection** chart to see your exact fixed liabilities for the next 3 to 12 months (credit cards).
* **Upcoming Payments:** The dashboard lists each credit card's next bill with its due date (moved to Monday when it falls on a weekend). Tap **Mark as paid** to record the full amount, or change it for a minimum or partial payment. A full payment releases the installments in that statement from your limit. Payments you record are listed on the card's screen, where you can delete one entered by mistake.
* **Statement Dates:** Set your credit cards' closing and due dates. Kipp reminds you in the app when a payment is due within 7 days, and **Add to calendar** downloads a calendar file with your due dates and a reminder 3 days before each, so your phone can alert you even when Financier is closed. The file holds only card names; your calendar app may sync it to its own cloud.

---

## 🔍 Spotting Subscriptions & Hidden Fees

1. Go to the **Sub-Radar** tab. It finds the charges that repeat on your cards, credit and debit, and shows them by name ("Netflix", "YouTube Premium"), even when the bank writes them differently or you moved one to another card.
2. The top tells you what your subscriptions cost **per month**, with the yearly cost and how much **raises** have added. Every raise is counted, however small.
3. If something needs a look, one line says **Needs your attention**. Tap it to see:
   * **Price increases** of ₺5 or 3% and up. Smaller ones (₺0,50, or exchange-rate drift) don't raise an alert; you see them in grey in the subscription's details. Tap **Got it** to clear an alert.
   * **Double charges:** the same amount twice within 3 days. A refund of that amount clears it, or tap **Not a duplicate**.
   * **Charges after you cancelled:** tap **Still active** or **Dismiss**.
4. Tap a subscription to see its dates, recent charges and the bank's text. There you can tap **I cancelled it** or **Not a subscription**. Nothing needs confirming: found subscriptions just count.
5. **Bills** (electricity, gas, water, phone) are one line with their monthly average; tap it to see them. Cancelled, hidden and no-longer-charged ones are under **Past and hidden**, where **Restore** brings them back.

---

## 💬 Using Kipp Assistant

Tap the **Kipp Chat Bar** at the bottom of the dashboard to ask questions in plain language:
* *"What is my available limit on Card A?"*
* *"How much total installment do I owe next month?"*
* *"List my active subscriptions."*

---

## 🔒 Data Backups & Reset

Since Financier stores everything locally inside your browser's storage:
* **Export Backup:** Go to **Settings → Export Backup**, choose a passphrase, and download an encrypted `.json` file of your local database. Keep the passphrase safe: it cannot be recovered.
* **Restore:** Import your `.json` backup file and enter its passphrase on a new device to transfer your data offline. You can replace the existing data or merge with it.
* **Clear Data:** Tap **Clear All Data** in settings to instantly wipe your local database.
