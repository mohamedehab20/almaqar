import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/server/errors";
import { CATEGORIES, type Category, type FurnitureItem } from "./data/types";

/**
 * The office design of a company, kept in the private "attachments" bucket under "<company_id>/office/":
 * layout.json (the plan), items.json (uploaded furniture) and furniture/<id>.<ext> (their top-view images).
 * Callers check membership / permission first; Storage is reached with the secret key (Clerk users are not
 * Supabase users), like the files module.
 */
const BUCKET = "attachments";
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_LAYOUT_BYTES = 1.5 * 1024 * 1024;
export const MAX_ITEMS = 300;
export const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const URL_TTL = 60 * 60 * 12; // image links last a working day

/** An uploaded piece as stored: like a catalog item, with the image's storage path instead of a link. */
export type StoredItem = Omit<FurnitureItem, "imageUrl" | "svg"> & { imagePath: string };

/** False until SUPABASE_SECRET_KEY is set: the designer then keeps the design in the browser. */
export const storageReady = () => createAdminClient() !== null;

function bucket() {
  const admin = createAdminClient();
  if (!admin) throw new AppError("not_configured");
  return admin.storage.from(BUCKET);
}
const dir = (companyId: string) => `${companyId}/office`;

async function readJson<T>(path: string): Promise<T | null> {
  const { data, error } = await bucket().download(path);
  if (error || !data) return null; // not there yet
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, value: unknown) {
  const body = JSON.stringify(value);
  const { error } = await bucket().upload(path, new Blob([body], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (error) throw new AppError("server_error", error.message);
  return body.length;
}

export const readLayout = (companyId: string) => readJson<unknown>(`${dir(companyId)}/layout.json`);

export async function writeLayout(companyId: string, layout: unknown) {
  if (JSON.stringify(layout).length > MAX_LAYOUT_BYTES) throw new AppError("invalid");
  await writeJson(`${dir(companyId)}/layout.json`, layout);
}

const readItems = async (companyId: string) => (await readJson<StoredItem[]>(`${dir(companyId)}/items.json`)) ?? [];

/** The uploaded pieces with short-lived links to their images. */
export async function listItems(companyId: string): Promise<FurnitureItem[]> {
  const items = await readItems(companyId);
  if (!items.length) return [];
  const { data } = await bucket().createSignedUrls(
    items.map((i) => i.imagePath),
    URL_TTL,
  );
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return items.filter((i) => urls.get(i.imagePath)).map((i) => ({ ...toItem(i), imageUrl: urls.get(i.imagePath)! }));
}

/** A stored piece as the designer uses it (its link is added by the caller). */
function toItem(stored: StoredItem): FurnitureItem {
  const item: FurnitureItem & { imagePath?: string } = { ...stored, svg: "" };
  delete item.imagePath;
  return item;
}

export type NewItem = { id: string; name: string; category: Category; widthCm: number; depthCm: number; heightCm: number };

export async function addItem(companyId: string, meta: NewItem, file: File): Promise<FurnitureItem> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext || file.size === 0 || file.size > MAX_IMAGE_BYTES || !CATEGORIES.includes(meta.category)) throw new AppError("invalid");
  const items = await readItems(companyId);
  if (items.length >= MAX_ITEMS) throw new AppError("plan_limit");
  if (items.some((i) => i.id === meta.id)) throw new AppError("conflict");
  const imagePath = `${dir(companyId)}/furniture/${meta.id}.${ext}`;
  const { error } = await bucket().upload(imagePath, file, { contentType: file.type, upsert: true });
  if (error) throw new AppError("server_error", error.message);
  const stored: StoredItem = {
    id: meta.id,
    nameEn: meta.name,
    nameAr: meta.name,
    category: meta.category,
    subcategory: "uploaded",
    widthCm: meta.widthCm,
    depthCm: meta.depthCm,
    heightCm: meta.heightCm,
    clearanceCm: 0,
    material: "",
    colorHex: "#9aa3ad",
    tags: ["uploaded", "مرفوع"],
    imagePath,
  };
  await writeJson(`${dir(companyId)}/items.json`, [...items, stored]);
  const { data } = await bucket().createSignedUrl(imagePath, URL_TTL);
  return { ...toItem(stored), imageUrl: data?.signedUrl ?? "" };
}

export async function removeItem(companyId: string, id: string) {
  const items = await readItems(companyId);
  const item = items.find((i) => i.id === id);
  if (!item) throw new AppError("not_found");
  await bucket().remove([item.imagePath]);
  await writeJson(
    `${dir(companyId)}/items.json`,
    items.filter((i) => i.id !== id),
  );
}
