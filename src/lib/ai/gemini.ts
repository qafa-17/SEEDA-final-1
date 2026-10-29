import "server-only";
import type { z } from "zod";

// One call to Google's Gemini API that must answer in a given JSON shape.
// The key lives only in the server's environment. Never throws: any
// problem (no key, timeout, refusal, wrong shape) comes back as a status.

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export type AiOutcome<T> = { status: "ok"; data: T } | { status: "failed" | "not_configured"; data: null };

export const isAiConfigured = () => Boolean(process.env.GEMINI_API_KEY?.trim());

export async function generateJson<T>(
  prompt: string,
  responseSchema: object,
  check: z.ZodType<T>,
  opts: { temperature: number; maxOutputTokens: number; timeoutMs: number },
): Promise<AiOutcome<T>> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { status: "not_configured", data: null };
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  if (!/^[a-z0-9.-]{3,60}$/.test(model)) return { status: "failed", data: null };

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
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
    if (!res.ok) return { status: "failed", data: null };
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = check.safeParse(JSON.parse(text));
    return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed", data: null };
  } catch {
    return { status: "failed", data: null };
  }
}
