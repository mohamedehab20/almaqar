"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { action } from "@/server/action";
import { AppError } from "@/server/errors";
import { id } from "@/server/validation";

/** One private bucket; storage policies check that the first folder is a company the caller belongs to. */
const BUCKET = "attachments";
const MAX_BYTES = 10 * 1024 * 1024;

async function storage() {
  if (!supabaseEnv()) throw new AppError("not_configured");
  return (await createClient()).storage.from(BUCKET);
}

const safeName = (name: string) => name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-80);

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

    const { error } = await (await storage()).upload(path, input.file, { contentType: input.file.type || undefined });
    if (error) throw new AppError("forbidden", error.message);
    return { id: crypto.randomUUID(), path, name: input.file.name, size: input.file.size, type: input.file.type };
  },
);

/** Short-lived link to open a stored file (only if the caller may read it). */
export const getAttachmentUrl = action(z.object({ path: z.string().min(3).max(400) }), async ({ path }) => {
  const { data, error } = await (await storage()).createSignedUrl(path, 60 * 10);
  if (error || !data) throw new AppError("not_found");
  return { url: data.signedUrl };
});

export const deleteAttachment = action(z.object({ path: z.string().min(3).max(400) }), async ({ path }) => {
  const { error } = await (await storage()).remove([path]);
  if (error) throw new AppError("forbidden", error.message);
  return { deleted: true };
});
