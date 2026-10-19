import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("Set SUPABASE_DB_URL before running Drizzle commands.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dbCredentials: { url },
  strict: true,
});
