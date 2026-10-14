"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id } from "@/server/validation";
import { EMPLOYMENT_TYPES, JOB_STATUSES, SOURCES, STAGES, WORK_MODES } from "./pipeline";
import * as svc from "./service";

const text = (max: number) => z.string().trim().max(max).nullable().optional();
const money = z.number().min(0).max(100_000_000).nullable().optional();

const job = z.object({
  title: z.string().trim().min(1).max(120),
  departmentId: id.nullable().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  workMode: z.enum(WORK_MODES).optional(),
  openings: z.number().int().min(1).max(500).optional(),
  status: z.enum(JOB_STATUSES).optional(),
  description: text(4000),
  requirements: text(4000),
  salaryMin: money,
  salaryMax: money,
  hiringManagerId: id.nullable().optional(),
});

export const createJob = action(companyInput.extend(job.shape), (input) => withUser((ctx) => svc.createJob(ctx, input)));

export const updateJob = action(z.object({ jobId: id, ...job.partial().shape }), (input) => withUser((ctx) => svc.updateJob(ctx, input)));

export const deleteJob = action(z.object({ jobId: id }), (input) => withUser((ctx) => svc.deleteJob(ctx, input)));

const contact = {
  email: z.email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  phone: text(40),
  cvUrl: z.url().max(1000).nullable().optional().or(z.literal("").transform(() => null)),
  notes: text(4000),
};

/** Recruiters add anyone; other members refer someone to an open job */
export const addCandidate = action(
  companyInput.extend({ jobId: id, name: z.string().trim().min(1).max(120), source: z.enum(SOURCES).optional(), ...contact }),
  (input) => withUser((ctx) => svc.addCandidate(ctx, input)),
);

export const updateCandidate = action(
  z.object({ candidateId: id, jobId: id.optional(), name: z.string().trim().min(1).max(120).optional(), rating: z.number().int().min(1).max(5).nullable().optional(), ...contact }),
  (input) => withUser((ctx) => svc.updateCandidate(ctx, input)),
);

export const moveCandidate = action(
  z.object({ candidateId: id, stage: z.enum(STAGES), reason: text(500) }),
  (input) => withUser((ctx) => svc.moveCandidate(ctx, input)),
);

export const scheduleInterview = action(
  z.object({ candidateId: id, startsAt: z.iso.datetime({ offset: true }), durationMinutes: z.number().int().min(10).max(480), location: text(300), attendeeIds: z.array(id).max(20).optional() }),
  (input) => withUser((ctx) => svc.scheduleInterview(ctx, input)),
);

export const hireCandidate = action(z.object({ candidateId: id, invite: z.boolean() }), (input) => withUser((ctx) => svc.hireCandidate(ctx, input)));

export const deleteCandidate = action(z.object({ candidateId: id }), (input) => withUser((ctx) => svc.deleteCandidate(ctx, input)));
