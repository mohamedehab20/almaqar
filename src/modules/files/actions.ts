"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowsOf, type Ctx } from "@/server/context";
import { action } from "@/server/action";
import { AppError } from "@/server/errors";
import { withUser } from "@/server/session";
import { id } from "@/server/validation";

/**
 * One private bucket, files under "<company_id>/<folder>/…" (client brief files under
 * "<company_id>/briefs/<client_id>/…"). Signed-in users are Clerk users, which Supabase Storage does
 * not know, so the server checks access in the database (as the user, with RLS helpers) and then
 * talks to Storage with the secret key. Needs SUPABASE_SECRET_KEY.
 */
const BUCKET = "attachments";
const MAX_BYTES = 10 * 1024 * 1024;

function storage() {
  const admin = createAdminClient();
  if (!admin) throw new AppError("not_configured");
  return admin.storage.from(BUCKET);
}

const safeName = (name: string) => name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-80);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same rule as the storage policies in 0002: members of the company, or the client's own portal users for its brief folder. */
async function assertCanAccess(ctx: Ctx, path: string, write: boolean) {
  const [companyId, folder, clientId] = path.split("/");
  if (!uuid.test(companyId ?? "")) throw new AppError("not_found");
  const [membership] = rowsOf<{ member: boolean }>(await ctx.tx.execute(sql`select private.is_member(${companyId}::uuid) as member`));
  if (membership?.member) return;
  if (folder === "briefs" && uuid.test(clientId ?? "")) {
    const [portal] = rowsOf<{ ok: boolean }>(
      await ctx.tx.execute(sql`select private.is_client_user(${clientId}::uuid) and private.client_company_id(${clientId}::uuid) = ${companyId}::uuid as ok`),
    );
    if (portal?.ok) return;
  }
  throw new AppError(write ? "forbidden" : "not_found");
}

/**
 * Uploads a file (FormData field "file") and returns its storage path and metadata.
 * - Company files (workflow attachments, ...): { companyId, folder: "workflows" }
 * - Client portal brief attachments: { companyId, folder: "briefs", clientId }
 */
export const uploadAttachment = action(
  z.object({
    companyId: id,
    folder: z.enum(["workflows", "briefs", "notes", "orders"]),
    clientId: id.optional(),
    file: z.instanceof(File),
  }),
  async (input) => {
    if (input.file.size === 0 || input.file.size > MAX_BYTES) throw new AppError("invalid");
    if (input.folder === "briefs" && !input.clientId) throw new AppError("invalid");
    const dir = input.folder === "briefs" ? `${input.companyId}/briefs/${input.clientId}` : `${input.companyId}/${input.folder}`;
    const path = `${dir}/${crypto.randomUUID()}-${safeName(input.file.name)}`;
    await withUser((ctx) => assertCanAccess(ctx, path, true));

    const { error } = await storage().upload(path, input.file, { contentType: input.file.type || undefined });
    if (error) throw new AppError("server_error", error.message);
    return { id: crypto.randomUUID(), path, name: input.file.name, size: input.file.size, type: input.file.type };
  },
);

/** Short-lived link to open a stored file (only if the caller may read it). */
export const getAttachmentUrl = action(z.object({ path: z.string().min(3).max(400) }), async ({ path }) => {
  await withUser((ctx) => assertCanAccess(ctx, path, false));
  const { data, error } = await storage().createSignedUrl(path, 60 * 10);
  if (error || !data) throw new AppError("not_found");
  return { url: data.signedUrl };
});

export const deleteAttachment = action(z.object({ path: z.string().min(3).max(400) }), async ({ path }) => {
  await withUser((ctx) => assertCanAccess(ctx, path, true));
  const { error } = await storage().remove([path]);
  if (error) throw new AppError("server_error", error.message);
  return { deleted: true };
});
