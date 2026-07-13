# JAHZJOURNALS

JAHZJOURNALS is a mobile-first forex trading journal and analytics platform for traders.

## Tech Stack
**Frontend:** React, Vite, Tailwind CSS, Recharts, React Hook Form, Zod, TanStack Table
**Backend:** Node.js, Express, PostgreSQL, Prisma ORM, JWT Auth, Cloudinary

## Folder Structure
```
jahzjournals/
├── client/              # React Vite frontend
└── server/              # Node.js Express backend
```

## Setup Instructions

### 1. Database Setup
Ensure you have PostgreSQL running.
Create a database for the project (e.g. `jahzjournals`).

### 2. Backend Setup
1. `cd server`
2. `npm install`
3. Copy `.env.example` to `.env` and fill the variables (DATABASE_URL, JWT_SECRET, CLOUDINARY...).
4. Run migrations: `npx prisma migrate dev`
5. Generate client: `npx prisma generate`
6. (Optional) Run seed: `node prisma/seed.js`
7. Start server: `npm run dev`

### 3. Frontend Setup
1. `cd client`
2. `npm install`
3. `npm run dev`

## File Upload Rules
- Images uploaded using the screenshots endpoint will be processed and sent to Cloudinary.
- Other files like CSVs and Reports are mapped to local fallback endpoints due to MVP scope, stored in `server/uploads/` folders.

## API Overview
Refer to `server/src/routes` for mapped APIs.
Core REST:
- `/api/auth` (Register, Login, Me)
- `/api/accounts` (Accounts CRUD)
- `/api/accounts/prop-firm` (Prop-firm account create, view, update, delete)
- `/api/prop-firm-phases` (Prop-firm phase update and delete)
- `/api/trades` (Trades CRUD, edit support, screenshots nested route)
- `/api/rules` (Trading rule CRUD and status)
- `/api/emotions` (Emotion correction and deletion)
- `/api/screenshots` (Screenshot deletion with Cloudinary cleanup)
- `/api/analytics` (Dashboard, grouped performance, summary, equity curve, drawdown, risk/reward)
- `/api/weekly-reviews` (Generate, list, view, and update weekly reviews)
- `/api/contact-messages` (Stored public contact messages)

Implementation details, metric formulas, migration notes, and security behavior are documented in `docs/backend-completion.md`.

## Account Management
Regular trading accounts and prop-firm accounts now use separate creation and edit flows.

Frontend routes:
- `/accounts` shows the account dashboard and separate creation cards.
- `/accounts/new` creates a regular account.
- `/accounts/prop-firm/new` creates a prop-firm account with a four-step wizard.
- `/accounts/:id` shows the account detail dashboard.
- `/accounts/:id/edit` edits a regular account.
- `/accounts/:id/prop-firm/edit` edits a prop-firm account.

Regular account fields stay focused on broker/personal trading setup: account name, broker name, account type, starting balance, current balance, currency, platform, default risk percent, daily/trade limits, loss limits, and notes. The old prop-firm checkbox is no longer part of the regular account form.

Prop-firm account fields live in the dedicated wizard: firm/programme details, account size, market type, evaluation type, platform, phases, profit targets, daily and overall drawdown rules, risk limits, consistency rules, trading restrictions, payout settings, and scaling settings.

## Prop-Firm API
Prop-firm accounts are backed by a normal `TradingAccount` plus related `PropFirmAccount`, `PropFirmPhase`, and `PropFirmProgressSnapshot` records.

- `POST /api/accounts/prop-firm` creates a prop-firm trading account.
- `GET /api/accounts/prop-firm/:id` returns one prop-firm account by trading account id.
- `PUT /api/accounts/prop-firm/:id` updates one prop-firm account and replaces its phases.
- `DELETE /api/accounts/prop-firm/:id` deletes the prop-firm account and its trading account.
- `POST /api/accounts/prop-firm/:id/phases` adds a phase.
- `GET /api/accounts/prop-firm/:id/progress` lists progress snapshots.
- `POST /api/accounts/prop-firm/:id/progress-snapshots` records a progress snapshot.
- `PUT /api/prop-firm-phases/:phaseId` updates a single phase.
- `DELETE /api/prop-firm-phases/:phaseId` deletes a single phase.

## Prop-Firm Migration
Run these after pulling the prop-firm account split:

1. `cd server`
2. `npx prisma migrate deploy`
3. `npx prisma generate`

The migration keeps existing regular accounts intact. Existing rows where `TradingAccount.isPropFirmAccount = true` are marked as `accountCategory = PROP_FIRM`, receive a related `PropFirmAccount` row with the legacy firm, target, drawdown, and minimum trading-day values where available, and receive a legacy phase when old phase-like values exist. The legacy prop-firm columns remain on `TradingAccount` for review and backward compatibility.

## Current Limitations
- Prop-firm templates are generic starting points; traders should verify rules against their official firm agreement before saving.
- Prop-firm dashboard progress uses the latest saved snapshot or current account balance. More advanced pass/fail calculations can be added when richer daily equity and rule-event data is available.
- Backend validation tests cover the new account schemas. The frontend does not currently have an automated test runner configured.

## Future Features
- Optional real AI integration for trade analysis
- Mentor dashboards for Academy accountability tracking
- Automated Paystack subscription tiers
