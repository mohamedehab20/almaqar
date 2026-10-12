/** The action layer: input validation, error codes, and the shared Zod helpers. No database needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { action } from "../../src/server/action";
import { AppError, toErrorCode } from "../../src/server/errors";
import { companyInput, id, isoDate, localized, optionalLocalized } from "../../src/server/validation";

const UUID = "0b8f4f4e-3a7d-4c1e-9d55-0d6c2b1f9a10";

test("action(): validated input reaches the handler; results are wrapped", async () => {
  const double = action(z.object({ n: z.number().int() }), async ({ n }) => n * 2);
  assert.deepEqual(await double({ n: 21 }), { ok: true, data: 42 });
});

test("action(): bad input never reaches the handler", async () => {
  let called = false;
  const guarded = action(companyInput, async () => {
    called = true;
  });
  assert.deepEqual(await guarded({ companyId: "not-a-uuid" }), { ok: false, error: "invalid" });
  assert.equal(called, false);
});

test("action(): input is trimmed and parsed before the handler sees it", async () => {
  const echo = action(z.object({ name: localized(10) }), async ({ name }) => name);
  assert.deepEqual(await echo({ name: { ar: "  مقر  ", en: "" } }), { ok: true, data: { ar: "مقر", en: "" } });
});

test("action(): thrown errors become stable codes, never exceptions", async () => {
  const fails = (error: unknown) => action(z.object({}), async () => Promise.reject(error))({});
  assert.deepEqual(await fails(new AppError("plan_limit")), { ok: false, error: "plan_limit" });
  assert.deepEqual(await fails(new AppError("forbidden", "details stay on the server")), { ok: false, error: "forbidden" });
});

test("toErrorCode(): Postgres errors, also when wrapped by Drizzle", () => {
  const pg = (code: string) => Object.assign(new Error("db"), { code });
  const wrapped = (code: string) => Object.assign(new Error("Failed query"), { cause: pg(code) });

  assert.equal(toErrorCode(pg("42501")), "forbidden", "RLS violation");
  assert.equal(toErrorCode(wrapped("42501")), "forbidden", "wrapped RLS violation");
  assert.equal(toErrorCode(pg("23505")), "conflict", "unique violation");
  assert.equal(toErrorCode(pg("23503")), "not_found", "foreign key to an invisible row");
  assert.equal(toErrorCode(pg("P0002")), "not_found", "RAISE ... no_data_found");
  assert.equal(toErrorCode(pg("22P02")), "invalid", "bad uuid / enum text");
  assert.equal(toErrorCode(pg("23514")), "invalid", "check constraint");
  assert.equal(toErrorCode(new z.ZodError([])), "invalid");
});

test("toErrorCode(): anything unknown is a server_error (and logged), not leaked", () => {
  const original = console.error;
  const logged: unknown[] = [];
  console.error = (e: unknown) => logged.push(e);
  try {
    assert.equal(toErrorCode(new Error("boom")), "server_error");
    // Auth error codes such as "user_already_exists" are words, not 5-char SQLSTATEs: not mistaken for Postgres codes
    assert.equal(toErrorCode(Object.assign(new Error("x"), { code: "user_already_exists" })), "server_error");
    assert.equal(logged.length, 2);
  } finally {
    console.error = original;
  }
});

test("validation helpers", () => {
  assert.equal(id.safeParse(UUID).success, true);
  assert.equal(id.safeParse("123").success, false);

  assert.equal(localized().safeParse({ ar: "نص", en: "" }).success, true, "one language is enough");
  assert.equal(localized().safeParse({ ar: "  ", en: "" }).success, false, "blank in both languages is rejected");
  assert.equal(localized(5).safeParse({ ar: "طويل جدا", en: "" }).success, false, "max length");
  assert.equal(optionalLocalized().safeParse({ ar: "", en: "" }).success, true);

  assert.equal(isoDate.safeParse("2026-10-12").success, true);
  assert.equal(isoDate.safeParse("12/10/2026").success, false);
  assert.equal(isoDate.safeParse("2026-02-30").success, false, "impossible date");
});
