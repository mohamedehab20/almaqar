"use client";

import { Link2, Pin, PinOff, StickyNote, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { currentUserId, members } from "@/modules/hq/mock";
import type { WorkflowRow } from "../mock";
import type { Note } from "../notes";

type NotesSectionProps = {
  notes: Note[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  operations: WorkflowRow[];
  onNotice: (message: string) => void;
};

/** Team notes, optionally attached to an operation. Pinned notes stay on top. */
export function NotesSection({ notes, setNotes, operations, onNotice }: NotesSectionProps) {
  const t = useTranslations("ops.notes");
  const locale = useLocale() as "ar" | "en";
  const [text, setText] = useState("");
  const [operationId, setOperationId] = useState("");

  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  const author = (id: string) => members.find((m) => m.id === id)?.name[locale] ?? "—";

  const addNote = () => {
    const body = text.trim();
    if (!body) {
      onNotice(t("notices.empty"));
      return;
    }
    // TODO(backend): save the note
    setNotes((prev) => [{ id: `n-${Date.now()}`, text: body, authorId: currentUserId, createdAt: new Date().toISOString(), operationId: operationId || undefined, pinned: false }, ...prev]);
    setText("");
    setOperationId("");
    onNotice(t("notices.added"));
  };

  return (
    <section className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-lg font-extrabold">
        <StickyNote className="size-5 text-tertiary" aria-hidden />
        {t("title")}
      </h3>

      <form
        className="flex flex-col gap-3 rounded-lg bg-surface-container-lowest p-4 shadow-ambient ghost-border"
        onSubmit={(event) => {
          event.preventDefault();
          addNote();
        }}
      >
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder={t("placeholder")}
          aria-label={t("title")}
          className="w-full resize-y rounded-sm bg-surface-container-low p-3 text-sm outline-none placeholder:text-muted focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <Select aria-label={t("linkTo")} value={operationId} onChange={(event) => setOperationId(event.target.value)} className="h-10">
              <option value="">{t("noLink")}</option>
              {operations.map((operation) => (
                <option key={operation.id} value={operation.id}>{operation.code} — {operation.title[locale]}</option>
              ))}
            </Select>
          </div>
          <button type="submit" className="h-10 rounded-sm bg-tertiary px-5 text-sm font-bold text-on-tertiary hover:brightness-110">
            {t("add")}
          </button>
        </div>
      </form>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((note) => {
            const operation = operations.find((o) => o.id === note.operationId);
            return (
              <li
                key={note.id}
                className={cn(
                  "flex flex-col gap-3 rounded-lg p-4 shadow-ambient",
                  note.pinned ? "bg-tertiary-fixed ring-1 ring-tertiary/30" : "bg-surface-container-lowest ghost-border",
                )}
              >
                <p className="whitespace-pre-wrap text-sm leading-6">{note.text}</p>
                {operation && (
                  <span className="flex w-fit items-center gap-1.5 rounded-full bg-surface-container-lowest/70 px-2.5 py-1 text-xs text-primary ghost-border">
                    <Link2 className="size-3.5" aria-hidden />
                    <span dir="ltr" className="font-mono">{operation.code}</span> {operation.title[locale]}
                  </span>
                )}
                <div className="mt-auto flex items-center gap-2 border-t border-outline-variant/30 pt-3">
                  <Avatar name={author(note.authorId)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{author(note.authorId)}</span>
                    <span className="block font-mono text-[10px] text-muted" dir="ltr">{note.createdAt.slice(0, 16).replace("T", " ")}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)))}
                    aria-label={t(note.pinned ? "unpin" : "pin")}
                    title={t(note.pinned ? "unpin" : "pin")}
                    className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-container hover:text-tertiary"
                  >
                    {note.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotes((prev) => prev.filter((n) => n.id !== note.id))}
                    aria-label={t("delete")}
                    title={t("delete")}
                    className="grid size-8 place-items-center rounded-full text-muted hover:bg-danger-container hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
