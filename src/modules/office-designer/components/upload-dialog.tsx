"use client";
/* eslint-disable @next/next/no-img-element -- previews are local data URLs */

import { useEffect, useRef, useState } from "react";
import { dataUrlToBlob, fileToImage, newCustomId, uploadCustomItem } from "@/modules/office-designer/data/custom";
import { CATEGORIES, type Category, type FurnitureItem } from "@/modules/office-designer/data/types";
import type { Strings } from "./i18n";

type Draft = { key: string; url: string; name: string; category: Category; width: number; depth: number; height: number };

/**
 * Upload one or more top-view images and give each its name, category and real size. The pieces are added to
 * the library on the app's server and behave like catalog items. `onAdded` gets the new pieces.
 */
export function UploadDialog({ t, onClose, onAdded }: { t: Strings; onClose: () => void; onAdded: (items: FurnitureItem[]) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const added: Draft[] = [];
    for (const file of Array.from(files)) {
      try {
        const { url, aspect } = await fileToImage(file);
        const width = 100;
        added.push({
          key: `${file.name}-${added.length}-${file.lastModified}`,
          url,
          name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Piece",
          category: "decor",
          width,
          depth: Math.max(5, Math.round(width * aspect)),
          height: 75,
        });
      } catch {
        setError(t.uploadFailed);
      }
    }
    setDrafts((d) => [...d, ...added]);
  };

  const edit = (key: string, change: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...change } : x)));
  const valid = drafts.length > 0 && drafts.every((d) => d.name.trim() && d.width >= 5 && d.depth >= 5);

  /** Sends each piece to the server; a piece that fails stays in the list so it can be tried again. */
  const save = async () => {
    setBusy(true);
    setError(null);
    const added: FurnitureItem[] = [];
    const failed: Draft[] = [];
    for (const d of drafts) {
      try {
        const meta = { id: newCustomId(), name: d.name.trim(), category: d.category, widthCm: Math.round(d.width), depthCm: Math.round(d.depth), heightCm: Math.round(d.height) || 0 };
        added.push(await uploadCustomItem(meta, await dataUrlToBlob(d.url)));
      } catch (e) {
        failed.push(d);
        const code = e instanceof Error ? e.message : "";
        setError(code === "plan_limit" ? t.storageFull : code === "forbidden" ? t.viewOnly : t.uploadServerFailed);
      }
    }
    setBusy(false);
    if (added.length) onAdded(added);
    if (failed.length) setDrafts(failed);
    else onClose();
  };

  const num = (v: string) => Math.max(0, Math.min(2000, Number(v) || 0));

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <h3 id="upload-title">{t.uploadTitle}</h3>
        <p className="muted small">{t.uploadHint}</p>

        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple hidden onChange={(e) => (pick(e.target.files), (e.target.value = ""))} />
        <button type="button" className="btn btn-ghost upload-pick" onClick={() => fileRef.current?.click()}>
          ⬆ {t.chooseFiles}
        </button>

        {drafts.length > 0 && (
          <ul className="upload-list">
            {drafts.map((d) => (
              <li key={d.key} className="upload-row">
                <div className="upload-preview">
                  <img src={d.url} alt="" style={{ aspectRatio: `${d.width} / ${d.depth}` }} />
                </div>
                <div className="upload-fields">
                  <label>
                    {t.name}
                    <input className="input" value={d.name} onChange={(e) => edit(d.key, { name: e.target.value })} />
                  </label>
                  <label>
                    {t.category}
                    <select className="input" value={d.category} onChange={(e) => edit(d.key, { category: e.target.value as Category })}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t.categories[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t.width}
                    <input className="input" type="number" min={5} max={2000} value={d.width} onChange={(e) => edit(d.key, { width: num(e.target.value) })} />
                  </label>
                  <label>
                    {t.depth}
                    <input className="input" type="number" min={5} max={2000} value={d.depth} onChange={(e) => edit(d.key, { depth: num(e.target.value) })} />
                  </label>
                  <label>
                    {t.height}
                    <input className="input" type="number" min={0} max={2000} value={d.height} onChange={(e) => edit(d.key, { height: num(e.target.value) })} />
                  </label>
                </div>
                <button type="button" className="btn btn-ghost sq" aria-label={t.remove} onClick={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="danger small">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={save}>
            {busy ? t.uploading : t.addToLibrary}
          </button>
        </div>
      </div>
    </div>
  );
}
