"use client";

import type { StoredFile } from "@/db/schema";
import { createUploadTarget } from "./actions";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Uploads one file straight to storage: the server checks access and hands out a one-time link, the browser
 * sends the file to it. Returns what to store on the row, or an error code.
 */
export async function uploadFile(
  companyId: string,
  folder: "workflows" | "notes" | "orders" | "contracts" | "approvals",
  file: File,
): Promise<{ ok: true; file: StoredFile } | { ok: false; error: string }> {
  if (file.size === 0 || file.size > MAX_FILE_BYTES) return { ok: false, error: "invalid" };
  const target = await createUploadTarget({ companyId, folder, name: file.name, size: file.size });
  if (!target.ok) return { ok: false, error: target.error };
  const res = await fetch(target.data.signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" } });
  if (!res.ok) return { ok: false, error: "server_error" };
  return { ok: true, file: { path: target.data.path, name: file.name, size: file.size, type: file.type } };
}
