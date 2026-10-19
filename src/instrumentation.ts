/**
 * Server boot hook — runs once per Node.js server instance.
 * Guarantees the database schema and operator accounts exist before
 * traffic is served, so every (re)deployment self-heals.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapDatabase } = await import("@/lib/seed");
  await bootstrapDatabase();
}
