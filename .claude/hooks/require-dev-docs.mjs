// Claude Code hook: every code change in this repo must also update development-almaqar/.
// - PreToolUse (Bash): denies a `git commit` when code changed but the docs folder did not.
// - Stop: blocks the agent from ending its turn while code changes (uncommitted or unpushed)
//   have no matching docs change.
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = "development-almaqar/";
// Paths that are not product code: agent instructions, tooling, generated files.
const IGNORED = [/^AGENTS\.md$/, /^CLAUDE\.md$/, /^\.claude\//, /^\.next\//, /\.tsbuildinfo$/];

const git = (...args) =>
  execFileSync("git", ["-c", "core.quotepath=false", ...args], { cwd: repo, encoding: "utf8" });

function changedPaths() {
  const paths = new Set();
  // Uncommitted: staged, unstaged and untracked.
  for (const entry of git("status", "--porcelain", "-z", "--untracked-files=all").split("\0")) {
    if (entry.length > 3) paths.add(entry.slice(3));
  }
  // Committed but not pushed yet.
  try {
    for (const p of git("log", "@{u}..HEAD", "--name-only", "--format=").split("\n")) {
      if (p) paths.add(p);
    }
  } catch {
    // No upstream configured: only uncommitted changes count.
  }
  return [...paths];
}

function missingDocs() {
  const paths = changedPaths();
  const code = paths.filter((p) => !p.startsWith(DOCS) && !IGNORED.some((re) => re.test(p)));
  const docs = paths.filter((p) => p.startsWith(DOCS));
  return code.length > 0 && docs.length === 0 ? code : null;
}

const message = (code) =>
  `Code changed without updating ${DOCS}: ${code.slice(0, 8).join(", ")}${code.length > 8 ? ", ..." : ""}. ` +
  `Follow the checklist in ${DOCS}README.md: add an entry at the top of the current phase in 04-milestones.md, ` +
  `and update 03-routes-and-modules.md / 05-decisions.md / 06-backend-handoff.md where relevant. ` +
  `Include the docs in the same commit as the code.`;

let input = {};
try {
  const raw = await new Promise((res) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => res(data));
  });
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(0);
}

const event = input.hook_event_name;

if (event === "PreToolUse") {
  const command = input.tool_input?.command ?? "";
  if (!/\bgit\b[^\n;&|]*\bcommit\b/.test(command)) process.exit(0);
  const code = missingDocs();
  if (code) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: message(code),
      },
    }));
  }
} else if (event === "Stop") {
  if (input.stop_hook_active) process.exit(0);
  const code = missingDocs();
  if (code) console.log(JSON.stringify({ decision: "block", reason: message(code) }));
}
