// npm run check:routes   (start the app first: npm run build && npx next start -p 3123, or set BASE_URL)
// Requests every page in Arabic and English and checks status, lang/dir, error text and key content,
// plus the after-sign-in route and Clerk default paths, a non-demo company while signed out (→ /login) and a broken auth cookie.
const base = process.env.BASE_URL ?? "http://localhost:3123";
const pages = [
  ["/", "هنا يبدأ"], ["/pricing", "300"], ["/compass", "بوصلة"], ["/login", "افتح أبواب"], ["/employee-login", ""],
  ["/visitor-login", ""], ["/signup", ""], ["/join", "فعّل حسابك"], ["/client-portal", ""], ["/c/demo", ""], ["/c/demo/hr", ""],
  ["/c/demo/operations", ""], ["/c/demo/automation", ""], ["/c/demo/sales", "SO-"], ["/c/demo/marketing", ""], ["/c/demo/agents", ""],
];
let failures = 0;
const rows = [];
for (const locale of ["ar", "en"]) {
  for (const [path, mustContain] of pages) {
    const url = base + (locale === "en" ? (path === "/" ? "/en" : "/en" + path) : path);
    const t0 = performance.now();
    const res = await fetch(url, { redirect: "manual" });
    const ms = Math.round(performance.now() - t0);
    const html = await res.text();
    const dir = html.match(/<html[^>]*dir="(rtl|ltr)"/)?.[1];
    const lang = html.match(/<html[^>]*lang="([a-z]+)"/)?.[1];
    const problems = [];
    if (res.status !== 200) problems.push(`status ${res.status}`);
    if (lang !== locale) problems.push(`lang=${lang}`);
    if (dir !== (locale === "ar" ? "rtl" : "ltr")) problems.push(`dir=${dir}`);
    if (/Application error|Internal Server Error|Unhandled Runtime Error|NEXT_HTTP_ERROR/.test(html)) problems.push("error text in page");
    if (locale === "ar" && mustContain && !html.includes(mustContain)) problems.push(`missing "${mustContain}"`);
    if (problems.length) failures++;
    rows.push(`${problems.length ? "FAIL" : "PASS"} ${locale} ${path.padEnd(20)} ${String(ms).padStart(5)}ms ${problems.join(", ")}`);
  }
}
console.log(rows.join("\n"));

// After-sign-in route (Clerk lands here): signed out it sends you to sign in, keeping the language
for (const [query, expected] of [["", "/login"], ["?locale=en", "/en/login"]]) {
  const res = await fetch(base + "/api/auth/after-sign-in" + query, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const ok = res.status === 307 && loc.endsWith(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} /api/auth/after-sign-in${query} signed out → ${res.status} ${loc}`);
}
// Clerk default paths go to our own pages
for (const [path, expected] of [["/sign-in", "/login"], ["/sign-up", "/signup"]]) {
  const res = await fetch(base + path, { redirect: "manual" });
  const ok = res.status === 307 && (res.headers.get("location") ?? "").endsWith(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${path} → ${expected}`);
}
// Signed out, any company but the public demo sends you to sign in (no hint whether it exists)
const other = await fetch(base + "/c/does-not-exist", { redirect: "manual" });
const toLogin = other.status === 307 && (other.headers.get("location") ?? "").endsWith("/login");
if (!toLogin) failures++;
console.log(`${toLogin ? "PASS" : "FAIL"} signed out, other company → ${other.status} ${other.headers.get("location") ?? ""}`);

// Session refresh in the proxy must not break pages when a stale Supabase cookie is present
const stale = await fetch(base + "/c/demo", { headers: { cookie: "sb-rosifnxvdpwkvpqzguzj-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJiYWQifQ" } });
if (stale.status !== 200) failures++;
console.log(`${stale.status === 200 ? "PASS" : "FAIL"} page with a broken auth cookie → ${stale.status}`);

console.log(failures ? `\n${failures} FAILED` : "\nFRONTEND ROUTES: ALL PASSED");
process.exit(failures ? 1 : 0);
