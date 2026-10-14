import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Short-lived links (10 minutes) for files the caller is already allowed to see (the rows they came from
 * passed RLS). Missing storage keys or failures give no link; the screen then opens files on click instead.
 */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const admin = createAdminClient();
  if (!admin || paths.length === 0) return {};
  const { data, error } = await admin.storage.from("attachments").createSignedUrls(paths, 60 * 10);
  if (error || !data) return {};
  const pairs: [string, string][] = [];
  for (const d of data) if (d.path && d.signedUrl) pairs.push([d.path, d.signedUrl]);
  return Object.fromEntries(pairs);
}
