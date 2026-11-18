import type { FurnitureItem } from "@/modules/office-designer/data/types";
import type { Lang } from "./i18n";
import { TopViewIcon } from "./top-view-icon";

/** One catalog card: the drawing, the name, and W × D × H. */
export function ItemCard({ item, lang, shadow, active, onOpen }: { item: FurnitureItem; lang: Lang; shadow: boolean; active: boolean; onOpen: () => void }) {
  return (
    <button type="button" className={`card${active ? " card-active" : ""}`} onClick={onOpen}>
      <div className="card-art">
        <TopViewIcon item={item} size={120} shadow={shadow} />
      </div>
      <div className="card-name">{lang === "ar" ? item.nameAr : item.nameEn}</div>
      <div className="card-size" dir="ltr">
        {item.widthCm} × {item.depthCm} × {item.heightCm} cm
      </div>
    </button>
  );
}
