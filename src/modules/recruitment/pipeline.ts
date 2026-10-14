/**
 * Recruitment vocabulary and small rules, shared by the server, the screen and the demo.
 * A candidate moves through STAGES in order; "rejected" and "hired" end the process.
 */

export const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
export type Stage = (typeof STAGES)[number];
/** Stages shown as columns of the pipeline (the two outcomes are counted, not listed as columns) */
export const ACTIVE_STAGES: Stage[] = ["applied", "screening", "interview", "offer"];

export const SOURCES = ["linkedin", "wuzzuf", "website", "referral", "facebook", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const EMPLOYMENT_TYPES = ["fullTime", "partTime", "internship", "freelance"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORK_MODES = ["office", "remote", "hybrid"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const JOB_STATUSES = ["open", "paused", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type Job = {
  id: string;
  title: string;
  departmentId: string | null;
  employmentType: EmploymentType;
  workMode: WorkMode;
  openings: number;
  status: JobStatus;
  description: string | null;
  requirements: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  hiringManagerId: string | null;
  createdAt: string;
};

export type Candidate = {
  id: string;
  jobId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: Source;
  stage: Stage;
  rating: number | null;
  notes: string | null;
  cvUrl: string | null;
  referredById: string | null;
  interviewAt: string | null;
  rejectedReason: string | null;
  hiredMemberId: string | null;
  stageChangedAt: string;
  createdAt: string;
};

/** Forward or back one step at a time; any active stage can end in "rejected"; "offer" can end in "hired"; an ended one can reopen. */
export function canMove(from: Stage, to: Stage) {
  if (from === to) return false;
  if (from === "hired" || from === "rejected") return to === "applied";
  if (to === "rejected") return true;
  if (to === "hired") return from === "offer";
  return Math.abs(STAGES.indexOf(to) - STAGES.indexOf(from)) === 1;
}

/** Candidates per stage, for one job or for all */
export function stageCounts(candidates: Pick<Candidate, "jobId" | "stage">[], jobId?: string) {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const c of candidates) if (!jobId || c.jobId === jobId) counts[c.stage]++;
  return counts;
}

/** Whole days since an instant ("in this stage for 6 days") */
export const daysSince = (iso: string, now: string) => Math.max(0, Math.floor((Date.parse(now) - Date.parse(iso)) / 86_400_000));
