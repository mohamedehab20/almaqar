"use client";

import { useState } from "react";
import type { FurnitureItem } from "@/modules/office-designer/data/types";
import type { Lang, Strings } from "./i18n";
import { TopViewIcon } from "./top-view-icon";

/** Every field of an item, a large drawing, and «Copy JSON» (the item exactly as in data/items.ts). */
export function ItemDetail({ item, lang, t, shadow, onClose }: { item: FurnitureItem; lang: Lang; t: Strings; shadow: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(item, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  const rows: [string, React.ReactNode][] = [
    [t.fields.id, <code key="id">{item.id}</code>],
    [t.fields.category, t.categories[item.category]],
    [t.fields.subcategory, item.subcategory],
    [t.fields.size, <span key="s" dir="ltr">{item.widthCm} × {item.depthCm} × {item.heightCm} {t.cm}</span>],
    [t.fields.clearance, <span key="c" dir="ltr">{item.clearanceCm} {t.cm}</span>],
    [t.fields.material, item.material],
    [
      t.fields.color,
      <span key="col" className="swatch-row">
        <span className="swatch" style={{ background: item.colorHex }} />
        <code>{item.colorHex}</code>
      </span>,
    ],
    [t.fields.tags, item.tags.join(" · ")],
  ];
  return (
    <aside className="detail" aria-label={lang === "ar" ? item.nameAr : item.nameEn}>
      <div className="detail-head">
        <div>
          <h2>{lang === "ar" ? item.nameAr : item.nameEn}</h2>
          <p className="muted">{lang === "ar" ? item.nameEn : item.nameAr}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t.close}
        </button>
      </div>
      <div className="detail-art">
        <TopViewIcon item={item} size={260} shadow={shadow} />
      </div>
      <dl className="fields">
        {rows.map(([k, v]) => (
          <div key={k} className="field">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="btn btn-primary" onClick={copy}>
        {copied ? t.copied : t.copyJson}
      </button>
    </aside>
  );
}
