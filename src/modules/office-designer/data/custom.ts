import { useSyncExternalStore } from "react";
import { removeOfficeFurniture, uploadOfficeFurniture } from "../actions";
import type { Category, FurnitureItem } from "./types";

/**
 * Furniture the company uploaded (a top-view image plus its real size). The list comes from the server with the
 * design (see OfficeDesigner); uploads and removals go through the office designer's actions. In the public demo
 * (no company) uploading is off.
 */
const NONE: FurnitureItem[] = [];

let current: FurnitureItem[] = NONE;
let company: string | null = null;
const listeners = new Set<() => void>();
const set = (next: FurnitureItem[]) => {
  current = next;
  listeners.forEach((l) => l());
};

/** Called by the designer once the design has loaded. */
export function setCompanyItems(companyId: string | null, items: FurnitureItem[]) {
  company = companyId;
  set(items);
}

export function isCustomItem(v: unknown): v is FurnitureItem {
  const o = v as FurnitureItem;
  return !!o && typeof o.id === "string" && o.id.startsWith("USR-") && typeof o.imageUrl === "string" && o.widthCm > 0 && o.depthCm > 0;
}

/** The uploaded pieces loaded so far. */
export const customItems = (): FurnitureItem[] => current;

export type UploadMeta = { id: string; name: string; category: Category; widthCm: number; depthCm: number; heightCm: number };

export const newCustomId = () => `USR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

/** Sends one piece to the server. Throws with the error code ("forbidden", "plan_limit", …). */
export async function uploadCustomItem(meta: UploadMeta, image: Blob): Promise<FurnitureItem> {
  if (!company) throw new Error("forbidden");
  const file = new File([image], `${meta.id}.${image.type.split("/")[1]?.replace("svg+xml", "svg") ?? "png"}`, { type: image.type });
  const res = await uploadOfficeFurniture({ companyId: company, meta, file });
  if (!res.ok) throw new Error(res.error);
  set([...current.filter((i) => i.id !== res.data.id), res.data]);
  return res.data;
}

export const dataUrlToBlob = async (url: string) => (await fetch(url)).blob();

/** Uploads pieces that carry their image inline (from an imported file). */
export async function addCustomItems(items: FurnitureItem[]): Promise<boolean> {
  const have = new Set(current.map((i) => i.id));
  let ok = true;
  for (const i of items.filter((x) => isCustomItem(x) && !have.has(x.id) && x.imageUrl!.startsWith("data:image/"))) {
    try {
      await uploadCustomItem({ id: i.id, name: i.nameEn, category: i.category, widthCm: i.widthCm, depthCm: i.depthCm, heightCm: i.heightCm }, await dataUrlToBlob(i.imageUrl!));
    } catch {
      ok = false;
    }
  }
  return ok;
}

export async function removeCustomItem(id: string) {
  if (!company) return false;
  const res = await removeOfficeFurniture({ companyId: company, id });
  if (res.ok || res.error === "not_found") set(current.filter((i) => i.id !== id));
  return res.ok;
}

/** Copies of the pieces with their images inline, for a JSON export that opens anywhere. */
export async function withInlineImages(items: FurnitureItem[]) {
  return Promise.all(
    items.map(async (i) => {
      try {
        const blob = await (await fetch(i.imageUrl!)).blob();
        const url = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        return { ...i, imageUrl: url };
      } catch {
        return i;
      }
    }),
  );
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** React hook: the uploaded pieces, re-rendering when they change. */
export const useCustomItems = () => useSyncExternalStore(subscribe, customItems, () => NONE);

/**
 * Turns an uploaded file into an image small enough to send: bitmaps are shrunk to at most 600 px on the long side
 * (WebP keeps transparency); SVG is kept as it is when it is small. Also returns the image's aspect.
 */
export async function fileToImage(file: File): Promise<{ url: string; aspect: number }> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = raw;
  });
  const w = img.naturalWidth || 100;
  const h = img.naturalHeight || 100;
  if (file.type === "image/svg+xml") {
    if (raw.length > 300_000) throw new Error("too big");
    return { url: raw, aspect: h / w };
  }
  const k = Math.min(1, 600 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL("image/webp", 0.88), aspect: h / w };
}
