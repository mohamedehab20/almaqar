/* eslint-disable @next/next/no-img-element -- the drawings are inline SVG data, not remote images */
import type { FurnitureItem } from "@/modules/office-designer/data/types";

/** The item's top view as an image source: the PNG when one is attached, otherwise its SVG drawing. */
export function itemSrc(item: FurnitureItem) {
  return item.imageUrl ?? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg)}`;
}

/**
 * Draws an item from above at its true proportions inside a `size` × `size` box. The soft shadow is a separate
 * layer under the drawing, shown only when `shadow` is on.
 */
export function TopViewIcon({ item, size, shadow }: { item: FurnitureItem; size: number; shadow: boolean }) {
  const scale = Math.min(size / item.widthCm, size / item.depthCm);
  const w = item.widthCm * scale;
  const h = item.depthCm * scale;
  const round = item.category === "plants" || item.subcategory === "lighting" || item.id.startsWith("TBL-COF") || item.id.startsWith("TBL-SIDE") || item.id.startsWith("TBL-RND") || item.id.startsWith("SEAT-STL") || item.id.startsWith("SEAT-BEAN") || item.id === "DEC-RUG-002";
  return (
    <div className="topview" style={{ width: size, height: size }}>
      {shadow && <div className="topview-shadow" style={{ width: w, height: h, borderRadius: round ? "50%" : Math.min(w, h) * 0.12 }} aria-hidden />}
      <img src={itemSrc(item)} alt="" width={w} height={h} draggable={false} className="topview-img" />
    </div>
  );
}
