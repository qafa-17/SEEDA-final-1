// Run: NODE_OPTIONS=--conditions=react-server npx tsx tests/drive.test.mts
// Tests the Drive client against a fake Google API (no network, throwaway key).
import { generateKeyPairSync, createVerify } from "node:crypto";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const FOLDER = "folderAbc123456789";
process.env.DRIVE_FOLDER_ID = FOLDER;
process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "bot@proj.iam.gserviceaccount.com", private_key: privateKey.replace(/\n/g, "\\n") });

let mode = "ok"; const seen: string[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url ?? String(input);
  seen.push(url.split("?")[0]);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  if (url === "https://oauth2.googleapis.com/token") return mode === "badkey" ? json({ error: "invalid_grant" }, 400) : json({ access_token: "tok", expires_in: 3600, token_type: "Bearer" });
  const auth = new Headers(init?.headers).get("authorization");
  if (auth !== "Bearer tok") return json({}, 401);
  if (mode === "rate") return json({ error: { errors: [{ reason: "userRateLimitExceeded" }] } }, 403);
  if (mode === "down") throw new TypeError("fetch failed");
  if (url.includes("/files?")) {
    const q = new URL(url).searchParams.get("q")!;
    if (!q.includes(`'${FOLDER}' in parents`) || !q.includes("trashed = false")) return json({}, 400);
    return json({ files: [{ id: "docAAAAAAAAAAAA1", name: "Winter Logistics", modifiedTime: "2026-10-01T10:00:00Z", lastModifyingUser: { displayName: "Qafa" } }] });
  }
  if (url.includes("/export")) return new Response("# Winter Logistics\n\nBody ![][image1]\n\n[image1]: <data:image/png;base64,AAAA>", { status: 200 });
  if (url.includes("/files/docOUTSIDEFOLDER1")) return json({ id: "docOUTSIDEFOLDER1", name: "x", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-10-01T10:00:00Z", parents: ["someOtherFolder00"] });
  if (url.includes("/files/docSHEET000000001")) return json({ id: "docSHEET000000001", name: "x", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "2026-10-01T10:00:00Z", parents: [FOLDER] });
  if (url.includes("/files/docAAAAAAAAAAAA1")) return json({ id: "docAAAAAAAAAAAA1", name: "Winter Logistics", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-10-01T10:00:00Z", parents: [FOLDER] });
  return json({}, 404);
}) as typeof fetch;

const dm: any = await import("../src/lib/drive"); const d = dm.isDriveConfigured ? dm : dm.default;
const cm: any = await import("../src/lib/content/convert"); const { cleanDocMarkdown } = cm.cleanDocMarkdown ? cm : cm.default;
let fail = 0; const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok  ", m); };
const kind = async (p: Promise<unknown>) => { try { await p; return "none"; } catch (e: any) { return e.kind ?? String(e); } };

ok(d.isDriveConfigured(), "configured from env");
{
  const jwt = d.signServiceAccountJwt("bot@proj.iam.gserviceaccount.com", privateKey, 1000);
  const [h, c, sig] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, "base64url")), "JWT signature verifies");
  ok(claims.scope === "https://www.googleapis.com/auth/drive.readonly" && claims.exp - claims.iat === 3600 && claims.aud === "https://oauth2.googleapis.com/token", "JWT claims: read-only scope, 1h, Google audience");
}
const docs = await d.listFolderDocs();
ok(docs.length === 1 && docs[0].lastEditor === "Qafa", "lists folder Docs");
ok((await d.getFolderDoc("docAAAAAAAAAAAA1")).name === "Winter Logistics", "gets a Doc in the folder");
ok(await kind(d.getFolderDoc("docOUTSIDEFOLDER1")) === "not_in_folder", "refuses a Doc outside the folder");
ok(await kind(d.getFolderDoc("docSHEET000000001")) === "not_found", "refuses a non-Doc file");
ok(await kind(d.getFolderDoc("../../etc")) === "not_found", "refuses a malformed id without calling Google");
ok(await kind(d.getFolderDoc("docMISSING0000001")) === "not_found", "missing Doc");
const c = cleanDocMarkdown(await d.exportDocMarkdown("docAAAAAAAAAAAA1"), "Winter Logistics");
ok(c.markdown === "Body" && c.imagesRemoved === 1, "export + clean");
mode = "rate"; ok(await kind(d.listFolderDocs()) === "rate_limited", "rate limit mapped");
mode = "down"; ok(await kind(d.listFolderDocs()) === "unavailable", "network failure mapped");
ok(d.driveErrorMessage(new d.DriveError("not_in_folder")).includes("shared folder"), "plain-language message");
ok(!d.driveErrorMessage(new Error("raw google text 5xx")).includes("raw google"), "raw errors never shown");
process.env.DRIVE_FOLDER_ID = "bad folder' or '1'='1"; ok(!d.isDriveConfigured(), "bad folder id rejected (no query injection)");
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON; ok(await kind(d.listFolderDocs()) === "not_configured", "missing settings");
console.log(fail ? `${fail} FAILED` : "ALL DRIVE TESTS PASSED");
