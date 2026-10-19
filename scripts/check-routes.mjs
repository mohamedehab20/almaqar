// npm run check:routes   (start the app first: npm run build && npx next start -p 3123, or set BASE_URL)
// Requests every page in Arabic and English and checks status, lang/dir, error text and key content,
// plus the after-sign-in route and Clerk default paths, a non-demo company while signed out (→ /login) and a broken auth cookie.
const base = process.env.BASE_URL ?? "http://localhost:3123";
const pages = [
  ["/", "هنا يبدأ"], ["/pricing", "300"], ["/compass", "بوصلة"], ["/login", "افتح أبواب"], ["/employee-login", ""],
  ["/visitor-login", ""], ["/signup", ""], ["/join", "فعّل حسابك"], ["/client-portal", ""], ["/c/demo", ""], ["/c/demo/hr/employees", "إدارة الموظفين"], ["/c/demo/hr", "قريباً"], ["/c/demo/hr/leave", "الإجازات"], ["/c/demo/hr/client-portal", "زائر اجتماع"], ["/c/demo/hr/recruitment", "مسار المرشحين"], ["/c/demo/hr/departments", "أقسام المقر"], ["/c/demo/hr/work-hours", "ساعات العمل"],
  ["/c/demo/operations", ""], ["/c/demo/automation", ""], ["/c/demo/marketing", ""], ["/c/demo/permissions", "الصلاحيات"], ["/c/demo/meetings", "غرفة الاجتماعات"], ["/c/demo/meetings?tab=tasks", "إدارة المهام"], ["/c/demo/meetings?tab=approvals", "اعتماد شراء كاميرا"], ["/c/demo/analytics", "مقارنة الأقسام"],
];
let failures = 0;
const rows = [];
for (const locale of ["ar", "en"]) {
  for (const [path, mustContain] of pages) {
    const url = base + (locale === "en" ? (path === "/" ? "/en" : "/en" + path) : path);
    const t0 = performance.now();
    // Company pages open as a guest only with the guest button's cookie
    const res = await fetch(url, { redirect: "manual", headers: { cookie: "almaqr_guest=1" } });
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
const toLogin = other.status === 307 && new URL(other.headers.get("location") ?? "", base).pathname === "/login";
if (!toLogin) failures++;
console.log(`${toLogin ? "PASS" : "FAIL"} signed out, other company → ${other.status} ${other.headers.get("location") ?? ""}`);

// A company link opened in another browser (no sign-in, no guest cookie) asks to sign in, then comes back
for (const [path, login] of [["/c/demo", "/login"], ["/c/demo/marketing", "/login"], ["/en/c/demo/hr", "/en/login"], ["/c/some-company/operations", "/login"]]) {
  const res = await fetch(base + path, { redirect: "manual" });
  const loc = new URL(res.headers.get("location") ?? "/", base);
  const ok = res.status === 307 && loc.pathname === login && loc.searchParams.get("next") === path;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} shared link ${path} without sign-in → ${res.status} ${loc.pathname}${loc.search}`);
}

// Rooms marked "coming soon" go back to the main hall
for (const path of ["/c/demo/sales", "/c/demo/agents", "/en/c/demo/sales", "/en/c/demo/agents"]) {
  const res = await fetch(base + path, { redirect: "manual", headers: { cookie: "almaqr_guest=1" } });
  const hall = path.startsWith("/en") ? "/en/c/demo" : "/c/demo";
  const ok = [307, 308].includes(res.status) && (res.headers.get("location") ?? "").endsWith(hall);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${path} (coming soon) → ${res.status} ${res.headers.get("location") ?? ""}`);
}

// Session refresh in the proxy must not break pages when a stale Supabase cookie is present
const stale = await fetch(base + "/c/demo", { headers: { cookie: "almaqr_guest=1; sb-rosifnxvdpwkvpqzguzj-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJiYWQifQ" } });
if (stale.status !== 200) failures++;
console.log(`${stale.status === 200 ? "PASS" : "FAIL"} page with a broken auth cookie → ${stale.status}`);

console.log(failures ? `\n${failures} FAILED` : "\nFRONTEND ROUTES: ALL PASSED");
process.exit(failures ? 1 : 0);
