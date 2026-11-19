"use client";

import "../designer.css";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { getOfficeDesign, saveOfficeLayout } from "../actions";
import { setCompanyItems } from "../data/custom";
import { FloorPlan, type DesignStore } from "./floor-plan-editor";
import { STRINGS, type Lang } from "./i18n";

const browserKey = (companyId: string | null) => `al-maqr-office-${companyId ?? "demo"}`;

function readBrowser(companyId: string | null): unknown {
  try {
    return JSON.parse(localStorage.getItem(browserKey(companyId)) ?? "null");
  } catch {
    return null; // storage blocked: start from the sample office
  }
}
function writeBrowser(companyId: string | null, layout: unknown): "ok" | "failed" {
  try {
    localStorage.setItem(browserKey(companyId), JSON.stringify(layout));
    return "ok";
  } catch {
    return "failed";
  }
}

/**
 * The company's design on the server (Supabase Storage). In the public demo, or while the server has no storage
 * key, the design and the uploaded furniture stay in this browser.
 */
function makeStore(companyId: string | null, onBrowserOnly: () => void): DesignStore {
  if (!companyId)
    return {
      load: async () => {
        setCompanyItems(null, [], "browser");
        return { layout: readBrowser(null), canEdit: true, uploads: true };
      },
      save: async (layout) => writeBrowser(null, layout),
    };
  let onServer = true;
  return {
    load: async () => {
      const res = await getOfficeDesign({ companyId });
      if (!res.ok) throw new Error(res.error);
      onServer = res.data.stored;
      setCompanyItems(companyId, res.data.items, onServer ? "server" : "browser");
      if (!onServer) onBrowserOnly();
      return { layout: onServer ? res.data.layout : readBrowser(companyId), canEdit: res.data.canEdit, uploads: true };
    },
    save: async (layout) => {
      if (!onServer) return writeBrowser(companyId, layout);
      const res = await saveOfficeLayout({ companyId, layout });
      return res.ok ? "ok" : res.error === "forbidden" ? "forbidden" : "failed";
    },
  };
}

/**
 * The office designer ("My Company") inside the main hall: the floor plan editor (walls, doors, windows,
 * furniture) and the furniture catalog. Follows the app language and direction.
 */
export function OfficeDesigner({ companyId }: { companyId: string | null }) {
  const lang: Lang = useLocale() === "en" ? "en" : "ar";
  const t = STRINGS[lang];
  const [shadow, setShadow] = useState(true);
  const [browserOnly, setBrowserOnly] = useState(false);
  const store = useMemo(() => makeStore(companyId, () => setBrowserOnly(true)), [companyId]);

  return (
    <div className="mc-root">
      {browserOnly && <p className="view-only">{t.browserOnly}</p>}
      <FloorPlan lang={lang} t={t} shadow={shadow} setShadow={setShadow} store={store} />
    </div>
  );
}
