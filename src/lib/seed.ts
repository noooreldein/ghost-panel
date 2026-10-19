import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ledgerEntries, panelSettings, users } from "@/db/schema";
import { generateApiKey, hashPassword } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Idempotent DDL bootstrap — guarantees the schema exists on any    */
/*  fresh database the server boots against.                          */
/* ------------------------------------------------------------------ */

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    username varchar(64) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    full_name varchar(128),
    email varchar(128),
    role varchar(16) NOT NULL DEFAULT 'user',
    status varchar(16) NOT NULL DEFAULT 'active',
    balance_usd numeric(14,2) NOT NULL DEFAULT 0,
    balance_eur numeric(14,2) NOT NULL DEFAULT 0,
    balance_egp numeric(14,2) NOT NULL DEFAULT 0,
    api_key varchar(80),
    webhook_url text,
    ip_whitelist jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id serial PRIMARY KEY,
    token_hash varchar(128) NOT NULL UNIQUE,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE cascade,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS captcha_tickets (
    id varchar(40) PRIMARY KEY,
    answer_hash varchar(128) NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sms_ranges (
    id serial PRIMARY KEY,
    name varchar(128) NOT NULL,
    prefix varchar(32) NOT NULL,
    country varchar(64) NOT NULL,
    network varchar(64),
    currency varchar(3) NOT NULL DEFAULT 'USD',
    rate numeric(12,4) NOT NULL DEFAULT 0,
    payout numeric(12,4) NOT NULL DEFAULT 0,
    supplier varchar(64),
    status varchar(16) NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sms_numbers (
    id serial PRIMARY KEY,
    msisdn varchar(24) NOT NULL UNIQUE,
    range_id integer REFERENCES sms_ranges(id) ON DELETE set null,
    status varchar(16) NOT NULL DEFAULT 'active',
    source varchar(64),
    notes text,
    last_message_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sms_numbers_range_idx ON sms_numbers(range_id)`,
  `CREATE TABLE IF NOT EXISTS clients (
    id serial PRIMARY KEY,
    name varchar(128) NOT NULL,
    email varchar(128),
    company varchar(128),
    status varchar(16) NOT NULL DEFAULT 'active',
    margin_pct numeric(6,2) NOT NULL DEFAULT 0,
    permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE sms_numbers ADD COLUMN IF NOT EXISTS assigned_client_id integer REFERENCES clients(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS sms_numbers_assigned_client_idx ON sms_numbers(assigned_client_id)`,
  `CREATE TABLE IF NOT EXISTS sms_messages (
    id serial PRIMARY KEY,
    msisdn varchar(24) NOT NULL,
    sender_id varchar(24),
    body text NOT NULL,
    otp_code varchar(16),
    status varchar(16) NOT NULL DEFAULT 'received',
    latency_ms integer,
    rate numeric(12,4) NOT NULL DEFAULT 0,
    payout numeric(12,4) NOT NULL DEFAULT 0,
    currency varchar(3) NOT NULL DEFAULT 'USD',
    supplier varchar(64),
    client_id integer REFERENCES clients(id) ON DELETE set null,
    number_id integer REFERENCES sms_numbers(id) ON DELETE set null,
    range_id integer REFERENCES sms_ranges(id) ON DELETE set null,
    is_test boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sms_messages_created_idx ON sms_messages(created_at)`,
  `CREATE INDEX IF NOT EXISTS sms_messages_status_idx ON sms_messages(status)`,
  `CREATE INDEX IF NOT EXISTS sms_messages_msisdn_idx ON sms_messages(msisdn)`,
  `CREATE TABLE IF NOT EXISTS payment_requests (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE cascade,
    amount numeric(14,2) NOT NULL,
    currency varchar(3) NOT NULL DEFAULT 'USD',
    method varchar(32) NOT NULL DEFAULT 'bank',
    destination text NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'pending',
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS payment_requests_user_idx ON payment_requests(user_id)`,
  `CREATE TABLE IF NOT EXISTS ledger_entries (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE cascade,
    currency varchar(3) NOT NULL,
    direction varchar(8) NOT NULL,
    amount numeric(14,2) NOT NULL,
    description text NOT NULL,
    reference varchar(64),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS ledger_user_currency_idx ON ledger_entries(user_id, currency)`,
  `CREATE INDEX IF NOT EXISTS ledger_created_idx ON ledger_entries(created_at)`,
  `CREATE TABLE IF NOT EXISTS cli_routes (
    id serial PRIMARY KEY,
    prefix varchar(24) NOT NULL UNIQUE,
    country varchar(64) NOT NULL,
    network varchar(64),
    rate numeric(12,4) NOT NULL DEFAULT 0,
    currency varchar(3) NOT NULL DEFAULT 'USD',
    supplier varchar(64),
    status varchar(16) NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sms_providers (
    id serial PRIMARY KEY,
    name varchar(128) NOT NULL,
    protocol varchar(32) NOT NULL,
    endpoint text,
    username varchar(128),
    credentials text,
    status varchar(16) NOT NULL DEFAULT 'active',
    priority integer NOT NULL DEFAULT 100,
    poll_interval_seconds integer NOT NULL DEFAULT 30,
    health_status varchar(24) NOT NULL DEFAULT 'not_checked',
    health_note text,
    last_health_check_at timestamptz,
    last_latency_ms integer,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE sms_providers ADD COLUMN IF NOT EXISTS poll_interval_seconds integer NOT NULL DEFAULT 30`,
  `ALTER TABLE sms_providers ADD COLUMN IF NOT EXISTS health_status varchar(24) NOT NULL DEFAULT 'not_checked'`,
  `ALTER TABLE sms_providers ADD COLUMN IF NOT EXISTS health_note text`,
  `ALTER TABLE sms_providers ADD COLUMN IF NOT EXISTS last_health_check_at timestamptz`,
  `ALTER TABLE sms_providers ADD COLUMN IF NOT EXISTS last_latency_ms integer`,
  `ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS provider_id integer REFERENCES sms_providers(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS sms_messages_provider_idx ON sms_messages(provider_id)`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id serial PRIMARY KEY,
    actor_id integer REFERENCES users(id) ON DELETE SET NULL,
    action varchar(64) NOT NULL,
    entity_type varchar(48) NOT NULL,
    entity_id varchar(64),
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_type, created_at)`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id serial PRIMARY KEY,
    title varchar(180) NOT NULL,
    body text NOT NULL,
    tone varchar(16) NOT NULL DEFAULT 'info',
    audience varchar(16) NOT NULL DEFAULT 'all',
    status varchar(16) NOT NULL DEFAULT 'published',
    created_by integer REFERENCES users(id) ON DELETE SET NULL,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS announcements_status_idx ON announcements(status, published_at)`,
  `CREATE TABLE IF NOT EXISTS panel_settings (
    id serial PRIMARY KEY,
    panel_name varchar(100) NOT NULL DEFAULT 'Ghost Panel',
    primary_color varchar(9) NOT NULL DEFAULT '#2563eb',
    theme varchar(30) NOT NULL DEFAULT 'ghost',
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS agent_range_limits (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    range_id integer NOT NULL REFERENCES sms_ranges(id) ON DELETE CASCADE,
    daily_limit integer NOT NULL DEFAULT 50,
    total_limit integer NOT NULL DEFAULT 1000,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS agent_range_limits_uq ON agent_range_limits(user_id, range_id)`,
  `CREATE TABLE IF NOT EXISTS credit_notes (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    amount numeric(14, 2) NOT NULL DEFAULT 0,
    currency varchar(3) NOT NULL DEFAULT 'USD',
    status varchar(16) NOT NULL DEFAULT 'pending',
    remarks varchar(255),
    issued_at timestamptz NOT NULL DEFAULT now(),
    due_date timestamptz,
    paid_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS credit_notes_user_idx ON credit_notes(user_id)`,
  `CREATE INDEX IF NOT EXISTS credit_notes_status_idx ON credit_notes(status)`,
  `ALTER TABLE sms_ranges ADD COLUMN IF NOT EXISTS network_type varchar(20)`,
  `ALTER TABLE sms_ranges ADD COLUMN IF NOT EXISTS cost_per_sms numeric(12, 4) NOT NULL DEFAULT 0`,
  `ALTER TABLE sms_ranges ADD COLUMN IF NOT EXISTS daily_limit integer NOT NULL DEFAULT 50`,
  `ALTER TABLE sms_ranges ADD COLUMN IF NOT EXISTS memo text`,
  `ALTER TABLE sms_numbers ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE sms_numbers ADD COLUMN IF NOT EXISTS assigned_at timestamptz`,
  `ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS direction varchar(12) NOT NULL DEFAULT 'inbound'`,
  `ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS destination varchar(24)`,
  `CREATE INDEX IF NOT EXISTS sms_numbers_user_idx ON sms_numbers(assigned_user_id)`,
  `CREATE TABLE IF NOT EXISTS payout_accounts (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label varchar(96) NOT NULL,
    method varchar(32) NOT NULL,
    account_holder varchar(128),
    destination_ciphertext text NOT NULL,
    destination_hint varchar(32) NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS payout_accounts_user_idx ON payout_accounts(user_id, status)`,
];

/* ------------------------------------------------------------------ */
/*  Seed operator accounts (idempotent — never overwrites existing)   */
/* ------------------------------------------------------------------ */

interface SeedAccount {
  username: string;
  password: string;
  fullName: string;
  role: string;
  balances: Partial<Record<"USD" | "EUR" | "EGP", number>>;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  { username: "zoro128", password: "zoro128", fullName: "Zoro Admin", role: "admin", balances: { USD: 500, EUR: 300, EGP: 10000 } },
  { username: "test123", password: "test123", fullName: "Test User", role: "user", balances: { USD: 100 } },
];

async function seedAccounts(): Promise<void> {
  for (const acc of SEED_ACCOUNTS) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, acc.username)).limit(1);
    if (existing[0]) continue;

    const [created] = await db
      .insert(users)
      .values({
        username: acc.username,
        passwordHash: hashPassword(acc.password),
        fullName: acc.fullName,
        role: acc.role,
        apiKey: generateApiKey(),
        balanceUsd: String(acc.balances.USD ?? 0),
        balanceEur: String(acc.balances.EUR ?? 0),
        balanceEgp: String(acc.balances.EGP ?? 0),
      })
      .returning({ id: users.id });

    for (const [currency, amount] of Object.entries(acc.balances)) {
      await db.insert(ledgerEntries).values({
        userId: created.id,
        currency,
        direction: "credit",
        amount: String(amount),
        description: "Opening balance credit (system adjustment)",
        reference: "ADJ-OPEN",
      });
    }
  }
}

async function seedPanelSettings(): Promise<void> {
  const existing = await db.select({ id: panelSettings.id }).from(panelSettings).limit(1);
  if (existing[0]) return;
  await db.insert(panelSettings).values({ id: 1, panelName: "Ghost Panel", primaryColor: "#2563eb", theme: "ghost" });
}

/**
 * Boot-time bootstrap: makes any environment the server starts against
 * fully operational — schema + operator accounts self-heal on restart.
 */
export async function bootstrapDatabase(retries = 6): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      for (const statement of DDL) {
        await db.execute(sql.raw(statement));
      }
      await seedAccounts();
      await seedPanelSettings();
      console.log("[ghost] bootstrap ok — schema verified, accounts seeded");
      return;
    } catch (err) {
      console.error(`[ghost] bootstrap attempt ${attempt}/${retries} failed`, err);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
