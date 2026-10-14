"use client";

import { Check, FileText, Gavel, ImageIcon, Inbox, Paperclip, Send, Stamp, Undo2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getAttachmentUrl } from "@/modules/files/actions";
import { MAX_FILE_BYTES, uploadFile } from "@/modules/files/upload";
import { cancelApproval, decideApproval, requestApproval } from "../actions";
import type { Approval, ApprovalFile, ApprovalKind, ApprovalsData, ApprovalStatus } from "../service";

const MAX_FILES = 6;
const statusStyle: Record<ApprovalStatus, string> = {
  pending: "bg-secondary-container text-on-secondary-container",
  approved: "bg-success-container text-success",
  rejected: "bg-danger-container text-danger",
  cancelled: "bg-surface-container text-muted",
};
const inputClass = "h-10 w-full rounded-md bg-surface-container-low px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40";
const isImage = (f: Pick<ApprovalFile, "type">) => f.type.startsWith("image/");
const size = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Files, as thumbnails (images) or links; opens through a fresh signed link when the page has none. */
export function FileList({ files, onNotice }: { files: ApprovalFile[]; onNotice: (m: string) => void }) {
  const t = useTranslations("approvals");
  const tErr = useTranslations("auth.errors");
  const open = async (f: ApprovalFile) => {
    if (f.url) return window.open(f.url, "_blank", "noopener");
    const res = await getAttachmentUrl({ path: f.path });
    if (!res.ok) return onNotice(tErr(res.error));
    window.open(res.data.url, "_blank", "noopener");
  };
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.path}>
          <button type="button" onClick={() => open(f)} title={t("openFile", { name: f.name })} className="group flex items-center gap-2 overflow-hidden rounded-lg bg-surface-container-low text-start text-xs hover:bg-surface-container">
            {isImage(f) && f.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt={f.name} className="h-16 w-24 object-cover transition group-hover:opacity-90" />
            ) : (
              <span className="grid size-12 place-items-center bg-surface-container text-primary">{isImage(f) ? <ImageIcon className="size-5" aria-hidden /> : <FileText className="size-5" aria-hidden />}</span>
            )}
            <span className="max-w-40 pe-3">
              <span dir="auto" className="block truncate font-semibold">
                {f.name}
              </span>
              <span className="text-muted">{size(f.size)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Meeting room → «الاعتماد»: ask a specific colleague to approve an action or a position, with photos or
 * files; they approve or reject (with a note). `companyId` null = the public demo (files stay in the browser).
 */
export function ApprovalsSection({ data, companyId, onNotice }: { data: ApprovalsData; companyId: string | null; onNotice: (m: string) => void }) {
  const t = useTranslations("approvals");
  const tErr = useTranslations("auth.errors");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const demo = companyId === null;
  const [pending, startTransition] = useTransition();

  const [state, setState] = useState(data);
  const [source, setSource] = useState(data);
  if (data !== source) {
    setSource(data);
    setState(data);
  }
  const [view, setView] = useState<"toMe" | "mine" | "all">("toMe");
  const [asking, setAsking] = useState(false);
  const [deciding, setDeciding] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const nameOf = (id: string) => state.members.find((m) => m.id === id)?.name[locale] ?? "—";
  const fmt = useMemo(() => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }), [locale]);
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }), [locale]);

  const toMe = state.approvals.filter((a) => a.approverId === state.meId);
  const mine = state.approvals.filter((a) => a.requesterId === state.meId);
  const waiting = toMe.filter((a) => a.status === "pending").length;
  const list = (view === "toMe" ? toMe : view === "mine" ? mine : state.approvals).slice().sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.createdAt.localeCompare(a.createdAt));

  const patch = (id: string, change: Partial<Approval>) => setState((s) => ({ ...s, approvals: s.approvals.map((a) => (a.id === id ? { ...a, ...change } : a)) }));

  const decide = (a: Approval, decision: "approved" | "rejected") => {
    const text = note.trim();
    const done = () => {
      setDeciding(null);
      setNote("");
      onNotice(t(decision === "approved" ? "notices.approved" : "notices.rejected"));
    };
    if (demo) {
      patch(a.id, { status: decision, decisionNote: text || null, decidedAt: new Date().toISOString() });
      return done();
    }
    startTransition(async () => {
      const res = await decideApproval({ approvalId: a.id, decision, note: text || null });
      if (!res.ok) return onNotice(tErr(res.error));
      done();
      router.refresh();
    });
  };

  const cancel = (a: Approval) => {
    if (demo) {
      patch(a.id, { status: "cancelled" });
      return onNotice(t("notices.cancelled"));
    }
    startTransition(async () => {
      const res = await cancelApproval({ approvalId: a.id });
      if (!res.ok) return onNotice(tErr(res.error));
      onNotice(t("notices.cancelled"));
      router.refresh();
    });
  };

  const submit = (input: { approverId: string; kind: ApprovalKind; title: string; details: string; dueOn: string; files: File[] }) => {
    if (demo) {
      const attachments = input.files.map((f) => ({ path: `local/${f.name}`, name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f) }));
      setState((s) => ({
        ...s,
        approvals: [
          {
            id: `demo-${Date.now()}`,
            requesterId: s.meId,
            approverId: input.approverId,
            kind: input.kind,
            title: input.title.trim(),
            details: input.details.trim() || null,
            dueOn: input.dueOn || null,
            attachments,
            status: "pending",
            decisionNote: null,
            decidedAt: null,
            createdAt: new Date().toISOString(),
          },
          ...s.approvals,
        ],
      }));
      setAsking(false);
      setView("mine");
      return onNotice(t("notices.sent", { name: nameOf(input.approverId) }));
    }
    startTransition(async () => {
      const attachments = [];
      for (const f of input.files) {
        const up = await uploadFile(companyId!, "approvals", f);
        if (!up.ok) return onNotice(up.error === "not_configured" ? t("notices.storageOff") : t("notices.uploadFailed", { name: f.name }));
        attachments.push(up.file);
      }
      const res = await requestApproval({ companyId: companyId!, approverId: input.approverId, kind: input.kind, title: input.title.trim(), details: input.details.trim() || null, dueOn: input.dueOn || null, attachments });
      if (!res.ok) return onNotice(tErr(res.error));
      setAsking(false);
      setView("mine");
      onNotice(t("notices.sent", { name: nameOf(input.approverId) }));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["toMe", Inbox, toMe.length],
            ["mine", Send, mine.length],
            ["all", Stamp, state.approvals.length],
          ] as const
        ).map(([key, Icon, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={cn("flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors", view === key ? "bg-primary text-on-primary" : "bg-surface-container-low hover:bg-surface-container")}
          >
            <Icon className="size-4" aria-hidden />
            {t(`views.${key}`)} ({count})
            {key === "toMe" && waiting > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-xs text-white">{waiting}</span>}
          </button>
        ))}
        {!asking && (
          <Button onClick={() => setAsking(true)} className="ms-auto">
            <Gavel className="size-4" aria-hidden />
            {t("ask")}
          </Button>
        )}
      </div>

      {asking && <AskForm data={state} pending={pending} onClose={() => setAsking(false)} onSubmit={submit} onNotice={onNotice} />}

      {list.length === 0 ? (
        <p className="rounded-lg bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant">{t(`empty.${view}`)}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((a) => {
            const forMe = a.approverId === state.meId && a.status === "pending";
            const overdue = a.status === "pending" && a.dueOn && a.dueOn < new Date().toISOString().slice(0, 10);
            return (
              <li key={a.id} className={cn("flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-ambient", forMe && "ring-2 ring-secondary-container")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={nameOf(a.requesterId)} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm text-on-surface-variant">
                        {a.approverId === state.meId
                          ? t("fromToMe", { from: nameOf(a.requesterId) })
                          : a.requesterId === state.meId
                            ? t("fromMe", { to: nameOf(a.approverId) })
                            : t("fromTo", { from: nameOf(a.requesterId), to: nameOf(a.approverId) })}
                        {" · "}
                        {fmt.format(new Date(a.createdAt))}
                      </p>
                      <h3 className="font-bold">{a.title}</h3>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">{t(`kinds.${a.kind}`)}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", statusStyle[a.status])}>{t(`status.${a.status}`)}</span>
                  </div>
                </div>
                {a.details && <p className="whitespace-pre-line text-sm text-on-surface-variant">{a.details}</p>}
                {a.dueOn && a.status === "pending" && (
                  <p className={cn("text-xs font-semibold", overdue ? "text-danger" : "text-on-surface-variant")}>{t(overdue ? "overdue" : "dueOn", { date: fmtDay.format(new Date(`${a.dueOn}T00:00:00Z`)) })}</p>
                )}
                <FileList files={a.attachments} onNotice={onNotice} />
                {a.decidedAt && (
                  <p className="rounded-md bg-surface-container-low px-3 py-2 text-sm">
                    {t(a.status === "approved" ? "decidedApproved" : "decidedRejected", { name: nameOf(a.approverId), date: fmt.format(new Date(a.decidedAt)) })}
                    {a.decisionNote && <span className="block text-on-surface-variant">«{a.decisionNote}»</span>}
                  </p>
                )}
                {forMe &&
                  (deciding?.id === a.id ? (
                    <form
                      className="flex flex-col gap-2 sm:flex-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        decide(a, deciding.decision);
                      }}
                    >
                      <input autoFocus maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t(deciding.decision === "approved" ? "notePlaceholderApprove" : "notePlaceholderReject")} className={inputClass} />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={pending} className={cn("h-10", deciding.decision === "rejected" && "bg-danger bg-none text-white")}>
                          {t(deciding.decision === "approved" ? "confirmApprove" : "confirmReject")}
                        </Button>
                        <Button size="sm" variant="tertiary" className="h-10" onClick={() => setDeciding(null)}>
                          {t("close")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={pending} onClick={() => setDeciding({ id: a.id, decision: "approved" })}>
                        <Check className="size-4" aria-hidden />
                        {t("approve")}
                      </Button>
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => setDeciding({ id: a.id, decision: "rejected" })} className="text-danger">
                        <X className="size-4" aria-hidden />
                        {t("reject")}
                      </Button>
                    </div>
                  ))}
                {a.requesterId === state.meId && a.status === "pending" && (
                  <Button size="sm" variant="tertiary" disabled={pending} onClick={() => cancel(a)} className="w-fit">
                    <Undo2 className="size-4" aria-hidden />
                    {t("cancel")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** File picker with previews, shared by approvals and notes. */
export function FilePicker({ files, setFiles, onNotice }: { files: File[]; setFiles: (f: File[]) => void; onNotice: (m: string) => void }) {
  const t = useTranslations("approvals");
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : "")), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const picked = [...list].filter((f) => {
      if (f.size > MAX_FILE_BYTES) onNotice(t("notices.tooBig", { name: f.name }));
      return f.size > 0 && f.size <= MAX_FILE_BYTES;
    });
    const next = [...files, ...picked].slice(0, MAX_FILES);
    if (files.length + picked.length > MAX_FILES) onNotice(t("notices.tooMany", { max: MAX_FILES }));
    setFiles(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <input ref={input} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={files.length >= MAX_FILES} className="w-fit">
        <Paperclip className="size-4" aria-hidden />
        {t("attach")}
      </Button>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 overflow-hidden rounded-lg bg-surface-container-low pe-1 text-xs">
              {previews[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[i]} alt={f.name} className="h-12 w-16 object-cover" />
              ) : (
                <span className="grid size-12 place-items-center bg-surface-container text-primary">
                  <FileText className="size-5" aria-hidden />
                </span>
              )}
              <span className="max-w-32">
                <span dir="auto" className="block truncate font-semibold">
                  {f.name}
                </span>
                <span className="text-muted">{size(f.size)}</span>
              </span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={t("removeFile", { name: f.name })} className="rounded-full p-1 hover:bg-surface-container">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-on-surface-variant">{t("filesHint", { max: MAX_FILES })}</p>
    </div>
  );
}

function AskForm({
  data,
  pending,
  onSubmit,
  onClose,
  onNotice,
}: {
  data: ApprovalsData;
  pending: boolean;
  onSubmit: (input: { approverId: string; kind: ApprovalKind; title: string; details: string; dueOn: string; files: File[] }) => void;
  onClose: () => void;
  onNotice: (m: string) => void;
}) {
  const t = useTranslations("approvals");
  const locale = useLocale() as "ar" | "en";
  const others = data.members.filter((m) => m.id !== data.meId);
  const [approverId, setApproverId] = useState(others[0]?.id ?? "");
  const [kind, setKind] = useState<ApprovalKind>("action");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  return (
    <form
      className="grid gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() && approverId) onSubmit({ approverId, kind, title, details, dueOn, files });
      }}
    >
      <h3 className="text-lg font-bold sm:col-span-2">{t("formTitle")}</h3>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("approver")}
        <Select value={approverId} onChange={(e) => setApproverId(e.target.value)} required className="h-10 bg-surface-container-low">
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name[locale]}
              {m.title[locale] ? ` — ${m.title[locale]}` : ""}
            </option>
          ))}
        </Select>
      </label>
      <fieldset className="flex flex-col gap-1 text-sm font-semibold">
        <legend className="mb-1">{t("kind")}</legend>
        <div className="flex gap-2">
          {(["action", "position"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn("flex h-10 flex-1 items-center justify-center rounded-md text-sm transition-colors", kind === k ? "bg-primary-fixed text-primary ring-2 ring-primary/40" : "bg-surface-container-low hover:bg-surface-container")}
            >
              {t(`kinds.${k}`)}
            </button>
          ))}
        </div>
        <span className="text-xs font-normal text-on-surface-variant">{t(`kindHint.${kind}`)}</span>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        {t("title")}
        <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t(`titleHint.${kind}`)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        {t("details")}
        <textarea rows={3} maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("detailsHint")} className="rounded-md bg-surface-container-low p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("due")}
        <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputClass} />
      </label>
      <div className="flex flex-col gap-1 text-sm font-semibold">
        {t("files")}
        <FilePicker files={files} setFiles={setFiles} onNotice={onNotice} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending || !title.trim() || !approverId}>
          <Send className="size-4" aria-hidden />
          {t(pending ? "sending" : "send")}
        </Button>
        <Button variant="tertiary" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </form>
  );
}
