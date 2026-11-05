import "server-only";
import type { z } from "zod";

// One call to Google's Gemini API that must answer in a given JSON shape.
// The key lives only in the server's environment. Never throws: any
// problem (no key, timeout, refusal, wrong shape) comes back as a status.

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** On failure, `reason` says what went wrong in a few words (safe to show; never contains the key). */
export type AiOutcome<T> = { status: "ok"; data: T } | { status: "failed" | "not_configured"; data: null; reason: string };

export const isAiConfigured = () => Boolean(process.env.GEMINI_API_KEY?.trim());

export async function generateJson<T>(
  prompt: string,
  responseSchema: object,
  check: z.ZodType<T>,
  opts: { temperature: number; maxOutputTokens: number; timeoutMs: number },
): Promise<AiOutcome<T>> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { status: "not_configured", data: null, reason: "no AI key" };
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  if (!/^[a-z0-9.-]{3,60}$/.test(model)) return { status: "failed", data: null, reason: "invalid GEMINI_MODEL" };

  const fail = (reason: string, detail?: unknown): AiOutcome<T> => {
    // Shows in Vercel's logs, so a failure can be diagnosed without guessing.
    console.error(`[gemini] ${model}: ${reason}`, detail ?? "");
    return { status: "failed", data: null, reason };
  };

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: opts.temperature,
          maxOutputTokens: opts.maxOutputTokens,
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    return fail(e instanceof Error && e.name === "TimeoutError" ? "the AI took too long" : "couldn't reach the AI service");
  }
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return fail(res.status === 429 ? "the AI service's rate limit was hit" : `the AI service answered ${res.status}`, err.slice(0, 800));
  }
  const body = (await res.json().catch(() => null)) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] } | null;
  const candidate = body?.candidates?.[0];
  const text = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
  if (!text) return fail(`empty answer (${candidate?.finishReason ?? "no reason given"})`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(candidate?.finishReason === "MAX_TOKENS" ? "the answer was cut off (too long)" : "the answer wasn't valid JSON", text.slice(-300));
  }
  const parsed = check.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`the answer had the wrong shape at ${issue?.path.join(".") || "top level"}`, issue?.message);
  }
  return { status: "ok", data: parsed.data };
}
