import { and, eq } from "drizzle-orm";
import { candidates, departments, jobOpenings, meetings } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { hasPermission, requirePermission } from "@/server/permissions";
import { emitEvent } from "@/modules/events/service";
import { assertMemberInCompany, inviteMember, listDepartments, listMembers } from "@/modules/hq/service";
import { canMove, type Candidate, type EmploymentType, type Job, type JobStatus, type Source, type Stage, type WorkMode } from "./pipeline";

type JobRow = typeof jobOpenings.$inferSelect;
type CandidateRow = typeof candidates.$inferSelect;

function toJob(r: JobRow): Job {
  return {
    id: r.id,
    title: r.title,
    departmentId: r.departmentId,
    employmentType: r.employmentType,
    workMode: r.workMode,
    openings: r.openings,
    status: r.status,
    description: r.description,
    requirements: r.requirements,
    salaryMin: r.salaryMin,
    salaryMax: r.salaryMax,
    hiringManagerId: r.hiringManagerId,
    createdAt: r.createdAt.toISOString(),
  };
}

function toCandidate(r: CandidateRow): Candidate {
  return {
    id: r.id,
    jobId: r.jobId,
    name: r.name,
    email: r.email,
    phone: r.phone,
    source: r.source,
    stage: r.stage,
    rating: r.rating,
    notes: r.notes,
    cvUrl: r.cvUrl,
    referredById: r.referredById,
    interviewAt: r.interviewAt?.toISOString() ?? null,
    rejectedReason: r.rejectedReason,
    hiredMemberId: r.hiredMemberId,
    stageChangedAt: r.stageChangedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

const clean = (s: string | null | undefined) => s?.trim() || null;

async function assertDepartment(ctx: Ctx, companyId: string, departmentId: string | null | undefined) {
  if (!departmentId) return;
  const [d] = await ctx.tx.select({ companyId: departments.companyId }).from(departments).where(eq(departments.id, departmentId));
  if (d?.companyId !== companyId) throw new AppError("invalid");
}

async function loadCandidate(ctx: Ctx, candidateId: string) {
  const [row] = await ctx.tx.select().from(candidates).where(eq(candidates.id, candidateId));
  const candidate = found(row);
  await requirePermission(ctx, candidate.companyId, "recruitment.manage");
  return candidate;
}

// ---------- Reading ----------

/**
 * The recruitment page. Recruiters (recruitment.manage) get every job and candidate; everyone else gets the
 * open jobs and the people they referred (RLS does the filtering).
 */
export async function getRecruitmentData(ctx: Ctx, companyId: string) {
  const me = await requireMember(ctx, companyId);
  const [canManage, jobs, people, departmentList, memberList] = await Promise.all([
    hasPermission(ctx, companyId, "recruitment.manage"),
    ctx.tx.select().from(jobOpenings).where(eq(jobOpenings.companyId, companyId)),
    ctx.tx.select().from(candidates).where(eq(candidates.companyId, companyId)),
    listDepartments(ctx, companyId),
    listMembers(ctx, companyId),
  ]);
  return {
    now: new Date().toISOString(),
    meId: me.id,
    canManage,
    jobs: jobs.map(toJob).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    candidates: people.map(toCandidate),
    departments: departmentList,
    members: memberList.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
  };
}

export type RecruitmentData = Awaited<ReturnType<typeof getRecruitmentData>>;

// ---------- Jobs ----------

export type JobInput = {
  title: string;
  departmentId?: string | null;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  openings?: number;
  status?: JobStatus;
  description?: string | null;
  requirements?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  hiringManagerId?: string | null;
};

async function checkJob(ctx: Ctx, companyId: string, input: Partial<JobInput>) {
  await assertDepartment(ctx, companyId, input.departmentId);
  await assertMemberInCompany(ctx, companyId, input.hiringManagerId);
  if (input.salaryMin != null && input.salaryMax != null && input.salaryMax < input.salaryMin) throw new AppError("invalid");
}

export async function createJob(ctx: Ctx, input: { companyId: string } & JobInput) {
  const me = await requireMember(ctx, input.companyId);
  await requirePermission(ctx, input.companyId, "recruitment.manage");
  await checkJob(ctx, input.companyId, input);
  const [row] = await ctx.tx
    .insert(jobOpenings)
    .values({ ...input, title: input.title.trim(), description: clean(input.description), requirements: clean(input.requirements), createdById: me.id })
    .returning();
  return toJob(row);
}

export async function updateJob(ctx: Ctx, input: { jobId: string } & Partial<JobInput>) {
  const [current] = await ctx.tx.select().from(jobOpenings).where(eq(jobOpenings.id, input.jobId));
  const job = found(current);
  await requirePermission(ctx, job.companyId, "recruitment.manage");
  await checkJob(ctx, job.companyId, { salaryMin: job.salaryMin, salaryMax: job.salaryMax, ...input });
  const { jobId, ...change } = input;
  const [row] = await ctx.tx
    .update(jobOpenings)
    .set({
      ...change,
      ...(change.title !== undefined && { title: change.title.trim() }),
      ...(change.description !== undefined && { description: clean(change.description) }),
      ...(change.requirements !== undefined && { requirements: clean(change.requirements) }),
    })
    .where(eq(jobOpenings.id, jobId))
    .returning();
  return toJob(row);
}

/** Removes the job and its candidates. */
export async function deleteJob(ctx: Ctx, input: { jobId: string }) {
  const [current] = await ctx.tx.select().from(jobOpenings).where(eq(jobOpenings.id, input.jobId));
  await requirePermission(ctx, found(current).companyId, "recruitment.manage");
  await ctx.tx.delete(jobOpenings).where(eq(jobOpenings.id, input.jobId));
}

// ---------- Candidates ----------

/**
 * Recruiters add a candidate to any job of the company. Anyone else can only refer someone to an open job:
 * the candidate is saved as a referral by them, at the first stage.
 */
export async function addCandidate(
  ctx: Ctx,
  input: { companyId: string; jobId: string; name: string; email?: string | null; phone?: string | null; source?: Source; cvUrl?: string | null; notes?: string | null },
) {
  const me = await requireMember(ctx, input.companyId);
  const [job] = await ctx.tx.select().from(jobOpenings).where(and(eq(jobOpenings.id, input.jobId), eq(jobOpenings.companyId, input.companyId)));
  const target = found(job);
  const recruiter = await hasPermission(ctx, input.companyId, "recruitment.manage");
  if (!recruiter && target.status !== "open") throw new AppError("invalid");
  const [row] = await ctx.tx
    .insert(candidates)
    .values({
      companyId: input.companyId,
      jobId: target.id,
      name: input.name.trim(),
      email: clean(input.email)?.toLowerCase() ?? null,
      phone: clean(input.phone),
      cvUrl: clean(input.cvUrl),
      notes: clean(input.notes),
      source: recruiter ? (input.source ?? "other") : "referral",
      referredById: recruiter && input.source !== "referral" ? null : me.id,
    })
    .returning();
  await emitEvent(ctx, input.companyId, { type: "candidate.added", payload: { candidateId: row.id, jobId: row.jobId, source: row.source } });
  return toCandidate(row);
}

export async function updateCandidate(
  ctx: Ctx,
  input: { candidateId: string; name?: string; email?: string | null; phone?: string | null; rating?: number | null; notes?: string | null; cvUrl?: string | null; jobId?: string },
) {
  const candidate = await loadCandidate(ctx, input.candidateId);
  if (input.jobId) {
    const [job] = await ctx.tx.select({ companyId: jobOpenings.companyId }).from(jobOpenings).where(eq(jobOpenings.id, input.jobId));
    if (found(job).companyId !== candidate.companyId) throw new AppError("not_found");
  }
  const { candidateId, ...change } = input;
  const [row] = await ctx.tx
    .update(candidates)
    .set({
      ...change,
      ...(change.name !== undefined && { name: change.name.trim() }),
      ...(change.email !== undefined && { email: clean(change.email)?.toLowerCase() ?? null }),
      ...(change.phone !== undefined && { phone: clean(change.phone) }),
      ...(change.notes !== undefined && { notes: clean(change.notes) }),
      ...(change.cvUrl !== undefined && { cvUrl: clean(change.cvUrl) }),
    })
    .where(eq(candidates.id, candidateId))
    .returning();
  return toCandidate(row);
}

/** One step forward or back, reject (with a reason) from any active stage, or reopen. Hiring goes through hireCandidate. */
export async function moveCandidate(ctx: Ctx, input: { candidateId: string; stage: Stage; reason?: string | null }) {
  const candidate = await loadCandidate(ctx, input.candidateId);
  if (input.stage === "hired" || !canMove(candidate.stage, input.stage)) throw new AppError("invalid");
  const [row] = await ctx.tx
    .update(candidates)
    .set({ stage: input.stage, stageChangedAt: new Date(), rejectedReason: input.stage === "rejected" ? clean(input.reason) : null })
    .where(eq(candidates.id, candidate.id))
    .returning();
  return toCandidate(row);
}

/**
 * Books (or moves) the interview: an "interview" item in the company schedule, organised by the recruiter, with
 * the candidate as the contact. A candidate still at "applied" or "screening" moves to "interview".
 */
export async function scheduleInterview(
  ctx: Ctx,
  input: { candidateId: string; startsAt: string; durationMinutes: number; location?: string | null; attendeeIds?: string[] },
) {
  const candidate = await loadCandidate(ctx, input.candidateId);
  const me = await requireMember(ctx, candidate.companyId);
  if (candidate.stage === "hired" || candidate.stage === "rejected") throw new AppError("invalid");
  for (const memberId of input.attendeeIds ?? []) await assertMemberInCompany(ctx, candidate.companyId, memberId);
  const [job] = await ctx.tx.select({ title: jobOpenings.title }).from(jobOpenings).where(eq(jobOpenings.id, candidate.jobId));
  const startsAt = new Date(input.startsAt);
  const item = {
    title: `${candidate.name} — ${job.title}`,
    startsAt,
    durationMinutes: input.durationMinutes,
    location: clean(input.location),
    attendeeIds: [...new Set(input.attendeeIds ?? [])].filter((id) => id !== me.id),
    contactName: candidate.name,
    contactPhone: candidate.phone,
    contactRole: job.title,
  };
  const [existing] = candidate.interviewItemId ? await ctx.tx.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, candidate.interviewItemId)) : [];
  const [scheduled] = existing
    ? await ctx.tx.update(meetings).set({ ...item, status: "scheduled" }).where(eq(meetings.id, existing.id)).returning({ id: meetings.id })
    : await ctx.tx
        .insert(meetings)
        .values({ ...item, companyId: candidate.companyId, kind: "interview", organizerId: me.id })
        .returning({ id: meetings.id });
  const [row] = await ctx.tx
    .update(candidates)
    .set({
      interviewAt: startsAt,
      interviewItemId: scheduled.id,
      ...((candidate.stage === "applied" || candidate.stage === "screening") && { stage: "interview" as const, stageChangedAt: new Date() }),
    })
    .where(eq(candidates.id, candidate.id))
    .returning();
  return toCandidate(row);
}

/**
 * Offer accepted: the candidate is hired. With `invite`, they are also added to the team (Employee management)
 * with the job's title and department, which needs members.invite and their email. The job closes by itself
 * once all its openings are filled.
 */
export async function hireCandidate(ctx: Ctx, input: { candidateId: string; invite: boolean }) {
  const candidate = await loadCandidate(ctx, input.candidateId);
  if (!canMove(candidate.stage, "hired")) throw new AppError("invalid");
  const [job] = await ctx.tx.select().from(jobOpenings).where(eq(jobOpenings.id, candidate.jobId));
  let memberId: string | null = null;
  if (input.invite) {
    if (!candidate.email) throw new AppError("invalid");
    const title = { ar: job.title, en: job.title };
    const member = await inviteMember(ctx, { companyId: candidate.companyId, email: candidate.email, name: { ar: candidate.name, en: candidate.name }, title, departmentId: job.departmentId });
    memberId = member.id;
  }
  const [row] = await ctx.tx
    .update(candidates)
    .set({ stage: "hired", stageChangedAt: new Date(), hiredMemberId: memberId })
    .where(eq(candidates.id, candidate.id))
    .returning();
  const hired = await ctx.tx.select({ id: candidates.id }).from(candidates).where(and(eq(candidates.jobId, job.id), eq(candidates.stage, "hired")));
  if (hired.length >= job.openings && job.status !== "closed") await ctx.tx.update(jobOpenings).set({ status: "closed" }).where(eq(jobOpenings.id, job.id));
  await emitEvent(ctx, candidate.companyId, { type: "candidate.hired", payload: { candidateId: row.id, jobId: job.id, memberId } });
  return { candidate: toCandidate(row), memberId, jobClosed: hired.length >= job.openings };
}

export async function deleteCandidate(ctx: Ctx, input: { candidateId: string }) {
  const candidate = await loadCandidate(ctx, input.candidateId);
  await ctx.tx.delete(candidates).where(eq(candidates.id, candidate.id));
}
