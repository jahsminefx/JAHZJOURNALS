📈 JAHZJOURNALS

JAHZJOURNALS is a premium, mobile-first Forex trading journal and analytics engine engineered specifically for modern, data-driven traders. Track performance, analyze risk, pass prop-firm evaluations, and catalog trade screenshots and psychological states seamlessly.

🛠️ Tech Stack

Frontend

Framework: React & Vite

Styling: Tailwind CSS (Fluid responsive, mobile-first design)

Data Visualization: Recharts (Interactive equity curves, drawdowns, and analytics charts)

Form Handling: React Hook Form & Zod (Strict schema validation)

Tables: TanStack Table (Robust sorting, filtering, and pagination)

Backend

Engine: Node.js & Express

Database / ORM: PostgreSQL & Prisma ORM

Authentication: JSON Web Tokens (JWT)

Media Hosting: Cloudinary (Automatic trade screenshot uploads)

📂 Folder Structure

The repository is structured as a monorepo for effortless local development:

jahzjournals/
├── client/              # React Vite Frontend SPA
│   ├── src/             # Application source code
│   └── package.json     # Frontend dependencies
└── server/              # Node.js Express Backend API
    ├── prisma/          # Prisma schema, migrations, and seeds
    ├── src/             # API routes, controllers, and services
    └── package.json     # Backend dependencies


⚙️ Setup & Installation

Follow these steps to get your local environment configured:

1. Database Setup

Ensure you have a running instance of PostgreSQL.

Create a fresh target database:

CREATE DATABASE jahzjournals;


2. Backend Configuration

Navigate to the server folder:

cd server


Install dependencies:

npm install


Copy the template environment file and populate your variables:

cp .env.example .env


🔑 Required keys inside .env: DATABASE_URL, JWT_SECRET, and Cloudinary API credentials.

Run migrations to provision the schema:

npx prisma migrate dev


Generate the Prisma Client:

npx prisma generate


(Optional) Seed the database with sample metrics and rules:

node prisma/seed.js


Start the development server:

npm run dev


3. Frontend Configuration

Navigate to the client folder in a new terminal window:

cd client


Install dependencies:

npm install


Boot up the Vite preview engine:

npm run dev


💼 Account Management Architecture

JAHZJOURNALS splits trading accounts into two specialized categories, ensuring optimized user flows:

                  ┌──────────────────┐
                  │  TradingAccount  │
                  └────────┬─────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
   ┌──────────────────┐        ┌──────────────────┐
   │ Regular Account  │        │ Prop-Firm Setup  │
   │ (Personal Setup) │        │ (4-Step Wizard)  │
   └──────────────────┘        └────────┬─────────┘
                                        ▼
                               ┌──────────────────┐
                               │  PropFirmAccount │
                               └────────┬─────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
               ┌──────────────────┐          ┌──────────────────┐
               │  PropFirmPhase   │          │ ProgressSnapshot │
               └──────────────────┘          └──────────────────┘


Regular Accounts

Focuses on standard broker-aligned setups. Features fields such as:

Account Name & Broker Platform

Base Currency & Starting/Current Balance

Daily Loss/Trade limits & customized Risk Percentages.

Prop-Firm Accounts

Utilizes a state-managed 4-Step Wizard flow to capture compliance metrics:

Firm, program details, and initial evaluation sizes.

Target milestones and overall/daily drawdown limitations.

Consistency metrics, trading restriction policies, and scaling schedules.

🔌 API Reference Matrix

All APIs are secured via JWT middleware except public authentication endpoints.

Authentication & Core Systems

Method

Endpoint

Description

POST

/api/auth/register

Register a new trader account

POST

/api/auth/login

Authenticate and retrieve token

GET

/api/auth/me

Fetch active user credentials

POST

/api/contact-messages

Public messaging pipeline

Account Operations

Method

Endpoint

Description

GET

/api/accounts

Retrieve user accounts

POST

/api/accounts

Create a regular trading account

PUT

/api/accounts/:id

Update standard account details

DELETE

/api/accounts/:id

Delete regular account

Prop-Firm Dedicated Suite

Method

Endpoint

Description

POST

/api/accounts/prop-firm

Initialize a prop-firm framework account

GET

/api/accounts/prop-firm/:id

Retrieve prop-firm properties by standard ID

PUT

/api/accounts/prop-firm/:id

Update prop-firm records & cycle phases

DELETE

/api/accounts/prop-firm/:id

Safely strip prop-firm schema links

POST

/api/accounts/prop-firm/:id/phases

Direct-inject target evaluation phase

GET

/api/accounts/prop-firm/:id/progress

Fetch chronological account balance history

POST

/api/accounts/prop-firm/:id/progress-snapshots

Record performance waypoint

PUT

/api/prop-firm-phases/:phaseId

Update single target milestones

DELETE

/api/prop-firm-phases/:phaseId

Prune individual verification phase

Performance, Analytics, & Journal Entries

Method

Endpoint

Description

POST

/api/trades

Log a custom journal entry

DELETE

/api/screenshots/:id

Remove image attachment with Cloudinary cleanup

GET

/api/analytics/dashboard

Aggregate dynamic statistics and charts

GET

/api/weekly-reviews

Generate customized weekly metric reports

💾 Prop-Firm Migration Blueprint

If updating from a legacy version containing unified schemas, execute the migration pipeline to safely convert existing schemas without data loss:

cd server
npx prisma migrate deploy
npx prisma generate


⚠️ Backward Compatibility: All existing accounts marked isPropFirmAccount = true will safely upgrade to standard accounts with an mapped category value of PROP_FIRM. Related metadata rows will be created based on your legacy configurations automatically.

📁 File Handling Architecture

graph LR
    User[Trader Uploads File] --> Screen{Is Image?}
    Screen -- Yes [Screenshot] --> Cloudinary((Cloudinary Cloud))
    Screen -- No [CSV/Report] --> Local[Local Storage: server/uploads/]


Screenshots: Uploaded via the nested trade routes directly to Cloudinary. Deletions via /api/screenshots trigger an asynchronous cleanup script that de-allocates storage on the CDN side.

Reporting & Legacy CSV Files: Managed using disk storage endpoints within the server/uploads/ directory to facilitate simplified deployments.

🧪 Verification & Testing

Verify system security parameters, evaluation rules, target margins, and database interactions through our standard test harness:

cd server
npm run test


Our testing suites comprehensively run verification on:

Account margin parameters and transaction constraints.

Multi-phase rules and tracking automation limits.

Profit calculation snapshots and auto-releases.

⚠️ Current Limitations

Template Buffering: Built-in prop-firm evaluation templates are advisory. Confirm requirements with your provider before applying rules.

Progress Tracking: Interactive charts rely directly on saved state snapshots or daily balance points. Full automated rule violations tracking is currently pending.

🔮 Future Roadmap

[ ] Automated real-time AI trading companion and strategy critique.

[ ] Multi-tenant Mentor Dashboard for proprietary educational networks.

[ ] Integrated subscription pipeline via Paystack webhooks.

[ ] Direct analytical CSV export parameters.

[ ] Interactive notifications and SMS limits-warning alerts.
