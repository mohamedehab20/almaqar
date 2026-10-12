import { ZodError } from "zod";

/** Stable error codes the UI can translate (keep in sync with the messages files when wiring screens). */
export type ErrorCode =
  | "unauthorized" // not signed in
  | "forbidden" // signed in, but RLS or a role check said no
  | "invalid" // input failed validation
  | "not_found"
  | "conflict" // unique value already taken (slug, code, ...)
  | "plan_limit" // the company's plan does not allow more
  | "not_configured" // Supabase env vars missing
  | "auth_failed" // wrong credentials / OTP
  | "server_error";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Postgres error code from a postgres-js error, possibly wrapped by Drizzle. */
function pgCode(error: unknown): string | undefined {
  for (let e = error as { code?: unknown; cause?: unknown } | undefined, i = 0; e && i < 3; e = e.cause as typeof e, i++) {
    if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) return e.code;
  }
  return undefined;
}

export function toErrorCode(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  if (error instanceof ZodError) return "invalid";
  switch (pgCode(error)) {
    case "42501": // insufficient_privilege, RLS violation
      return "forbidden";
    case "23505": // unique_violation
      return "conflict";
    case "23503": // foreign_key_violation (pointing at a row you cannot see)
    case "P0002":
      return "not_found";
    case "22P02": // invalid_text_representation (bad uuid, bad enum)
    case "23514":
      return "invalid";
  }
  console.error(error);
  return "server_error";
}
