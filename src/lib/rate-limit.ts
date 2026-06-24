import { createHash } from "crypto";

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  scope: string;
  limit: number;
  windowMs: number;
};

function clientKey(request: Request, scope: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "0.0.0.0";
  return createHash("sha256").update(`${scope}|${ip}`).digest("hex").slice(0, 16);
}

export function rateLimit(
  request: Request,
  config: RateLimitConfig
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const key = clientKey(request, config.scope);
  const now = Date.now();
  const cutoff = now - config.windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };

  bucket.hits = bucket.hits.filter((timestamp) => timestamp > cutoff);
  if (bucket.hits.length >= config.limit) {
    const retryMs = bucket.hits[0] + config.windowMs - now;
    buckets.set(key, bucket);
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true };
}

export function applyRateLimit(
  request: Request,
  config: RateLimitConfig
): Response | null {
  const result = rateLimit(request, config);
  if (result.ok) return null;
  return Response.json(
    { error: `Rate limit exceeded. Try again in ${result.retryAfterSeconds}s.` },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    }
  );
}

const SWEEP_INTERVAL_MS = 1000 * 60 * 10;
let sweepHandle: ReturnType<typeof setInterval> | null = null;

function ensureSweeper() {
  if (sweepHandle) return;
  sweepHandle = setInterval(() => {
    const cutoff = Date.now() - 1000 * 60 * 60;
    for (const [key, bucket] of buckets) {
      if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] < cutoff) {
        buckets.delete(key);
      }
    }
  }, SWEEP_INTERVAL_MS);
  if (typeof sweepHandle.unref === "function") sweepHandle.unref();
}

ensureSweeper();
