import type { z } from "zod";
import { toErrorCode, type ErrorCode } from "./errors";

/** What every Server Action returns. Actions never throw to the client. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ErrorCode };

/**
 * Builds a Server Action: validates the input with `schema`, runs `handler`, and turns any
 * error into a stable code. Use it for every export of an `actions.ts` file.
 */
export function action<S extends z.ZodType, T>(schema: S, handler: (input: z.output<S>) => Promise<T>) {
  return async (input: z.input<S>): Promise<ActionResult<T>> => {
    try {
      return { ok: true, data: await handler(schema.parse(input)) };
    } catch (error) {
      return { ok: false, error: toErrorCode(error) };
    }
  };
}
