/**
 * npm run db:seed -- [--owner you@example.com] [--reset]
 * Loads the demo data into the database in DATABASE_URL (.env.local). With --owner, that email becomes
 * the demo company's owner: sign up / sign in with it and you are linked automatically.
 */
import { config } from "dotenv";
import { db } from "../src/db";
import { seedDemo } from "../src/db/seed";

config({ path: ".env.local" });

const args = process.argv.slice(2);
const ownerIndex = args.indexOf("--owner");
const ownerEmail = ownerIndex >= 0 ? args[ownerIndex + 1] : undefined;

seedDemo(db(), { ownerEmail, reset: args.includes("--reset") })
  .then(({ slug, code }) => {
    console.log(`Seeded demo company: /c/${slug} (company code ${code})${ownerEmail ? `, owner ${ownerEmail}` : ""}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
