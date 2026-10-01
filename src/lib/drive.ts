import "server-only";
import { createSign } from "node:crypto";
import { z } from "zod";

// Google Drive access through the app's own service account. It can only
// see what has been shared with it (the one Knowledge Hub folder), and it
// only ever READS: the scope below is read-only.

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const API = "https://www.googleapis.com/drive/v3";
const DOC_MIME = "application/vnd.google-apps.document";
const TIMEOUT_MS = 15_000;
const MAX_EXPORT_BYTES = 5_000_000;

export const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;

export type DriveErrorKind = "not_configured" | "auth" | "not_found" | "not_in_folder" | "rate_limited" | "too_large" | "unavailable";

export class DriveError extends Error {
  constructor(public kind: DriveErrorKind, detail?: string) {
    super(detail ?? kind);
  }
}

/** What to tell a person, for each kind of failure. Never shows Google's raw errors. */
export function driveErrorMessage(e: unknown): string {
  const kind = e instanceof DriveError ? e.kind : "unavailable";
  switch (kind) {
    case "not_configured":
      return "Google Drive isn't connected yet. An admin needs to finish the Drive setup.";
    case "auth":
      return "The hub couldn't sign in to Google Drive. An admin should check the Drive connection settings.";
    case "not_found":
      return "That Doc couldn't be found. It may have been deleted, or it isn't shared with the hub.";
    case "not_in_folder":
      return "That Doc isn't in the Knowledge Hub folder. Move it into the shared folder first.";
    case "rate_limited":
      return "Google Drive is busy right now. Wait a minute and try again.";
    case "too_large":
      return "That Doc is too large to import. Split it into smaller articles.";
    default:
      return "Google Drive didn't respond. Try again in a moment.";
  }
}

const serviceAccount = z.object({ client_email: z.email(), private_key: z.string().min(100) });

function config() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const folderId = process.env.DRIVE_FOLDER_ID?.trim();
  if (!raw || !folderId) throw new DriveError("not_configured");
  if (!DRIVE_ID.test(folderId)) throw new DriveError("not_configured", "DRIVE_FOLDER_ID has an unexpected format");
  let parsed;
  try {
    parsed = serviceAccount.parse(JSON.parse(raw));
  } catch {
    throw new DriveError("not_configured", "GOOGLE_SERVICE_ACCOUNT_JSON is not a valid service account key");
  }
  return { folderId, email: parsed.client_email, key: parsed.private_key.replace(/\\n/g, "\n") };
}

export function isDriveConfigured(): boolean {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

// Access token for the service account, using Google's documented
// "JWT bearer" sign-in: sign a short claim with the account's private key,
// trade it for an access token, and reuse that token until shortly before
// it expires. https://developers.google.com/identity/protocols/oauth2/service-account
const TOKEN_URL = "https://oauth2.googleapis.com/token";
let cached: { token: string; expiresAt: number } | null = null;

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export function signServiceAccountJwt(email: string, key: string, nowSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key);
  return `${header}.${claims}.${b64url(signature)}`;
}

async function accessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const { email, key } = config();
  let assertion: string;
  try {
    assertion = signServiceAccountJwt(email, key, Math.floor(Date.now() / 1000));
  } catch {
    throw new DriveError("not_configured", "The service account private key could not be read");
  }
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new DriveError("unavailable");
  }
  if (!res.ok) throw new DriveError("auth");
  const body = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).safeParse(await res.json().catch(() => null));
  if (!body.success) throw new DriveError("auth");
  cached = { token: body.data.access_token, expiresAt: Date.now() + body.data.expires_in * 1000 };
  return cached.token;
}

async function driveGet(path: string, params: Record<string, string>): Promise<Response> {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof DriveError) throw e;
    throw new DriveError("unavailable");
  }
  if (res.ok) return res;
  if (res.status === 401) throw new DriveError("auth");
  if (res.status === 404) throw new DriveError("not_found");
  if (res.status === 403) {
    const text = await res.text().catch(() => "");
    if (/rateLimit|userRateLimit|quota/i.test(text)) throw new DriveError("rate_limited");
    if (/exportSizeLimitExceeded/i.test(text)) throw new DriveError("too_large");
    throw new DriveError("not_found");
  }
  if (res.status === 429) throw new DriveError("rate_limited");
  throw new DriveError("unavailable");
}

export type DriveDoc = { id: string; name: string; modifiedTime: string; lastEditor: string | null };

const listSchema = z.object({
  files: z.array(
    z.object({
      id: z.string().regex(DRIVE_ID),
      name: z.string(),
      modifiedTime: z.string(),
      lastModifyingUser: z.object({ displayName: z.string().optional() }).optional(),
    }),
  ),
});

/** Google Docs in the Knowledge Hub folder, most recently edited first. */
export async function listFolderDocs(): Promise<DriveDoc[]> {
  const { folderId } = config();
  const res = await driveGet("/files", {
    q: `'${folderId}' in parents and mimeType = '${DOC_MIME}' and trashed = false`,
    fields: "files(id,name,modifiedTime,lastModifyingUser(displayName))",
    orderBy: "modifiedTime desc",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const data = listSchema.parse(await res.json());
  return data.files.map((f) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    lastEditor: f.lastModifyingUser?.displayName ?? null,
  }));
}

const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  modifiedTime: z.string(),
  trashed: z.boolean().optional(),
  parents: z.array(z.string()).optional(),
});

/** One Doc's details, refusing anything outside the Knowledge Hub folder. */
export async function getFolderDoc(fileId: string): Promise<DriveDoc> {
  if (!DRIVE_ID.test(fileId)) throw new DriveError("not_found");
  const { folderId } = config();
  const res = await driveGet(`/files/${fileId}`, {
    fields: "id,name,mimeType,modifiedTime,trashed,parents",
    supportsAllDrives: "true",
  });
  const f = fileSchema.parse(await res.json());
  if (f.mimeType !== DOC_MIME || f.trashed) throw new DriveError("not_found");
  if (!f.parents?.includes(folderId)) throw new DriveError("not_in_folder");
  return { id: f.id, name: f.name, modifiedTime: f.modifiedTime, lastEditor: null };
}

/** The Doc as Markdown, converted by Google. */
export async function exportDocMarkdown(fileId: string): Promise<string> {
  if (!DRIVE_ID.test(fileId)) throw new DriveError("not_found");
  const res = await driveGet(`/files/${fileId}/export`, { mimeType: "text/markdown" });
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_EXPORT_BYTES) throw new DriveError("too_large");
  const text = await res.text();
  if (text.length > MAX_EXPORT_BYTES) throw new DriveError("too_large");
  return text;
}
