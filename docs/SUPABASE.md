# Supabase database deployment

Ghost Panel uses Supabase Postgres as its only runtime data store. The browser never receives a database password or a Supabase service key.

## 1. Create the connection variable

In **Supabase Dashboard → Connect**, copy one of these PostgreSQL connection strings:

- **Session Pooler** for a persistent Node.js server or an IPv4-only deployment.
- **Transaction Pooler** for serverless deployments. Keep `DB_POOL_MAX=1` for this mode.
- **Direct connection** for a long-running server with IPv6 connectivity.

Set it in the deployment environment as `SUPABASE_DB_URL`. The password is part of this private server-side variable and must never be exposed with `NEXT_PUBLIC_`.

## 2. Apply the schema

```bash
npm run db:push
```

The application also runs an idempotent bootstrap at startup for existing deployments. Use `db:push` during normal releases so schema changes are reviewed and applied before traffic reaches the instance.

## 3. Production secrets

Set `PROVIDER_ENCRYPTION_KEY` to a stable, high-entropy value. Changing it makes previously stored provider secrets unreadable.

## 4. Backups

Use the Supabase dashboard backups on paid plans, or create a logical export with the Supabase CLI:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql --data-only
```
