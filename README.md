# Ghost Panel — Carrier-Grade SMS Hub & Termination Platform

Ghost Panel is a production-ready SMS termination console and routing gateway inspired by carrier panels like MBC Panel, Temp Numbers, and Mobivate. Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and PostgreSQL via Drizzle ORM.

> Storage is Supabase Postgres only. Configure `SUPABASE_DB_URL` before starting the application. See [Supabase deployment](docs/SUPABASE.md).

---

## 🚀 Features

- **Authentication & Security:**
  - Dynamic math captcha challenge widget with one-time server-side ticket verification (5-minute TTL).
  - HttpOnly, SHA-256 DB-backed session tokens (7-day TTL).
  - Role-Based Access Control (`admin`, `user`, `supplier`).
  - Self-healing boot-time schema and account bootstrap (`src/instrumentation.ts`).

- **Live Dashboard & KPI Widgets:**
  - Real-time "SMS Received Today" with live pulsing indicator and sparkline.
  - "Codes / Hits This Week" with week-over-week trend % indicator.
  - Multi-currency "Total Earnings" card with interactive USD / EUR / EGP switcher.
  - Daily traffic bar chart (Received vs Codes) and delivery status donut.

- **SMS Module:**
  - **SMS Numbers:** DID inventory with search, range filtering, status blocking, and E.164 provisioning.
  - **SMS Ranges:** Prefix blocks, buy rates, payout margins, supplier tags, and pausing.
  - **SMS Test Panel:** Sandbox simulator with live client-side OTP parser preview, prefix range resolver, and latency simulation.

- **Client Management:**
  - Downstream client directory, margin % configurations, permissions, and status toggles.

- **SMS Reports & Aggregated Stats:**
  - **SMS Report:** Raw logs, MSISDN, Sender ID, extracted codes, delivery state, latency, and **one-click CSV export**.
  - **SMS Stats:** 14-day aggregated daily volume series and currency revenue breakdown.
  - **SMS Range Stats:** Range leaderboard with hit rates and volume share bars.
  - **SMS Numbers Stats:** Per-DID performance and last-activity timestamps.
  - **SMS Client Stats:** Client traffic attribution and volume share.

- **Financials & Multi-Currency Ledger:**
  - **Payment Requests:** Withdrawal workflow that locks available funds atomically on creation and auto-refunds on admin rejection.
  - **Statements:** Ledger statement with filterable credit/debit views and **CSV export** for USD, EUR, and EGP corridors.

- **Ghost API & Webhooks:**
  - API key rotation (`gk_live_...`).
  - Webhook callback configuration (`sms.inbound` events).
  - IP whitelist management (supports CIDR notation).
  - High-throughput supplier ingestion endpoint (`POST /api/ingest`, up to 100 messages per batch).

- **CLI Search & Routing:**
  - Dialed number lookup using SQL longest-prefix matching.
  - Enforced `TEST_LOOKUP_ONLY` policy for standard accounts.
  - Production route provisioning for administrators.

- **Access Control:**
  - Panel user management: create accounts (`admin`, `user`, `supplier`), change roles, suspend/activate, and rotate passwords with an in-panel random password generator.

---

## 🧬 Merged Ideas (GHOST / Flash-sms / Panel-sma lineage)

This build merges the best of the three legacy Flask panels into the Ghost Panel identity:

- **Branding & Themes** — white-label panel name + 7 accent themes (Ghost, Indigo, Violet, Emerald, Sunset, Crimson, Cyan) or a custom hex accent, applied live across the whole console (ported from the Flash `panel_settings` theme gallery).
- **My Numbers portal** — every account sees the numbers assigned to it, with per-number message counts and one-click CSV download (ported from the Flask `MyAssignedNumbers` pages).
- **Agent allocation limits** — per-range daily limits on number assignment, enforced atomically in the allocation API (ported from the Flash `agent_range_limits` book).
- **Credit Notes** — periodic settlement statements of earnings with generate / mark-paid workflow and CSV export (ported from the Flash `CreditNote` weekly generator).
- **Outbound SMS Send** — single + bulk send from panel numbers via the UI or the external `POST /api/sms/send` API (x-api-key), recorded in the outbound ledger (ported from the Flash `/api/sms/send` endpoints).
- **Live Monitor** — real-time traffic tail with pause/resume, OTP chips and direction badges (ported from the Flask `sms_monitor` page).
- **Backup & Export** — one-click full JSON snapshot with redacted credentials and per-table counts (ported from the Flask admin backup page).
- **Profile** — accounts change their own contact details and password (ported from the Flask agent profile page).

### 📶 Weak-network resilience

The console is tuned for slow / unreliable links — anything that can be resolved client-side never hits the backend:

- **Deduplicated GET cache** (`apiGetCached`) with a short TTL: every page-mount fetch (current user, theme registry, user lists) is served from memory within the TTL window; concurrent mounts share one in-flight request. Any successful write busts the whole cache, so freshly written data is always re-read.
- **Optimistic updates**: status flips (e.g. marking a credit note paid) update the UI locally and only roll back on failure — no refetch round-trip.
- **Visibility-gated polling**: the Live Monitor only polls while its tab is visible, with automatic back-off after failed requests; hidden tabs generate zero traffic.
- **Bulk-first mutations**: allocation, bulk send and credit-note generation are single batched requests instead of N calls.
- **Client-side derivation**: totals, stats and CSV rows are computed from already-loaded data in the browser, not by extra API calls.

### External send API

```bash
curl -X POST https://your-domain.com/api/sms/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: gk_live_YOUR_KEY" \
  -d '{ "number": "+447700900123", "destination": "+201234567890", "cli": "GHOST", "message": "Hello" }'
```

Bulk: pass `destinations` (array, max 100) instead of `destination`.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS v4, Lucide React Icons
- **Database:** PostgreSQL with Drizzle ORM
- **Password Hashing:** Node.js native `crypto.scrypt` with random salt (`salt:hash`)

---

## 📦 Quick Start (Local Setup)

### 1. Prerequisites
- Node.js 18+ or 20+
- PostgreSQL instance running

### 2. Clone & Install
```bash
git clone <your-repo> ghost-panel
cd ghost-panel
npm install
```

### 3. Environment Variables
Create a `.env` file in the root from `.env.example`:
```env
SUPABASE_DB_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@POOLER_HOST:5432/postgres
DB_POOL_MAX=5
PROVIDER_ENCRYPTION_KEY=replace-with-a-long-random-secret
```

### 4. Database Setup
```bash
# Push schema directly to Supabase
npm run db:push
```
*(Note: the app also includes auto-bootstrap in `src/instrumentation.ts` that automatically creates missing tables and seeds default accounts upon server start.)*

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 👑 Default Pre-Configured Accounts

| Username | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `zoro128` | `zoro128` | **admin** | Full administrator / Owner (Access Control, Ranges, Numbers, Approvals) |
| `test123` | `test123` | **user** | Standard client user (Test Lookups, Reports, Withdrawal requests) |

*(You can create more accounts or modify passwords directly inside the **Access Control** tab.)*

---

## 📡 API Ingestion Endpoint

Suppliers can stream inbound SMS via HTTP REST:

```bash
curl -X POST https://your-domain.com/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: gk_live_YOUR_KEY" \
  -d '{
    "msisdn": "+447700900123",
    "senderId": "VERIFY",
    "body": "Your verification code is 481516."
  }'
```

Batch ingestion (up to 100 records) is also supported by sending a JSON array `[...]`.

---

## 📂 Project Structure

```
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                # Auth guard + Shell wrapper
│   │   │   ├── dashboard/page.tsx        # 3 KPI cards, traffic chart, recent logs
│   │   │   ├── sms/
│   │   │   │   ├── numbers/page.tsx      # DIDs inventory
│   │   │   │   ├── ranges/page.tsx       # Prefix ranges & buy rates
│   │   │   │   └── test/page.tsx         # Sandbox injection & live parser
│   │   │   ├── clients/page.tsx          # Downstream client management
│   │   │   ├── reports/
│   │   │   │   ├── sms-report/page.tsx   # Raw logs + CSV export
│   │   │   │   ├── sms-stats/page.tsx    # 14-day aggregated volume
│   │   │   │   ├── range-stats/page.tsx  # Per-range throughput
│   │   │   │   ├── number-stats/page.tsx # Per-DID yield
│   │   │   │   └── client-stats/page.tsx # Per-client volume
│   │   │   ├── financials/
│   │   │   │   ├── payment-requests/page.tsx # Withdrawal request engine
│   │   │   │   └── statements/[currency]/page.tsx # Multi-currency ledger
│   │   │   ├── ghost-api/page.tsx        # API keys, webhooks, IP whitelist
│   │   │   ├── cli-search/page.tsx       # Longest-prefix route lookup
│   │   │   └── access/page.tsx           # User & role management (admin-only)
│   │   ├── api/
│   │   │   ├── auth/ (login, logout)
│   │   │   ├── captcha/
│   │   │   ├── dashboard/
│   │   │   ├── sms/ (numbers, ranges, messages, test, stats)
│   │   │   ├── clients/
│   │   │   ├── payment-requests/
│   │   │   ├── statements/
│   │   │   ├── settings/
│   │   │   ├── cli-routes/
│   │   │   ├── users/
│   │   │   ├── ingest/
│   │   │   └── health/
│   │   ├── login/page.tsx                # Math-captcha login screen
│   │   ├── globals.css                   # Custom styles, animations, theme
│   │   └── layout.tsx                    # Root HTML + Google Fonts
│   ├── components/
│   │   ├── shell.tsx                     # Dashboard responsive layout controller
│   │   ├── sidebar.tsx                   # Collapsible grouped nav with icon-rail
│   │   ├── topbar.tsx                    # Header, currency switcher, balance, profile
│   │   ├── ui.tsx                        # Shared UI component kit
│   │   ├── charts.tsx                    # SVG Sparklines, Bar charts, Donut charts
│   │   └── login-screen.tsx              # Interactive login form & captcha widget
│   ├── db/
│   │   ├── index.ts                      # PostgreSQL pool connection
│   │   └── schema.ts                     # Drizzle ORM schema definitions
│   ├── lib/
│   │   ├── auth.ts                       # Sessions, scrypt hashing, cookie management
│   │   ├── captcha.ts                    # Dynamic math challenge generator
│   │   ├── http.ts                       # Response helpers, CSV generator, auth guards
│   │   ├── sms.ts                        # OTP extractor & longest prefix matcher
│   │   ├── client.ts                     # Client-side API fetch wrappers & formatters
│   │   ├── roles.ts                      # Role constants & validation regex
│   │   └── seed.ts                       # Self-healing DDL & seed script
│   └── instrumentation.ts                # Server startup hook
└── drizzle.config.json
```

---

## ☁️ Deployment: Supabase + GitHub + Vercel

1. **Supabase (database)** — create a project at [supabase.com](https://supabase.com), then copy the connection string
   (Project Settings → Database → Connection string → URI, use the *Connection pooling* / transaction-mode host for serverless).
   It looks like `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres`.
2. **GitHub** — push this repo to GitHub.
3. **Vercel** — at [vercel.com/new](https://vercel.com/new) import the GitHub repo and set the Environment Variables:
   | Variable | Value |
   | :--- | :--- |
   | `SUPABASE_DB_URL` | the Supabase connection string from step 1 |
   | `PROVIDER_ENCRYPTION_KEY` | a long random secret (used to encrypt provider credentials) |
   | `DB_POOL_MAX` | optional, defaults to 5 — raise for production traffic |
4. Deploy. On boot the app **self-heals the full schema and seeds the operator accounts** (`src/instrumentation.ts`), so no manual migrations are needed.
5. Verify `GET /api/health` returns `{ ok: true }`.

> Supabase specifics are documented in [docs/SUPABASE.md](docs/SUPABASE.md).
