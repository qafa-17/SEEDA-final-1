// Run: NODE_OPTIONS=--conditions=react-server npx tsx tests/ideas.test.mts
// Tests the web search and AI summary clients against fake services (no network).
/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles for fetch and dynamic imports */
let searchMode = "ok", aiMode = "ok";
const calls: { url: string; headers: Headers; body: any }[] = [];
const goodSummary = {
  intent: "commercial",
  intent_summary: "People typing this want to compare firms that can keep a project on budget.",
  audience: "Owners of mid-size industrial projects in Alberta.",
  angles: [{ title: "Cost Control on Alberta Pipeline Projects", why: "Results are generic; none are specific to Alberta pipelines." }],
  questions: ["What does cost control include on an EPC project?"],
};
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input);
  const body = JSON.parse(init.body);
  calls.push({ url, headers: new Headers(init.headers), body });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  if (url === "https://api.tavily.com/search") {
    if (searchMode === "down") throw new TypeError("fetch failed");
    if (searchMode === "badkey") return json({ detail: { error: "Unauthorized: secret detail" } }, 401);
    if (searchMode === "limit") return json({}, 432);
    if (searchMode === "busy") return json({}, 429);
    if (searchMode === "garbage") return json({ nope: true });
    return json({ results: [
      { title: "  Cost   control guide ", url: "https://example.com/a", content: "x".repeat(900) },
      { title: "Evil", url: "javascript:alert(1)", content: "bad" },
      { title: "", url: "https://example.com/untitled", content: "no title" },
      { title: "Second", url: "http://example.org/b" },
    ] });
  }
  if (url.startsWith("https://generativelanguage.googleapis.com/")) {
    if (aiMode === "down") throw new TypeError("fetch failed");
    if (aiMode === "500") return json({ error: { message: "secret detail" } }, 500);
    const text = aiMode === "notjson" ? "Sure! Here you go" : aiMode === "wrongshape" ? JSON.stringify({ intent: "buy now", angles: [] }) : aiMode === "blocked" ? undefined : JSON.stringify(goodSummary);
    return json(text === undefined ? { candidates: [] } : { candidates: [{ content: { parts: [{ text }] } }] });
  }
  return json({}, 404);
}) as typeof fetch;

const sm: any = await import("../src/lib/ideas/search"); const s = sm.webSearch ? sm : sm.default;
const am: any = await import("../src/lib/ideas/summarize"); const a = am.summarize ? am : am.default;
const rm: any = await import("../src/lib/ideas/regions"); const r = rm.trendsUrl ? rm : rm.default;
let fail = 0; const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok  ", m); };
const kind = async (p: Promise<unknown>) => { try { await p; return "none"; } catch (e: any) { return e.kind ?? String(e); } };

// ---- search ----
delete process.env.TAVILY_API_KEY;
ok(!s.isSearchConfigured() && (await kind(s.webSearch("x"))) === "not_configured" && calls.length === 0, "no key: not configured, nothing sent");
process.env.TAVILY_API_KEY = "tvly-test";
const results = await s.webSearch("Cost control Alberta");
ok(calls[0].headers.get("authorization") === "Bearer tvly-test" && !calls[0].url.includes("tvly-test"), "key sent in a header, never in the address");
ok(calls[0].body.search_depth === "basic" && calls[0].body.max_results === 8 && calls[0].body.country === "canada", "cheapest search depth, 8 results, Canada");
ok(results.length === 2 && results[0].title === "Cost control guide" && results[1].url === "http://example.org/b", "unsafe links and untitled results dropped, titles tidied");
ok(results[0].snippet.length <= 400 && results[1].snippet === "", "snippets length-limited; missing snippet tolerated");
for (const [mode, want] of [["down", "unavailable"], ["badkey", "auth"], ["limit", "out_of_credit"], ["busy", "rate_limited"], ["garbage", "unavailable"]] as const) {
  searchMode = mode;
  ok((await kind(s.webSearch("x y"))) === want, `search ${mode} -> ${want}`);
}
ok(!/secret|tvly|401|Unauthorized/i.test(["not_configured", "auth", "rate_limited", "out_of_credit", "unavailable"].map((k) => s.searchErrorMessage(new s.SearchError(k))).join(" ")), "raw errors never shown");
searchMode = "ok";

// ---- AI summary ----
delete process.env.GEMINI_API_KEY;
const before = calls.length;
ok((await a.summarize("Cost control", "Alberta", results)).status === "not_configured" && calls.length === before, "no AI key: not configured, nothing sent");
process.env.GEMINI_API_KEY = "ai-test";
const good = await a.summarize("Cost control", "Alberta", results);
const aiCall = calls[calls.length - 1];
ok(good.status === "ok" && good.summary.intent === "commercial" && good.summary.angles.length === 1, "good answer parsed");
ok(aiCall.headers.get("x-goog-api-key") === "ai-test" && !aiCall.url.includes("ai-test") && aiCall.url.includes("/models/gemini-3.5-flash-lite:generateContent"), "AI key in a header; default model");
ok(aiCall.body.generationConfig.responseMimeType === "application/json" && Boolean(aiCall.body.generationConfig.responseSchema), "asks for structured JSON");
const prompt: string = aiCall.body.contents[0].parts[0].text;
ok(prompt.includes('"Cost control"') && prompt.includes("Alberta") && prompt.includes("https://example.com/a") && /untrusted/i.test(prompt), "prompt carries keyword, area, sources and the untrusted-text warning");
for (const mode of ["down", "500", "notjson", "wrongshape", "blocked"]) {
  aiMode = mode;
  const out = await a.summarize("Cost control", "Alberta", results);
  ok(out.status === "failed" && out.summary === null, `AI ${mode} -> failed, no exception`);
}
aiMode = "ok";
process.env.GEMINI_MODEL = "../../evil";
ok((await a.summarize("Cost control", "Alberta", results)).status === "failed", "odd model name refused");
process.env.GEMINI_MODEL = "gemini-3.8-flash";
await a.summarize("Cost control", "Alberta", results);
ok(calls[calls.length - 1].url.includes("/models/gemini-3.8-flash:"), "model can be changed by setting");
ok(a.summarySchema.safeParse({ ...goodSummary, angles: Array(9).fill(goodSummary.angles[0]), questions: Array(9).fill(goodSummary.questions[0]) }).data.angles.length === 5, "too many angles trimmed to 5");
ok(!a.summarySchema.safeParse({ ...goodSummary, intent_summary: "x".repeat(5000) }).success, "over-long text refused");

// ---- regions ----
const t = new URL(r.trendsUrl("EPC consulting & advisory"));
ok(t.hostname === "trends.google.com" && t.searchParams.get("geo") === "CA" && t.searchParams.get("date") === "today 5-y" && t.searchParams.get("q") === "EPC consulting & advisory", "Trends link: Canada, five years, keyword safely encoded");

console.log(fail ? `${fail} FAILED` : "ALL IDEAS TESTS PASSED");
process.exit(fail ? 1 : 0);
