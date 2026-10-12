import { and, eq } from "drizzle-orm";
import { lessonProgress } from "@/db/schema";
import type { Ctx } from "@/server/context";

/** Lesson ids the caller has completed. Course content itself stays in mock.ts. */
export async function getMyProgress(ctx: Ctx) {
  const rows = await ctx.tx.select({ lessonId: lessonProgress.lessonId }).from(lessonProgress).where(eq(lessonProgress.userId, ctx.userId));
  return rows.map((r) => r.lessonId);
}

export async function setLessonDone(ctx: Ctx, input: { lessonId: string; done: boolean }) {
  if (input.done) {
    await ctx.tx.insert(lessonProgress).values({ userId: ctx.userId, lessonId: input.lessonId }).onConflictDoNothing();
  } else {
    await ctx.tx.delete(lessonProgress).where(and(eq(lessonProgress.userId, ctx.userId), eq(lessonProgress.lessonId, input.lessonId)));
  }
  return getMyProgress(ctx);
}
