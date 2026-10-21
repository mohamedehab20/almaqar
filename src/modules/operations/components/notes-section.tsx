"use client";

import { Building, Check, Link2, Pin, PinOff, StickyNote, Trash2, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/modules/files/upload";
import { FileList, FilePicker } from "@/modules/approvals/components/approvals-section";
import { createNote, deleteNote, setNotePinned } from "../actions";
import { noteConcernsDepartment, type Note, type NoteAudience } from "../notes";

type Localized = { ar: string; en: string };

type NotesSectionProps = {
  notes: Note[];
  meId: string;
  people: { id: string; name: Localized; title: Localized | null; departmentId: string | null }[];
  departments: { id: string; name: Localized }[];
  operations: { id: string; code: string; title: Localized }[];
  /** null: the public demo (notes stay in the browser) */
  companyId: string | null;
  onNotice: (message: string) => void;
};

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/**
 * Team notes addressed to the whole company or to departments / employees, optionally attached to an operation.
 * A real company saves notes and their files (uploaded straight to storage); the demo keeps them in the browser.
 */
export function NotesSection({ notes: initial, meId, people: members, departments, operations, companyId, onNotice }: NotesSectionProps) {
  const t = useTranslations("ops.notes");
  const tApp = useTranslations("approvals");
  const tErr = useTranslations("auth.errors");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [source, setSource] = useState(initial);
  const [notes, setNotes] = useState<Note[]>(initial);
  if (initial !== source) {
    setSource(initial);
    setNotes(initial);
  }
  const memberDepartment = (memberId: string) => members.find((m) => m.id === memberId)?.departmentId ?? undefined;
  const memberRole = (m: (typeof members)[number]) => m.title?.[locale] ?? "";
  const [text, setText] = useState("");
  const [operationId, setOperationId] = useState("");
  const [audienceType, setAudienceType] = useState<NoteAudience["type"]>("company");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [files, setFiles] = useState<File[]>([]);

  // Picking departments narrows the employee list to those departments
  const pickableMembers = departmentIds.length ? members.filter((m) => m.departmentId && departmentIds.includes(m.departmentId)) : members;
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name[locale] ?? "—";
  const memberName = (id: string) => members.find((m) => m.id === id)?.name[locale] ?? "—";

  const visible = [...notes]
    .filter((note) => filter === "all" || noteConcernsDepartment(note, filter, memberDepartment))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));

  const addNote = () => {
    const body = text.trim();
    if (!body) {
      onNotice(t("notices.empty"));
      return;
    }
    if (audienceType === "custom" && departmentIds.length === 0 && memberIds.length === 0) {
      onNotice(t("notices.noAudience"));
      return;
    }
    const audience: NoteAudience = audienceType === "company" ? { type: "company" } : { type: "custom", departmentIds, memberIds };
    const reset = () => {
      setText("");
      setFiles([]);
      setOperationId("");
      setAudienceType("company");
      setDepartmentIds([]);
      setMemberIds([]);
      onNotice(t("notices.added"));
    };
    if (!companyId) {
      const attachments = files.map((f) => ({ path: `local/${f.name}`, name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f) }));
      setNotes((prev) => [{ id: `n-${Date.now()}`, text: body, authorId: meId, createdAt: new Date().toISOString(), operationId: operationId || undefined, audience, pinned: false, attachments }, ...prev]);
      return reset();
    }
    startTransition(async () => {
      const attachments = [];
      for (const f of files) {
        const up = await uploadFile(companyId, "notes", f);
        if (!up.ok) return onNotice(up.error === "not_configured" ? tApp("notices.storageOff") : tApp("notices.uploadFailed", { name: f.name }));
        attachments.push(up.file);
      }
      const res = await createNote({ companyId, text: body, audience, operationId: operationId || null, attachments });
      if (!res.ok) return onNotice(res.error === "forbidden" ? t("notices.forbidden") : tErr(res.error));
      reset();
      router.refresh();
    });
  };

  /** Pin or delete: shown at once, saved for a real company, put back if the server says no. */
  const change = (next: (prev: Note[]) => Note[], remote: () => Promise<{ ok: boolean; error?: string }>) => {
    const before = notes;
    setNotes(next);
    if (!companyId) return;
    startTransition(async () => {
      const res = await remote();
      if (!res.ok) {
        setNotes(before);
        return onNotice(res.error === "forbidden" ? t("notices.forbidden") : tErr(res.error ?? "server_error"));
      }
      router.refresh();
    });
  };

  const audienceLabel = (audience: NoteAudience) =>
    audience.type === "company"
      ? t("audience.company")
      : [...audience.departmentIds.map(deptName), ...audience.memberIds.map(memberName)].join("، ");

  return (
    <section className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-lg font-extrabold">
        <StickyNote className="size-5 text-tertiary" aria-hidden />
        {t("title")}
      </h3>

      <form
        className="flex flex-col gap-4 rounded-lg bg-surface-container-lowest p-4 shadow-ambient ghost-border"
        onSubmit={(event) => {
          event.preventDefault();
          addNote();
        }}
      >
        {/* Audience */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{t("audience.to")}</span>
            <div className="flex gap-1 rounded-md bg-surface-container-low p-1" role="radiogroup" aria-label={t("audience.to")}>
              {(
                [
                  ["company", Building],
                  ["custom", Users],
                ] as const
              ).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={audienceType === key}
                  onClick={() => setAudienceType(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors",
                    audienceType === key ? "bg-surface-container-lowest font-bold text-tertiary shadow-ambient" : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(`audience.${key}`)}
                </button>
              ))}
            </div>
          </div>

          {audienceType === "custom" && (
            <div className="grid gap-3 md:grid-cols-2">
              {/* Departments (also filter the employees list) */}
              <fieldset className="rounded-md bg-surface-container-low p-3">
                <legend className="sr-only">{t("audience.departments")}</legend>
                <p className="mb-2 flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                  {t("audience.departments")}
                  <span className="font-normal text-muted">{t("audience.departmentsHint")}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => (
                    <Chip key={dept.id} active={departmentIds.includes(dept.id)} onClick={() => setDepartmentIds((prev) => toggle(prev, dept.id))}>
                      {dept.name[locale]}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              {/* Employees */}
              <fieldset className="rounded-md bg-surface-container-low p-3">
                <legend className="sr-only">{t("audience.employees")}</legend>
                <p className="mb-2 flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                  {t("audience.employees")}
                  {departmentIds.length > 0 && <span className="font-normal text-muted">{t("audience.filtered", { count: pickableMembers.length })}</span>}
                </p>
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {pickableMembers.map((member) => {
                    const checked = memberIds.includes(member.id);
                    return (
                      <li key={member.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => setMemberIds((prev) => toggle(prev, member.id))}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start transition-colors",
                            checked ? "bg-tertiary-fixed" : "hover:bg-surface-container",
                          )}
                        >
                          <span className={cn("grid size-4 shrink-0 place-items-center rounded-[4px] border", checked ? "border-tertiary bg-tertiary text-white" : "border-outline-variant bg-surface-container-lowest")}>
                            {checked && <Check className="size-3" aria-hidden />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{member.name[locale]}</span>
                            <span className="block truncate text-[11px] text-muted">{memberRole(member)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </div>
          )}
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder={t("placeholder")}
          aria-label={t("title")}
          className="w-full resize-y rounded-sm bg-surface-container-low p-3 text-sm outline-none placeholder:text-muted focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
        />

        <FilePicker files={files} setFiles={setFiles} onNotice={onNotice} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <Select aria-label={t("linkTo")} value={operationId} onChange={(event) => setOperationId(event.target.value)} className="h-10">
              <option value="">{t("noLink")}</option>
              {operations.map((operation) => (
                <option key={operation.id} value={operation.id}>{operation.code} — {operation.title[locale]}</option>
              ))}
            </Select>
          </div>
          <button type="submit" disabled={pending} className="h-10 rounded-sm bg-tertiary px-5 text-sm font-bold text-on-tertiary hover:brightness-110">
            {t("add")}
          </button>
        </div>
      </form>

      {/* Filter notes by department */}
      <div className="flex flex-wrap items-center gap-2" aria-label={t("filter")}>
        <span className="text-xs font-semibold text-on-surface-variant">{t("filter")}:</span>
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          {t("all")}
        </Chip>
        {departments.map((dept) => (
          <Chip key={dept.id} active={filter === dept.id} onClick={() => setFilter(dept.id)}>
            {dept.name[locale]}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((note) => {
            const operation = operations.find((o) => o.id === note.operationId);
            return (
              <li
                key={note.id}
                className={cn(
                  "flex flex-col gap-3 rounded-lg p-4 shadow-ambient",
                  note.pinned ? "bg-tertiary-fixed ring-1 ring-tertiary/30" : "bg-surface-container-lowest ghost-border",
                )}
              >
                <p className="flex items-start gap-1.5 text-xs text-on-surface-variant">
                  {note.audience.type === "company" ? <Building className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Users className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                  <span>
                    <span className="font-semibold">{t("audience.to")} </span>
                    {audienceLabel(note.audience)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap text-sm leading-6">{note.text}</p>
                {note.attachments && note.attachments.length > 0 && <FileList files={note.attachments} onNotice={onNotice} />}
                {operation && (
                  <span className="flex w-fit items-center gap-1.5 rounded-full bg-surface-container-lowest/70 px-2.5 py-1 text-xs text-primary ghost-border">
                    <Link2 className="size-3.5" aria-hidden />
                    <span dir="ltr" className="font-mono">{operation.code}</span> {operation.title[locale]}
                  </span>
                )}
                <div className="mt-auto flex items-center gap-2 border-t border-outline-variant/30 pt-3">
                  <Avatar name={memberName(note.authorId)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{memberName(note.authorId)}</span>
                    <span className="block font-mono text-[10px] text-muted" dir="ltr">{note.createdAt.slice(0, 16).replace("T", " ")}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => change((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)), () => setNotePinned({ noteId: note.id, pinned: !note.pinned }))}
                    aria-label={t(note.pinned ? "unpin" : "pin")}
                    title={t(note.pinned ? "unpin" : "pin")}
                    className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-container hover:text-tertiary"
                  >
                    {note.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => change((prev) => prev.filter((n) => n.id !== note.id), () => deleteNote({ noteId: note.id }))}
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs transition-colors",
        active ? "bg-tertiary font-bold text-on-tertiary" : "bg-surface-container-lowest ghost-border hover:bg-surface-container",
      )}
    >
      {children}
    </button>
  );
}
