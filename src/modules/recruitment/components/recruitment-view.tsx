"use client";

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/action";
import { useTimeZone } from "@/lib/time-zone";
import { addCandidate, createJob, deleteCandidate, deleteJob, hireCandidate, moveCandidate, scheduleInterview, updateCandidate, updateJob } from "../actions";
import {
  ACTIVE_STAGES,
  canMove,
  daysSince,
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  SOURCES,
  STAGES,
  stageCounts,
  WORK_MODES,
  type Candidate,
  type Job,
  type JobStatus,
  type Source,
  type Stage,
} from "../pipeline";
import type { JobInput, RecruitmentData } from "../service";

type Tab = "pipeline" | "jobs" | "referrals";

const stageStyle: Record<Stage, string> = {
  applied: "bg-surface-container text-on-surface-variant",
  screening: "bg-primary-fixed text-primary",
  interview: "bg-tertiary-fixed text-tertiary",
  offer: "bg-secondary-container text-on-secondary-container",
  hired: "bg-success-container text-success",
  rejected: "bg-danger-container text-danger",
};
const statusStyle: Record<JobStatus, string> = {
  open: "bg-success-container text-success",
  paused: "bg-secondary-container text-on-secondary-container",
  closed: "bg-surface-container text-muted",
};
const inputClass = "h-10 w-full rounded-md bg-surface-container-low px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40";
const areaClass = "w-full rounded-md bg-surface-container-low p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40";
const num = (n: number) => n.toLocaleString("en-US");

type NewCandidate = { jobId: string; name: string; email: string; phone: string; source: Source; cvUrl: string; notes: string };

/**
 * HR → «التوظيف»: job openings, candidates through the stages (applied → screening → interview → offer →
 * hired / rejected), interviews booked into the company schedule, hiring into the team, and referrals by
 * employees. `companyId` null = the public demo (changes stay in the browser).
 */
export function RecruitmentView({ data, companyId, companySlug }: { data: RecruitmentData; companyId: string | null; companySlug: string }) {
  const t = useTranslations("recruitment");
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
  const [tab, setTab] = useState<Tab>(data.canManage ? "pipeline" : "jobs");
  const [jobFilter, setJobFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const jobById = useMemo(() => new Map(state.jobs.map((j) => [j.id, j])), [state.jobs]);
  const memberName = (id: string | null) => (id ? (state.members.find((m) => m.id === id)?.name[locale] ?? "—") : null);
  const deptName = (id: string | null) => (id ? (state.departments.find((d) => d.id === id)?.name[locale] ?? "") : "");
  const timeZone = useTimeZone();
  const fmtDate = useMemo(() => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone }), [locale, timeZone]);

  function run(local: () => string | null, remote: () => Promise<ActionResult<unknown>>, success: string, after?: () => void) {
    if (demo) {
      const problem = local();
      if (problem) return setNotice(tErr(problem));
      after?.();
      return setNotice(success);
    }
    startTransition(async () => {
      const result = await remote();
      if (!result.ok) return setNotice(tErr(result.error));
      after?.();
      setNotice(success);
      router.refresh();
    });
  }
  const patchCandidate = (id: string, change: Partial<Candidate>) => setState((s) => ({ ...s, candidates: s.candidates.map((c) => (c.id === id ? { ...c, ...change } : c)) }));

  const actions = {
    saveJob(job: Job | null, input: JobInput, after: () => void) {
      run(
        () => {
          if (input.salaryMin != null && input.salaryMax != null && input.salaryMax < input.salaryMin) return "invalid";
          if (job) setState((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, ...input } as Job : j)) }));
          else
            setState((s) => ({
              ...s,
              jobs: [
                { id: `demo-job-${Date.now()}`, departmentId: null, employmentType: "fullTime", workMode: "office", openings: 1, status: "open", description: null, requirements: null, salaryMin: null, salaryMax: null, hiringManagerId: null, createdAt: new Date().toISOString(), ...input } as Job,
                ...s.jobs,
              ],
            }));
          return null;
        },
        () => (job ? updateJob({ jobId: job.id, ...input }) : createJob({ companyId: companyId!, ...input })),
        t(job ? "notices.jobSaved" : "notices.jobAdded"),
        after,
      );
    },
    setJobStatus(job: Job, status: JobStatus) {
      run(
        () => {
          setState((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, status } : j)) }));
          return null;
        },
        () => updateJob({ jobId: job.id, status }),
        t(`notices.job_${status}`),
      );
    },
    removeJob(job: Job) {
      if (!window.confirm(t("jobs.deleteConfirm", { title: job.title }))) return;
      run(
        () => {
          setState((s) => ({ ...s, jobs: s.jobs.filter((j) => j.id !== job.id), candidates: s.candidates.filter((c) => c.jobId !== job.id) }));
          return null;
        },
        () => deleteJob({ jobId: job.id }),
        t("notices.jobDeleted"),
      );
    },
    add(input: NewCandidate, after: () => void) {
      run(
        () => {
          const referral = !state.canManage;
          const candidate: Candidate = {
            id: `demo-cand-${Date.now()}`,
            jobId: input.jobId,
            name: input.name.trim(),
            email: input.email.trim() || null,
            phone: input.phone.trim() || null,
            source: referral ? "referral" : input.source,
            stage: "applied",
            rating: null,
            notes: input.notes.trim() || null,
            cvUrl: input.cvUrl.trim() || null,
            referredById: referral || input.source === "referral" ? state.meId : null,
            interviewAt: null,
            rejectedReason: null,
            hiredMemberId: null,
            stageChangedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          setState((s) => ({ ...s, candidates: [...s.candidates, candidate] }));
          return null;
        },
        () => addCandidate({ companyId: companyId!, ...input, email: input.email || null, cvUrl: input.cvUrl || null }),
        t(state.canManage ? "notices.added" : "notices.referred", { name: input.name.trim() }),
        after,
      );
    },
    update(c: Candidate, change: { rating?: number | null; notes?: string | null }) {
      run(
        () => {
          patchCandidate(c.id, change);
          return null;
        },
        () => updateCandidate({ candidateId: c.id, ...change }),
        t("notices.saved"),
      );
    },
    move(c: Candidate, stage: Stage, reason?: string) {
      run(
        () => {
          if (!canMove(c.stage, stage)) return "invalid";
          patchCandidate(c.id, { stage, stageChangedAt: new Date().toISOString(), rejectedReason: stage === "rejected" ? reason?.trim() || null : null });
          return null;
        },
        () => moveCandidate({ candidateId: c.id, stage, reason: reason ?? null }),
        t(`notices.moved_${stage}`, { name: c.name }),
      );
    },
    interview(c: Candidate, startsAt: string, durationMinutes: number, location: string, after: () => void) {
      const job = jobById.get(c.jobId);
      run(
        () => {
          patchCandidate(c.id, { interviewAt: startsAt, ...((c.stage === "applied" || c.stage === "screening") && { stage: "interview" as Stage, stageChangedAt: new Date().toISOString() }) });
          return null;
        },
        () => scheduleInterview({ candidateId: c.id, startsAt, durationMinutes, location: location || null, attendeeIds: job?.hiringManagerId ? [job.hiringManagerId] : [] }),
        t("notices.interview", { name: c.name }),
        after,
      );
    },
    hire(c: Candidate, invite: boolean) {
      run(
        () => {
          if (invite && !c.email) return "invalid";
          patchCandidate(c.id, { stage: "hired", stageChangedAt: new Date().toISOString() });
          return null;
        },
        () => hireCandidate({ candidateId: c.id, invite }),
        t(invite ? "notices.hiredInvited" : "notices.hired", { name: c.name }),
      );
    },
    remove(c: Candidate) {
      if (!window.confirm(t("candidate.deleteConfirm", { name: c.name }))) return;
      run(
        () => {
          setState((s) => ({ ...s, candidates: s.candidates.filter((x) => x.id !== c.id) }));
          return null;
        },
        () => deleteCandidate({ candidateId: c.id }),
        t("notices.deleted"),
        () => setOpenId(null),
      );
    },
  };

  // ---------- Stats ----------
  const weekAhead = Date.parse(state.now) + 7 * 86_400_000;
  const stats: { key: string; icon: LucideIcon; value: number }[] = [
    { key: "openJobs", icon: BriefcaseBusiness, value: state.jobs.filter((j) => j.status === "open").length },
    { key: "active", icon: Users, value: state.candidates.filter((c) => ACTIVE_STAGES.includes(c.stage)).length },
    { key: "interviews", icon: CalendarClock, value: state.candidates.filter((c) => c.interviewAt && Date.parse(c.interviewAt) >= Date.parse(state.now) && Date.parse(c.interviewAt) <= weekAhead).length },
    { key: "hired", icon: UserCheck, value: state.candidates.filter((c) => c.stage === "hired" && daysSince(c.stageChangedAt, state.now) <= 90).length },
  ];

  const tabs: { key: Tab; show: boolean }[] = [
    { key: "pipeline", show: state.canManage },
    { key: "jobs", show: true },
    { key: "referrals", show: !state.canManage },
  ];
  const open = state.candidates.find((c) => c.id === openId) ?? null;
  const shared = { state, pending, actions, jobById, memberName, deptName, fmtDate };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header>
          <Link href={`/c/${companySlug}/hr`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
            {t("back")}
          </Link>
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
          <p className="mt-1 text-on-surface-variant">{t(state.canManage ? "subtitle" : "subtitleMember")}</p>
        </header>

        {demo && <p className="rounded-lg bg-surface-container-low px-5 py-3 text-sm text-on-surface-variant">{t("demoNotice")}</p>}

        {state.canManage && (
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map(({ key, icon: Icon, value }) => (
              <li key={key} className="flex items-center gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
                <span className="grid size-11 place-items-center rounded-lg bg-primary-fixed text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-2xl font-black">{num(value)}</p>
                  <p className="text-xs text-on-surface-variant">{t(`stats.${key}`)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div role="tablist" aria-label={t("title")} className="flex flex-wrap gap-2">
          {tabs
            .filter((x) => x.show)
            .map(({ key }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-sm px-5 text-sm font-semibold ghost-border transition-colors",
                  tab === key ? "bg-primary-fixed text-primary" : "bg-surface-container-lowest hover:bg-surface-container-low",
                )}
              >
                {t(`tabs.${key}`)}
              </button>
            ))}
        </div>

        {tab === "pipeline" && state.canManage && <Pipeline {...shared} jobFilter={jobFilter} setJobFilter={setJobFilter} onOpen={setOpenId} />}
        {tab === "jobs" && (
          <Jobs
            {...shared}
            onShowCandidates={(jobId) => {
              setJobFilter(jobId);
              setTab("pipeline");
            }}
          />
        )}
        {tab === "referrals" && <Referrals {...shared} />}
      </div>

      {open && <CandidatePanel {...shared} candidate={open} onClose={() => setOpenId(null)} />}

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg">
          {notice}
        </p>
      )}
    </div>
  );
}

type Actions = {
  saveJob: (job: Job | null, input: JobInput, after: () => void) => void;
  setJobStatus: (job: Job, status: JobStatus) => void;
  removeJob: (job: Job) => void;
  add: (input: NewCandidate, after: () => void) => void;
  update: (c: Candidate, change: { rating?: number | null; notes?: string | null }) => void;
  move: (c: Candidate, stage: Stage, reason?: string) => void;
  interview: (c: Candidate, startsAt: string, durationMinutes: number, location: string, after: () => void) => void;
  hire: (c: Candidate, invite: boolean) => void;
  remove: (c: Candidate) => void;
};

type Shared = {
  state: RecruitmentData;
  pending: boolean;
  actions: Actions;
  jobById: Map<string, Job>;
  memberName: (id: string | null) => string | null;
  deptName: (id: string | null) => string;
  fmtDate: Intl.DateTimeFormat;
};

function Stars({ value, onChange, size = "size-4" }: { value: number | null; onChange?: (v: number | null) => void; size?: string }) {
  const t = useTranslations("recruitment");
  return (
    <span className="inline-flex gap-0.5" aria-label={t("candidate.rating", { value: value ?? 0 })}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value !== null && n <= value;
        const star = <Star className={cn(size, filled ? "fill-[#f59e0b] text-[#f59e0b]" : "text-outline-variant")} aria-hidden />;
        return onChange ? (
          <button key={n} type="button" onClick={() => onChange(value === n ? null : n)} aria-label={t("candidate.rate", { value: n })}>
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

// ---------- Pipeline ----------

function Pipeline({
  state,
  pending,
  actions,
  jobById,
  fmtDate,
  jobFilter,
  setJobFilter,
  onOpen,
}: Shared & { jobFilter: string; setJobFilter: (id: string) => void; onOpen: (id: string) => void }) {
  const t = useTranslations("recruitment");
  const [adding, setAdding] = useState(false);
  const [ended, setEnded] = useState<"hired" | "rejected" | null>(null);
  const list = state.candidates.filter((c) => jobFilter === "all" || c.jobId === jobFilter);
  const counts = stageCounts(list);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <Select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} aria-label={t("pipeline.job")} className="h-10">
            <option value="all">{t("pipeline.allJobs")}</option>
            {state.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </Select>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} disabled={!state.jobs.length}>
            <UserPlus className="size-4" aria-hidden />
            {t("pipeline.add")}
          </Button>
        )}
        <div className="ms-auto flex gap-2">
          {(["hired", "rejected"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={ended === s}
              onClick={() => setEnded(ended === s ? null : s)}
              className={cn("flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold", ended === s ? stageStyle[s] : "bg-surface-container-low hover:bg-surface-container")}
            >
              {s === "hired" ? <UserCheck className="size-4" aria-hidden /> : <UserX className="size-4" aria-hidden />}
              {t(`stages.${s}`)} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {adding && <CandidateForm state={state} pending={pending} defaultJob={jobFilter === "all" ? undefined : jobFilter} onClose={() => setAdding(false)} onSubmit={(input) => actions.add(input, () => setAdding(false))} />}

      {ended ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.filter((c) => c.stage === ended).map((c) => (
            <CandidateCard key={c.id} c={c} job={jobById.get(c.jobId)} now={state.now} fmtDate={fmtDate} onOpen={() => onOpen(c.id)} />
          ))}
          {!counts[ended] && <p className="text-sm text-on-surface-variant">{t("pipeline.none")}</p>}
        </ul>
      ) : (
        <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-4">
          {ACTIVE_STAGES.map((stage) => (
            <section key={stage} className="flex min-w-64 flex-col gap-3 rounded-xl bg-surface-container-low p-3">
              <h3 className="flex items-center justify-between px-1 text-sm font-bold">
                <span className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs", stageStyle[stage])}>{t(`stages.${stage}`)}</span>
                </span>
                <span className="text-on-surface-variant">{counts[stage]}</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {list
                  .filter((c) => c.stage === stage)
                  .sort((a, b) => a.stageChangedAt.localeCompare(b.stageChangedAt))
                  .map((c) => (
                    <CandidateCard key={c.id} c={c} job={jobById.get(c.jobId)} now={state.now} fmtDate={fmtDate} onOpen={() => onOpen(c.id)} />
                  ))}
                {!counts[stage] && <li className="rounded-lg border border-dashed border-outline-variant/60 px-3 py-6 text-center text-xs text-muted">{t("pipeline.empty")}</li>}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ c, job, now, fmtDate, onOpen }: { c: Candidate; job?: Job; now: string; fmtDate: Intl.DateTimeFormat; onOpen: () => void }) {
  const t = useTranslations("recruitment");
  const days = daysSince(c.stageChangedAt, now);
  const upcoming = c.interviewAt && Date.parse(c.interviewAt) >= Date.parse(now);
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full flex-col gap-1.5 rounded-lg bg-surface-container-lowest p-3 text-start shadow-ambient transition hover:-translate-y-0.5 hover:shadow-ambient-lg">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-bold">{c.name}</span>
          {c.rating !== null && <Stars value={c.rating} size="size-3" />}
        </span>
        <span className="truncate text-xs text-on-surface-variant">{job?.title}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-surface-container px-2 py-0.5 font-semibold text-on-surface-variant">{t(`sources.${c.source}`)}</span>
          <span className={cn("text-muted", days >= 7 && ACTIVE_STAGES.includes(c.stage) && "font-semibold text-danger")}>{t("pipeline.days", { count: days })}</span>
        </span>
        {upcoming && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-tertiary">
            <CalendarClock className="size-3.5" aria-hidden />
            {fmtDate.format(new Date(c.interviewAt!))}
          </span>
        )}
      </button>
    </li>
  );
}

function CandidateForm({
  state,
  pending,
  defaultJob,
  referral = false,
  onSubmit,
  onClose,
}: {
  state: RecruitmentData;
  pending: boolean;
  defaultJob?: string;
  referral?: boolean;
  onSubmit: (input: NewCandidate) => void;
  onClose: () => void;
}) {
  const t = useTranslations("recruitment");
  const jobs = referral ? state.jobs.filter((j) => j.status === "open") : state.jobs;
  const [draft, setDraft] = useState<NewCandidate>({ jobId: defaultJob ?? jobs[0]?.id ?? "", name: "", email: "", phone: "", source: referral ? "referral" : "linkedin", cvUrl: "", notes: "" });
  const set = (k: keyof NewCandidate) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <form
      className="grid gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.name.trim() || !draft.jobId) return;
        onSubmit(draft);
      }}
    >
      <h3 className="text-lg font-bold sm:col-span-2 lg:col-span-3">{t(referral ? "referrals.formTitle" : "pipeline.formTitle")}</h3>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("candidate.job")}
        <Select value={draft.jobId} onChange={set("jobId")} required className="h-10 bg-surface-container-low">
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("candidate.name")}
        <input required maxLength={120} value={draft.name} onChange={set("name")} className={inputClass} />
      </label>
      {!referral && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("candidate.source")}
          <Select value={draft.source} onChange={set("source")} className="h-10 bg-surface-container-low">
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`sources.${s}`)}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("candidate.email")}
        <input type="email" dir="ltr" maxLength={200} value={draft.email} onChange={set("email")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("candidate.phone")}
        <input type="tel" dir="ltr" maxLength={40} value={draft.phone} onChange={set("phone")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("candidate.cv")}
        <input type="url" dir="ltr" maxLength={1000} placeholder="https://" value={draft.cvUrl} onChange={set("cvUrl")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2 lg:col-span-3">
        {t(referral ? "referrals.why" : "candidate.notes")}
        <textarea rows={2} maxLength={4000} value={draft.notes} onChange={set("notes")} className={areaClass} />
      </label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pending || !draft.name.trim() || !draft.jobId}>
          <Check className="size-4" aria-hidden />
          {t(referral ? "referrals.submit" : "pipeline.save")}
        </Button>
        <Button variant="tertiary" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </form>
  );
}

// ---------- One candidate ----------

function CandidatePanel({ state, pending, actions, jobById, memberName, fmtDate, candidate: c, onClose }: Shared & { candidate: Candidate; onClose: () => void }) {
  const t = useTranslations("recruitment");
  const job = jobById.get(c.jobId);
  const [notes, setNotes] = useState(c.notes ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [booking, setBooking] = useState(false);
  const [invite, setInvite] = useState(Boolean(c.email));
  const index = STAGES.indexOf(c.stage);
  const next = ACTIVE_STAGES.includes(c.stage) && c.stage !== "offer" ? STAGES[index + 1] : null;
  const prev = ACTIVE_STAGES.includes(c.stage) && c.stage !== "applied" ? STAGES[index - 1] : null;
  const ended = c.stage === "hired" || c.stage === "rejected";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={c.name}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col gap-5 overflow-y-auto bg-surface p-6 shadow-ambient-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-extrabold">{c.name}</h3>
            <p className="text-sm text-on-surface-variant">{job?.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", stageStyle[c.stage])}>{t(`stages.${c.stage}`)}</span>
              <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">{t(`sources.${c.source}`)}</span>
              {c.referredById && <span className="text-xs text-on-surface-variant">{t("candidate.referredBy", { name: memberName(c.referredById) ?? "—" })}</span>}
            </div>
          </div>
          <Button variant="icon" size="icon" onClick={onClose} aria-label={t("close")}>
            <X className="size-5" aria-hidden />
          </Button>
        </div>

        <ul className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4 text-sm">
          {c.email && (
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-primary" aria-hidden />
              <a href={`mailto:${c.email}`} dir="ltr" className="hover:underline">
                {c.email}
              </a>
            </li>
          )}
          {c.phone && (
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-primary" aria-hidden />
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} dir="ltr" className="hover:underline">
                {c.phone}
              </a>
            </li>
          )}
          {c.cvUrl && (
            <li className="flex items-center gap-2">
              <FileText className="size-4 text-primary" aria-hidden />
              <a href={c.cvUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
                {t("candidate.openCv")}
              </a>
            </li>
          )}
          {c.interviewAt && (
            <li className="flex items-center gap-2">
              <CalendarClock className="size-4 text-tertiary" aria-hidden />
              {t("candidate.interviewOn", { date: fmtDate.format(new Date(c.interviewAt)) })}
            </li>
          )}
          {c.rejectedReason && <li className="text-danger">{t("candidate.rejectedBecause", { reason: c.rejectedReason })}</li>}
          <li className="text-xs text-on-surface-variant">{t("candidate.inStage", { count: daysSince(c.stageChangedAt, state.now) })}</li>
        </ul>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t("candidate.ratingLabel")}</span>
          <Stars value={c.rating} size="size-6" onChange={(rating) => actions.update(c, { rating })} />
        </div>

        <label className="flex flex-col gap-2 text-sm font-semibold">
          {t("candidate.notes")}
          <textarea rows={4} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("candidate.notesHint")} className={areaClass} />
          {notes !== (c.notes ?? "") && (
            <Button size="sm" variant="secondary" className="w-fit" disabled={pending} onClick={() => actions.update(c, { notes: notes.trim() || null })}>
              {t("candidate.saveNotes")}
            </Button>
          )}
        </label>

        {/* Stage */}
        <section className="flex flex-col gap-3 rounded-lg bg-surface-container-lowest p-4 shadow-ambient">
          <h4 className="font-bold">{t("candidate.stageTitle")}</h4>
          {ended ? (
            c.stage === "rejected" && (
              <Button variant="secondary" disabled={pending} onClick={() => actions.move(c, "applied")} className="w-fit">
                {t("candidate.reopen")}
              </Button>
            )
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {next && (
                  <Button size="sm" disabled={pending} onClick={() => actions.move(c, next)}>
                    {t("candidate.moveTo", { stage: t(`stages.${next}`) })}
                    <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
                  </Button>
                )}
                {prev && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => actions.move(c, prev)}>
                    <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
                    {t("candidate.backTo", { stage: t(`stages.${prev}`) })}
                  </Button>
                )}
                {!booking && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => setBooking(true)}>
                    <CalendarClock className="size-4" aria-hidden />
                    {t(c.interviewAt ? "candidate.moveInterview" : "candidate.bookInterview")}
                  </Button>
                )}
                {!rejecting && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => setRejecting(true)} className="text-danger">
                    <UserX className="size-4" aria-hidden />
                    {t("candidate.reject")}
                  </Button>
                )}
              </div>
              {booking && <InterviewForm pending={pending} hiringManager={memberName(job?.hiringManagerId ?? null)} onClose={() => setBooking(false)} onSubmit={(at, minutes, place) => actions.interview(c, at, minutes, place, () => setBooking(false))} />}
              {rejecting && (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    actions.move(c, "rejected", reason);
                    setRejecting(false);
                  }}
                >
                  <input autoFocus maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("candidate.rejectReason")} className={inputClass} />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={pending} className="bg-danger bg-none text-white">
                      {t("candidate.confirmReject")}
                    </Button>
                    <Button size="sm" variant="tertiary" onClick={() => setRejecting(false)}>
                      {t("close")}
                    </Button>
                  </div>
                </form>
              )}
              {c.stage === "offer" && (
                <div className="flex flex-col gap-2 rounded-md bg-success-container/50 p-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={invite} disabled={!c.email} onChange={(e) => setInvite(e.target.checked)} className="mt-1" />
                    <span>{c.email ? t("candidate.inviteToTeam") : t("candidate.inviteNeedsEmail")}</span>
                  </label>
                  <Button size="sm" disabled={pending} onClick={() => actions.hire(c, invite && Boolean(c.email))} className="w-fit">
                    <UserCheck className="size-4" aria-hidden />
                    {t("candidate.hire")}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <Button variant="tertiary" disabled={pending} onClick={() => actions.remove(c)} className="w-fit text-danger">
          <Trash2 className="size-4" aria-hidden />
          {t("candidate.delete")}
        </Button>
      </aside>
    </div>
  );
}

function InterviewForm({ pending, hiringManager, onSubmit, onClose }: { pending: boolean; hiringManager: string | null; onSubmit: (at: string, minutes: number, place: string) => void; onClose: () => void }) {
  const t = useTranslations("recruitment");
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [time, setTime] = useState("11:00");
  const [minutes, setMinutes] = useState(45);
  const [place, setPlace] = useState("");
  return (
    <form
      className="grid gap-3 rounded-md bg-tertiary-fixed/40 p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new Date(`${date}T${time}`).toISOString(), minutes, place);
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {t("interview.date")}
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputClass, "bg-surface-container-lowest")} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {t("interview.time")}
        <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={cn(inputClass, "bg-surface-container-lowest")} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {t("interview.duration")}
        <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-10 bg-surface-container-lowest">
          {[20, 30, 45, 60, 90].map((m) => (
            <option key={m} value={m}>
              {t("interview.minutes", { count: m })}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {t("interview.place")}
        <span className="relative">
          <MapPin className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input maxLength={300} value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t("interview.placeHint")} className={cn(inputClass, "bg-surface-container-lowest ps-9")} />
        </span>
      </label>
      <p className="text-xs text-on-surface-variant sm:col-span-2">{hiringManager ? t("interview.withManager", { name: hiringManager }) : t("interview.inSchedule")}</p>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Check className="size-4" aria-hidden />
          {t("interview.save")}
        </Button>
        <Button size="sm" variant="tertiary" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </form>
  );
}

// ---------- Jobs ----------

function Jobs({ state, pending, actions, memberName, deptName, onShowCandidates }: Shared & { onShowCandidates: (jobId: string) => void }) {
  const t = useTranslations("recruitment");
  const [editing, setEditing] = useState<Job | "new" | null>(null);
  const [referring, setReferring] = useState<string | null>(null);
  const jobs = state.canManage ? state.jobs : state.jobs.filter((j) => j.status === "open");
  const salary = (j: Job) =>
    j.salaryMin != null || j.salaryMax != null ? t("jobs.salary", { range: [j.salaryMin, j.salaryMax].filter((v) => v != null).map((v) => num(v!)).join(" – ") }) : null;

  return (
    <div className="flex flex-col gap-5">
      {state.canManage && editing === null && (
        <div>
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden />
            {t("jobs.add")}
          </Button>
        </div>
      )}
      {editing !== null && <JobForm state={state} job={editing === "new" ? null : editing} pending={pending} onClose={() => setEditing(null)} onSubmit={(job, input) => actions.saveJob(job, input, () => setEditing(null))} />}
      {referring && <CandidateForm state={state} pending={pending} referral defaultJob={referring} onClose={() => setReferring(null)} onSubmit={(input) => actions.add(input, () => setReferring(null))} />}

      {jobs.length === 0 ? (
        <p className="rounded-lg bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant">{t(state.canManage ? "jobs.empty" : "jobs.noneOpen")}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {jobs.map((j) => {
            const counts = stageCounts(state.candidates, j.id);
            const hired = counts.hired;
            return (
              <li key={j.id} className={cn("flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-ambient", j.status === "closed" && "opacity-75")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold">{j.title}</h3>
                    <p className="text-sm text-on-surface-variant">
                      {[deptName(j.departmentId), t(`types.${j.employmentType}`), t(`modes.${j.workMode}`)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", statusStyle[j.status])}>{t(`jobStatus.${j.status}`)}</span>
                </div>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>{t("jobs.openings", { hired, total: j.openings })}</span>
                  {salary(j) && <span className="text-on-surface-variant">{salary(j)}</span>}
                  {j.hiringManagerId && <span className="text-on-surface-variant">{t("jobs.manager", { name: memberName(j.hiringManagerId) ?? "—" })}</span>}
                </p>
                {j.description && <p className="text-sm text-on-surface-variant">{j.description}</p>}
                {j.requirements && <p className="text-sm text-on-surface-variant">{t("jobs.requirements", { text: j.requirements })}</p>}
                {state.canManage && (
                  <ul className="flex flex-wrap gap-1.5">
                    {STAGES.map((s) => (
                      <li key={s} className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", counts[s] ? stageStyle[s] : "bg-surface-container-low text-muted")}>
                        {t(`stages.${s}`)} {counts[s]}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {state.canManage ? (
                    <>
                      <Button size="sm" onClick={() => onShowCandidates(j.id)}>
                        <Users className="size-4" aria-hidden />
                        {t("jobs.candidates")}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(j)}>
                        <Pencil className="size-4" aria-hidden />
                        {t("jobs.edit")}
                      </Button>
                      <div className="w-36">
                        <Select value={j.status} disabled={pending} onChange={(e) => actions.setJobStatus(j, e.target.value as JobStatus)} aria-label={t("jobs.status")} className="h-8 text-xs">
                          {JOB_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(`jobStatus.${s}`)}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button size="sm" variant="icon" disabled={pending} onClick={() => actions.removeJob(j)} aria-label={t("jobs.delete")} title={t("jobs.delete")} className="text-danger">
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setReferring(j.id)}>
                      <UserPlus className="size-4" aria-hidden />
                      {t("referrals.refer")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function JobForm({ state, job, pending, onSubmit, onClose }: { state: RecruitmentData; job: Job | null; pending: boolean; onSubmit: (job: Job | null, input: JobInput) => void; onClose: () => void }) {
  const t = useTranslations("recruitment");
  const locale = useLocale() as "ar" | "en";
  const [draft, setDraft] = useState({
    title: job?.title ?? "",
    departmentId: job?.departmentId ?? "",
    employmentType: job?.employmentType ?? "fullTime",
    workMode: job?.workMode ?? "office",
    openings: job?.openings ?? 1,
    description: job?.description ?? "",
    requirements: job?.requirements ?? "",
    salaryMin: job?.salaryMin?.toString() ?? "",
    salaryMax: job?.salaryMax?.toString() ?? "",
    hiringManagerId: job?.hiringManagerId ?? "",
  });
  const set = (k: keyof typeof draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });
  const money = (v: string) => (v === "" ? null : Math.max(0, Number(v)));
  const badSalary = draft.salaryMin !== "" && draft.salaryMax !== "" && Number(draft.salaryMax) < Number(draft.salaryMin);

  return (
    <form
      className="grid gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.title.trim() || badSalary) return;
        onSubmit(job, {
          title: draft.title.trim(),
          departmentId: draft.departmentId || null,
          employmentType: draft.employmentType,
          workMode: draft.workMode,
          openings: Math.max(1, Number(draft.openings) || 1),
          description: draft.description.trim() || null,
          requirements: draft.requirements.trim() || null,
          salaryMin: money(draft.salaryMin),
          salaryMax: money(draft.salaryMax),
          hiringManagerId: draft.hiringManagerId || null,
        });
      }}
    >
      <h3 className="text-lg font-bold sm:col-span-2 lg:col-span-4">{t(job ? "jobs.editTitle" : "jobs.newTitle")}</h3>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        {t("jobs.title")}
        <input required maxLength={120} value={draft.title} onChange={set("title")} placeholder={t("jobs.titleHint")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("jobs.department")}
        <Select value={draft.departmentId} onChange={set("departmentId")} className="h-10 bg-surface-container-low">
          <option value="">—</option>
          {state.departments
            .filter((d) => d.active !== false || d.id === draft.departmentId)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name[locale]}
              </option>
            ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("jobs.hiringManager")}
        <Select value={draft.hiringManagerId} onChange={set("hiringManagerId")} className="h-10 bg-surface-container-low">
          <option value="">—</option>
          {state.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name[locale]}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("jobs.type")}
        <Select value={draft.employmentType} onChange={set("employmentType")} className="h-10 bg-surface-container-low">
          {EMPLOYMENT_TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`types.${x}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("jobs.mode")}
        <Select value={draft.workMode} onChange={set("workMode")} className="h-10 bg-surface-container-low">
          {WORK_MODES.map((x) => (
            <option key={x} value={x}>
              {t(`modes.${x}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("jobs.openingsLabel")}
        <input type="number" min={1} max={500} dir="ltr" value={draft.openings} onChange={set("openings")} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("jobs.salaryMin")}
          <input type="number" min={0} dir="ltr" value={draft.salaryMin} onChange={set("salaryMin")} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("jobs.salaryMax")}
          <input type="number" min={0} dir="ltr" value={draft.salaryMax} onChange={set("salaryMax")} className={cn(inputClass, badSalary && "ring-2 ring-danger")} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        {t("jobs.description")}
        <textarea rows={3} maxLength={4000} value={draft.description} onChange={set("description")} className={areaClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        {t("jobs.requirementsLabel")}
        <textarea rows={3} maxLength={4000} value={draft.requirements} onChange={set("requirements")} className={areaClass} />
      </label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending || !draft.title.trim() || badSalary}>
          <Check className="size-4" aria-hidden />
          {t("jobs.save")}
        </Button>
        <Button variant="tertiary" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </form>
  );
}

// ---------- My referrals (members without recruitment.manage) ----------

function Referrals({ state, jobById }: Shared) {
  const t = useTranslations("recruitment");
  const mine = state.candidates.filter((c) => c.referredById === state.meId);
  return mine.length === 0 ? (
    <p className="rounded-lg bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant">{t("referrals.empty")}</p>
  ) : (
    <ul className="flex flex-col gap-3">
      {mine.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-ambient">
          <div>
            <p className="font-bold">{c.name}</p>
            <p className="text-sm text-on-surface-variant">{jobById.get(c.jobId)?.title ?? "—"}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", stageStyle[c.stage])}>{t(`stages.${c.stage}`)}</span>
        </li>
      ))}
    </ul>
  );
}
