# Iron Billing — Modern Commercial Iron & Steel Billing System

A high-performance, offline-first billing, invoicing, and ledger management application built for iron, steel, and heavy hardware merchants.

## 🚀 Key Modernizations & Fixes

1. **Seamless Light & Dark Themes**:
   - Complete custom variant support for Tailwind CSS v4 (`@custom-variant dark`).
   - Unified segmented toggle (`[ Light | Dark ]`) in the top app bar, sidebar, and Settings.
   - Clean, high-contrast light mode with crisp borders, readable dark slate typography, and emerald accents.
   - Print isolation: Printed bilty and PDF invoices always render on clean white paper with high-contrast text irrespective of screen dark mode.

2. **Rapid Keyboard-First Billing**:
   - **Auto-Sequence Numbering**: Next bill number is automatically fetched and pre-populated on form load.
   - **Keyboard Navigation**: Press `Enter` to traverse through fields, and `Ctrl + Enter` (or `Cmd + Enter`) to save the bill instantly from anywhere.
   - **Fast Metric Weight Presets**: Quick-select buttons (`250kg`, `500kg`, `1T`, `2T`, `5T`, `10T`, `15T`, `20T`) and increment chips (`+500kg`, `+1 Ton`).
   - **Smart Party & Rate Lookup**: Keyboard arrow navigation in autocomplete suggestions with instant party phone retrieval.

3. **In-App Print & PDF Preview Modal**:
   - Solves browser popup blocking bugs by embedding a live preview in a modal.
   - One-click safe printing through invisible print iframe.
   - Direct HTML and PDF downloads.
   - WhatsApp bill sharing and payment reminders with dynamic UPI QR codes.

4. **Commercial Financial Management**:
   - **Dashboard**: Period filters (Today, This Week, This Month), 7-day revenue trend chart with interactive values, and top revenue parties.
   - **Party Ledgers**: Accurate transaction records for both Consignors and Consignees with running balance and one-click Excel statements.
   - **Excel Export**: Full export support for bill history and party ledger statements.
   - **Security**: Master PIN protection, offline JSON database backup & restore, and optional Supabase cloud sync.

## 🛠️ Tech Stack

- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS v4 with custom dark mode variants & CSS tokens
- **Offline Database**: Dexie (IndexedDB)
- **Icons**: Lucide React
- **Export & Utility**: SheetJS (XLSX), QRCode, jsPDF

## 📦 Getting Started

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Build for production
npm run build
```
