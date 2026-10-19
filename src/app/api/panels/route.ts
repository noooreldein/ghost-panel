import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { panelBoards, users } from "@/db/schema";
import { generateApiKey } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, requireAuth, str } from "@/lib/http";
import { isAdmin } from "@/lib/scope";

export const dynamic = "force-dynamic";

const MAX_BOARDS_PER_USER = 10;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,99}$/u;
const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * User-owned sub-panels. Every account manages its own boards; the list is
 * strictly scoped by owner so nobody can ever read another account's panel
 * or its private sync key.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const base = db
    .select({
      id: panelBoards.id,
      ownerId: panelBoards.ownerId,
      ownerName: users.username,
      name: panelBoards.name,
      accentColor: panelBoards.accentColor,
      status: panelBoards.status,
      syncKey: panelBoards.syncKey,
      notes: panelBoards.notes,
      createdAt: panelBoards.createdAt,
      updatedAt: panelBoards.updatedAt,
    })
    .from(panelBoards)
    .leftJoin(users, eq(panelBoards.ownerId, users.id));

  const rows = auth.user!.role === "admin"
    ? await base.orderBy(desc(panelBoards.id)).limit(200)
    : await base.where(eq(panelBoards.ownerId, auth.user!.id)).orderBy(desc(panelBoards.id)).limit(100);

  return ok({
    total: rows.length,
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
  });
}

/** Create a board owned by the caller. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const name = str(body.name).trim();
  const accentColor = str(body.accentColor) || "#2563eb";
  const notes = str(body.notes) || null;

  if (!NAME_RE.test(name)) return fail("Panel name must be 2-100 letters, digits, spaces, . _ or -.");
  if (!HEX_RE.test(accentColor)) return fail("Accent color must be a hex value like #2563eb.");
  if (notes && notes.length > 255) return fail("Notes are too long (max 255).");

  const [owned] = await db.select({ value: count() }).from(panelBoards).where(eq(panelBoards.ownerId, auth.user!.id));
  if ((owned?.value ?? 0) >= MAX_BOARDS_PER_USER) return fail(`Panel limit reached (${MAX_BOARDS_PER_USER} per account).`, 429);

  const [row] = await db
    .insert(panelBoards)
    .values({ ownerId: auth.user!.id, name, accentColor, notes, syncKey: `gpnl_${generateApiKey().replace(/^gk_/, "")}${Date.now().toString(36)}` })
    .returning();

  await audit(auth.user!.id, "panel_board.created", "panel_boards", String(row.id), { name, accentColor });
  return ok({ row: { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } }, 201);
}

/** Update an owned board (name, accent, notes, status or rotate sync key). */
export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return fail("Panel id is invalid.");

  const [row] = await db.select().from(panelBoards).where(eq(panelBoards.id, id)).limit(1);
  if (!row) return fail("Panel not found.", 404);
  if (!isAdmin(auth.user!) && row.ownerId !== auth.user!.id) return fail("This panel belongs to another account.", 403);

  const patch: Partial<typeof panelBoards.$inferInsert> = {};
  if (body.name !== undefined) {
    const name = str(body.name).trim();
    if (!NAME_RE.test(name)) return fail("Panel name must be 2-100 letters, digits, spaces, . _ or -.");
    patch.name = name;
  }
  if (body.accentColor !== undefined) {
    const c = str(body.accentColor);
    if (!HEX_RE.test(c)) return fail("Accent color must be a hex value like #2563eb.");
    patch.accentColor = c;
  }
  if (body.notes !== undefined) {
    const notes = str(body.notes) || null;
    if (notes && notes.length > 255) return fail("Notes are too long (max 255).");
    patch.notes = notes;
  }
  if (body.status !== undefined) {
    const status = str(body.status);
    if (!["active", "suspended"].includes(status)) return fail("Status must be active or suspended.");
    patch.status = status;
  }
  if (body.rotateKey === true) {
    patch.syncKey = `gpnl_${generateApiKey().replace(/^gk_/, "")}${Date.now().toString(36)}`;
  }

  if (Object.keys(patch).length === 0) return fail("Nothing to update.");

  const [updated] = await db
    .update(panelBoards)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(panelBoards.id, id))
    .returning();

  await audit(auth.user!.id, "panel_board.updated", "panel_boards", String(id), {
    fields: Object.keys(patch),
    rotatedKey: body.rotateKey === true,
  });
  return ok({ row: { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() } });
}

/** Delete a board. Owners may delete their own; admins may delete any. */
export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return fail("Panel id is invalid.");

  const [row] = await db.select({ id: panelBoards.id, ownerId: panelBoards.ownerId, name: panelBoards.name }).from(panelBoards).where(eq(panelBoards.id, id)).limit(1);
  if (!row) return fail("Panel not found.", 404);
  if (!isAdmin(auth.user!) && row.ownerId !== auth.user!.id) return fail("This panel belongs to another account.", 403);

  await db.delete(panelBoards).where(eq(panelBoards.id, id));
  await audit(auth.user!.id, "panel_board.deleted", "panel_boards", String(id), { name: row.name });
  return ok({ deleted: id });
}
