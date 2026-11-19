import { useEffect, useSyncExternalStore } from "react";
import type { FurnitureItem } from "./types";

/**
 * The drawings use SVG lighting filters (see draw.ts). Chrome renders those black once the image is flipped
 * (a 180° turn or a mirror), so each drawing is painted once into a bitmap with its lighting baked in, and the
 * bitmap is what the plan turns and flips. Photos (imageUrl) are used as they are.
 */
const PX_PER_CM = 4;
const MAX_PX = 1024;

const ready = new Map<string, string>();
const busy = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
/** The drawing without its finish: safe under any transform, shown until the bitmap is ready. */
const plainUrl = (svg: string) => svgUrl(svg.replace(' filter="url(#finish)"', ""));

async function paint(item: FurnitureItem) {
  const img = new Image();
  img.src = svgUrl(item.svg);
  await img.decode();
  const k = Math.min(PX_PER_CM, MAX_PX / Math.max(item.widthCm, item.depthCm));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(item.widthCm * k));
  canvas.height = Math.max(1, Math.round(item.depthCm * k));
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function ensure(item: FurnitureItem) {
  if (item.imageUrl || !item.svg || ready.has(item.id) || busy.has(item.id)) return;
  busy.add(item.id);
  paint(item)
    .then((url) => {
      ready.set(item.id, url);
      version++;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* keep the plain drawing */
    })
    .finally(() => busy.delete(item.id));
}

/** The picture to show for an item: its photo, its finished bitmap, or (until that is ready) the plain drawing. */
export function itemPicture(item: FurnitureItem) {
  return item.imageUrl ?? ready.get(item.id) ?? plainUrl(item.svg);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Starts painting these items and re-renders the caller as each bitmap becomes ready. */
export function useItemPictures(items: FurnitureItem[]) {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  useEffect(() => {
    items.forEach(ensure);
  }, [items]);
}
