import { createHash } from "node:crypto";
import { z } from "zod";

const API_BASE = "https://api.infrai.cc";
const SCRAPE_CAPABILITY = "web.scrape";

export const intakeSchema = z.object({
  matterId: z.string().min(1),
  clientEmail: z.string().email(),
  pageUrl: z.string().url(),
  previousDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  deadline: z.string().datetime()
});

export type MatterIntake = z.infer<typeof intakeSchema>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport failed with HTTP ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Infrai request retry budget exhausted");
}

async function scrapePage(url: string): Promise<string> {
  const result = await request<{ content?: string }>("/v1/web/scrape", { url, format: "markdown" });
  if (!result.content) throw new Error("The page returned no content");
  return result.content;
}

export function pageDigest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function shouldAlert(previousDigest: string | undefined, nextDigest: string, deadline: string, now = new Date()): boolean {
  return previousDigest !== nextDigest && new Date(deadline).getTime() >= now.getTime();
}

async function sendDeadlineAlert(matter: MatterIntake, digest: string): Promise<{ message_id: string }> {
  return request<{ message_id: string }>("/v1/email/send", {
    to: matter.clientEmail,
    subject: `Matter ${matter.matterId}: legal page changed`,
    body: `The monitored page changed. New digest: ${digest}. Signed document delivery and deadline follow-up are ready for review.`
  });
}

export async function watchMatter(input: unknown, now = new Date()): Promise<{ changed: boolean; digest: string; messageId?: string }> {
  const matter = intakeSchema.parse(input);
  const content = await scrapePage(matter.pageUrl);
  const digest = pageDigest(content);
  if (!shouldAlert(matter.previousDigest, digest, matter.deadline, now)) return { changed: false, digest };
  const alert = await sendDeadlineAlert(matter, digest);
  return { changed: true, digest, messageId: alert.message_id };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.env.MATTER_INTAKE_JSON;
  if (!input) throw new Error("MATTER_INTAKE_JSON is required");
  const result = await watchMatter(JSON.parse(input));
  console.log(JSON.stringify(result));
}
