import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Auth & access control                                             */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 128 }),
  email: varchar("email", { length: 128 }),
  role: varchar("role", { length: 16 }).notNull().default("user"), // admin | user | supplier
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | suspended
  balanceUsd: numeric("balance_usd", { precision: 14, scale: 2 }).notNull().default("0"),
  balanceEur: numeric("balance_eur", { precision: 14, scale: 2 }).notNull().default("0"),
  balanceEgp: numeric("balance_egp", { precision: 14, scale: 2 }).notNull().default("0"),
  apiKey: varchar("api_key", { length: 80 }),
  webhookUrl: text("webhook_url"),
  ipWhitelist: jsonb("ip_whitelist").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const captchaTickets = pgTable("captcha_tickets", {
  id: varchar("id", { length: 40 }).primaryKey(),
  answerHash: varchar("answer_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/*  SMS termination core                                              */
/* ------------------------------------------------------------------ */

export const smsRanges = pgTable("sms_ranges", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  prefix: varchar("prefix", { length: 32 }).notNull(),
  country: varchar("country", { length: 64 }).notNull(),
  network: varchar("network", { length: 64 }),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  rate: numeric("rate", { precision: 12, scale: 4 }).notNull().default("0"),
  payout: numeric("payout", { precision: 12, scale: 4 }).notNull().default("0"),
  supplier: varchar("supplier", { length: 64 }),
  networkType: varchar("network_type", { length: 20 }), // mobile | fixed | voip
  costPerSms: numeric("cost_per_sms", { precision: 12, scale: 4 }).notNull().default("0"),
  dailyLimit: integer("daily_limit").notNull().default(50),
  memo: text("memo"),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | paused
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const smsNumbers = pgTable(
  "sms_numbers",
  {
    id: serial("id").primaryKey(),
    msisdn: varchar("msisdn", { length: 24 }).notNull().unique(),
    rangeId: integer("range_id").references(() => smsRanges.id, { onDelete: "set null" }),
    assignedClientId: integer("assigned_client_id"),
    assignedUserId: integer("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    status: varchar("status", { length: 16 }).notNull().default("active"), // active | paused | blocked
    source: varchar("source", { length: 64 }),
    notes: text("notes"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sms_numbers_range_idx").on(t.rangeId)]
);

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 128 }),
  company: varchar("company", { length: 128 }),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | suspended
  marginPct: numeric("margin_pct", { precision: 6, scale: 2 }).notNull().default("0"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Saved payout endpoints owned by a panel account. The destination is encrypted at rest. */
export const payoutAccounts = pgTable(
  "payout_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 96 }).notNull(),
    method: varchar("method", { length: 32 }).notNull(),
    accountHolder: varchar("account_holder", { length: 128 }),
    destinationCiphertext: text("destination_ciphertext").notNull(),
    destinationHint: varchar("destination_hint", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payout_accounts_user_idx").on(t.userId, t.status)]
);

export const smsMessages = pgTable(
  "sms_messages",
  {
    id: serial("id").primaryKey(),
    msisdn: varchar("msisdn", { length: 24 }).notNull(),
    senderId: varchar("sender_id", { length: 24 }),
    body: text("body").notNull(),
    otpCode: varchar("otp_code", { length: 16 }),
    status: varchar("status", { length: 16 }).notNull().default("received"), // received | delivered | rejected | expired
    latencyMs: integer("latency_ms"),
    rate: numeric("rate", { precision: 12, scale: 4 }).notNull().default("0"),
    payout: numeric("payout", { precision: 12, scale: 4 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    supplier: varchar("supplier", { length: 64 }),
    providerId: integer("provider_id"),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    numberId: integer("number_id").references(() => smsNumbers.id, { onDelete: "set null" }),
    rangeId: integer("range_id").references(() => smsRanges.id, { onDelete: "set null" }),
    isTest: boolean("is_test").notNull().default(false),
    direction: varchar("direction", { length: 12 }).notNull().default("inbound"), // inbound | outbound
    destination: varchar("destination", { length: 24 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sms_messages_created_idx").on(t.createdAt),
    index("sms_messages_status_idx").on(t.status),
    index("sms_messages_msisdn_idx").on(t.msisdn),
  ]
);

/* ------------------------------------------------------------------ */
/*  Financials                                                        */
/* ------------------------------------------------------------------ */

export const paymentRequests = pgTable(
  "payment_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    method: varchar("method", { length: 32 }).notNull().default("bank"), // bank | paypal | crypto
    destination: text("destination").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | approved | rejected
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("payment_requests_user_idx").on(t.userId)]
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    direction: varchar("direction", { length: 8 }).notNull(), // credit | debit
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    description: text("description").notNull(),
    reference: varchar("reference", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ledger_user_currency_idx").on(t.userId, t.currency),
    index("ledger_created_idx").on(t.createdAt),
  ]
);

/* ------------------------------------------------------------------ */
/*  CLI routing                                                       */
/* ------------------------------------------------------------------ */

export const cliRoutes = pgTable("cli_routes", {
  id: serial("id").primaryKey(),
  prefix: varchar("prefix", { length: 24 }).notNull().unique(),
  country: varchar("country", { length: 64 }).notNull(),
  network: varchar("network", { length: 64 }),
  rate: numeric("rate", { precision: 12, scale: 4 }).notNull().default("0"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  supplier: varchar("supplier", { length: 64 }),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** SMS gateway/provider connections. Credentials are encrypted by the API layer. */
export const smsProviders = pgTable("sms_providers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  protocol: varchar("protocol", { length: 32 }).notNull(),
  endpoint: text("endpoint"),
  username: varchar("username", { length: 128 }),
  credentials: text("credentials"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  priority: integer("priority").notNull().default(100),
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(30),
  healthStatus: varchar("health_status", { length: 24 }).notNull().default("not_checked"),
  healthNote: text("health_note"),
  lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
  lastLatencyMs: integer("last_latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Immutable record of administrative changes to sensitive operating resources. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 48 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_events_entity_idx").on(t.entityType, t.createdAt)]
);

/** Operator notices shown to the selected panel audience. */
export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    tone: varchar("tone", { length: 16 }).notNull().default("info"),
    audience: varchar("audience", { length: 16 }).notNull().default("all"),
    status: varchar("status", { length: 16 }).notNull().default("published"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("announcements_status_idx").on(t.status, t.publishedAt)]
);

/* ------------------------------------------------------------------ */
/*  White-label branding & themes (merged from Flash/Panel-sma)       */
/* ------------------------------------------------------------------ */

/** Singleton row (id = 1) holding the panel's white-label identity. */
export const panelSettings = pgTable("panel_settings", {
  id: serial("id").primaryKey(),
  panelName: varchar("panel_name", { length: 100 }).notNull().default("Ghost Panel"),
  primaryColor: varchar("primary_color", { length: 9 }).notNull().default("#2563eb"),
  theme: varchar("theme", { length: 30 }).notNull().default("ghost"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/*  Tenant sub-panels (user-managed white-label boards)              */
/* ------------------------------------------------------------------ */

/**
 * A user-owned sub-panel ("لوح"): every account can create its own boards
 * with their own accent identity and a private sync key. Users only ever
 * see the panels they own; admins see all.
 */
export const panelBoards = pgTable(
  "panel_boards",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    accentColor: varchar("accent_color", { length: 9 }).notNull().default("#2563eb"),
    status: varchar("status", { length: 16 }).notNull().default("active"), // active | suspended
    syncKey: varchar("sync_key", { length: 64 }).notNull(),
    notes: varchar("notes", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("panel_boards_owner_idx").on(t.ownerId),
    index("panel_boards_sync_key_idx").on(t.syncKey),
  ]
);

/* ------------------------------------------------------------------ */
/*  Agent range limits & credit notes (merged from Panel-sma)        */
/* ------------------------------------------------------------------ */

/** Per-account daily/total allocation quota for a range (agent limit book). */
export const agentRangeLimits = pgTable(
  "agent_range_limits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rangeId: integer("range_id")
      .notNull()
      .references(() => smsRanges.id, { onDelete: "cascade" }),
    dailyLimit: integer("daily_limit").notNull().default(50),
    totalLimit: integer("total_limit").notNull().default(1000),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_range_limits_uq").on(t.userId, t.rangeId)]
);

/** Periodic settlement statement of earnings (credit note workflow). */
export const creditNotes = pgTable(
  "credit_notes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | paid
    remarks: varchar("remarks", { length: 255 }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("credit_notes_user_idx").on(t.userId),
    index("credit_notes_status_idx").on(t.status),
  ]
);

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type SmsRange = typeof smsRanges.$inferSelect;
export type SmsNumber = typeof smsNumbers.$inferSelect;
export type SmsMessage = typeof smsMessages.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type PayoutAccount = typeof payoutAccounts.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type CliRoute = typeof cliRoutes.$inferSelect;
export type SmsProvider = typeof smsProviders.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type PanelSettings = typeof panelSettings.$inferSelect;
export type AgentRangeLimit = typeof agentRangeLimits.$inferSelect;
export type CreditNote = typeof creditNotes.$inferSelect;
export type PanelBoard = typeof panelBoards.$inferSelect;
