"use client";

import { useMemo, useState } from "react";
import { useCustomItems } from "@/modules/office-designer/data/custom";
import { ITEMS } from "@/modules/office-designer/data/items";
import { CATEGORIES, type Category } from "@/modules/office-designer/data/types";
import type { Lang, Strings } from "./i18n";
import { ItemCard } from "./item-card";
import { ItemDetail } from "./item-detail";

/**
 * Grid of items with search (Arabic name, English name, tags), category chips and a detail panel.
 * `onUpload` (when the viewer may add furniture) shows the "Upload furniture" button.
 */
export function Catalog({ lang, t, shadow, setShadow, onUpload }: { lang: Lang; t: Strings; shadow: boolean; setShadow: (v: boolean) => void; onUpload?: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const custom = useCustomItems();
  const all = useMemo(() => [...ITEMS, ...custom], [custom]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((i) => category === "all" || i.category === category).filter(
      (i) => !q || i.nameEn.toLowerCase().includes(q) || i.nameAr.includes(q) || i.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [all, query, category]);
  const open = all.find((i) => i.id === openId) ?? null;

  return (
    <div className={`catalog${open ? " catalog-with-detail" : ""}`}>
      <div className="catalog-main">
        <div className="toolbar">
          <input className="input search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} />
          <label className="toggle">
            <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} />
            {t.shadows}
          </label>
          {onUpload && (
            <button type="button" className="btn btn-primary" onClick={onUpload}>
              + {t.upload}
            </button>
          )}
        </div>
        <div className="chips" role="group">
          {(["all", ...CATEGORIES] as const).map((c) => (
            <button key={c} type="button" className={`chip${category === c ? " chip-on" : ""}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c === "all" ? t.all : t.categories[c]}
            </button>
          ))}
          <span className="muted count">
            {visible.length} {t.items}
          </span>
        </div>
        {visible.length === 0 ? (
          <p className="empty">{t.noResults}</p>
        ) : (
          <div className="grid">
            {visible.map((item) => (
              <ItemCard key={item.id} item={item} lang={lang} shadow={shadow} active={item.id === openId} onOpen={() => setOpenId(item.id)} />
            ))}
          </div>
        )}
      </div>
      {open && <ItemDetail item={open} lang={lang} t={t} shadow={shadow} onClose={() => setOpenId(null)} />}
    </div>
  );
}
