// npm run db:seed-sql -- <owner email> <out.sql>
// Runs the real seedDemo() on PGlite (with all migrations), then writes one SQL script that copies the "demo"
// company into another database with the same schema (Supabase MCP execute_sql or SQL editor) when there is
// no DATABASE_URL for npm run db:seed. Events are not copied: the brief trigger recreates them on import.
import { writeFileSync } from "node:fs";
import { createTestDb } from "../tests/db/setup";
import { seedDemo } from "../src/db/seed";

const ownerEmail = process.argv[2];
const out = process.argv[3];
const t = await createTestDb();
const { companyId } = await seedDemo(t.db, { ownerEmail });

// Parent tables first so foreign keys resolve; same order as the seed inserted them
const tables = [
  "companies", "departments", "members", "rooms", "furniture", "zones", "clients", "client_users", "briefs",
  "marketing_ideas", "suppliers", "workflows", "workflow_runs", "orders", "notes", "agents",
];
const parts: string[] = ["BEGIN;"];
for (const table of tables) {
  const where = table === "companies" ? "id = $1" : table === "client_users" ? "client_id IN (SELECT id FROM clients WHERE company_id = $1)" : "company_id = $1";
  const order = ["orders", "workflow_runs", "briefs", "notes"].includes(table) ? " ORDER BY created_at, ctid" : "";
  const { rows } = await t.pg.query<{ j: unknown }>(`SELECT coalesce(json_agg(to_json(exported_row)), '[]') AS j FROM (SELECT * FROM ${table} WHERE ${where}${order}) exported_row`, [companyId]);
  const json = JSON.stringify(rows[0].j).replace(/'/g, "''");
  parts.push(`INSERT INTO public.${table} SELECT * FROM json_populate_recordset(NULL::public.${table}, '${json}'::json);`);
}
parts.push("COMMIT;");
writeFileSync(out, parts.join("\n"));
console.log("tables:", tables.length, "bytes:", parts.join("\n").length);
