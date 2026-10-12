import { asc, eq, sql } from "drizzle-orm";
import { agents, type Localized } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { emitEvent } from "@/modules/events/service";
import type { Agent, AgentKind, AgentStatus } from "./mock";

const EMPTY: Localized = { ar: "", en: "" };

type AgentRow = typeof agents.$inferSelect;

function toAgent(r: AgentRow): Agent {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    role: r.role ?? EMPTY,
    description: r.description ?? EMPTY,
    skills: r.skills,
    area: r.area ?? undefined,
    status: r.status,
    tasksDone: r.tasksDone,
    queue: r.queue,
  };
}

export async function listAgents(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx.select().from(agents).where(eq(agents.companyId, companyId)).orderBy(asc(agents.createdAt));
  return rows.map(toAgent);
}

export async function createAgent(
  ctx: Ctx,
  input: { companyId: string; kind: AgentKind; name: Localized; role?: Localized; description?: Localized; skills?: Localized[]; area?: Localized },
) {
  await requireMember(ctx, input.companyId);
  const [row] = await ctx.tx.insert(agents).values(input).returning();
  return toAgent(row);
}

export async function setAgentStatus(ctx: Ctx, input: { agentId: string; status: AgentStatus }) {
  const [row] = await ctx.tx.update(agents).set({ status: input.status }).where(eq(agents.id, input.agentId)).returning();
  return toAgent(found(row));
}

/**
 * Hands a task to an agent: bumps its queue and logs `agent.task_queued` with the task.
 * The agent runtime (future Python service) picks tasks up from that event and reports back with completeTask.
 */
export async function queueTask(ctx: Ctx, input: { agentId: string; task: string }) {
  const [current] = await ctx.tx.select().from(agents).where(eq(agents.id, input.agentId));
  if (found(current).status === "paused") throw new AppError("invalid");
  const [row] = await ctx.tx
    .update(agents)
    .set({ queue: sql`${agents.queue} + 1`, status: "busy" })
    .where(eq(agents.id, input.agentId))
    .returning();
  await emitEvent(ctx, row.companyId, {
    type: "agent.task_queued",
    source: "user",
    payload: { agentId: row.id, task: input.task, byUserId: ctx.userId },
  });
  return toAgent(row);
}

/** Called when the runtime finishes a task. */
export async function completeTask(ctx: Ctx, input: { agentId: string; result?: string }) {
  const [row] = await ctx.tx
    .update(agents)
    .set({
      queue: sql`greatest(${agents.queue} - 1, 0)`,
      tasksDone: sql`${agents.tasksDone} + 1`,
      status: sql`case when ${agents.queue} - 1 > 0 then 'busy'::agent_status else 'active'::agent_status end`,
    })
    .where(eq(agents.id, input.agentId))
    .returning();
  const agent = found(row);
  await emitEvent(ctx, agent.companyId, { type: "agent.task_done", source: "automation", payload: { agentId: agent.id, result: input.result } });
  return toAgent(agent);
}
