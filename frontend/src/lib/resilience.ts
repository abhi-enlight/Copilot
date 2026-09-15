/**
 * Resilience Layer — Multi-Tenant Edge Cases #4 and #5
 * (docs/MULTI_TENANT_ARCHITECTURE_AND_PLAN.md §5)
 *
 * Edge case #4 — Noisy neighbor: a tenant hammering Graph/LLM APIs must not
 *   cause 429s for everyone. `tenantRateLimiter` enforces a per-tenant token
 *   bucket per external provider before any outbound call is made.
 *
 * Edge case #5 — Partial outage: when SharePoint/Graph returns 429/503 or
 *   times out repeatedly, `circuitBreaker` trips OPEN and callers degrade
 *   gracefully (report the outage, keep serving other connectors) instead of
 *   piling latency onto every request.
 *
 * Both are in-process. Single-instance deployments get full protection; for
 * multi-instance deployments swap the storage backend (Redis) behind the same
 * interfaces without touching call sites.
 */

// ---------------------------------------------------------------------------
// Edge case #4 — Per-tenant token bucket rate limiter
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Max burst size (bucket capacity). */
  capacity: number;
  /** Refill rate in tokens per second. */
  refillPerSecond: number;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  capacity: 30,
  refillPerSecond: 2, // sustained ~120 calls/min per tenant per provider
};

interface TokenBucket {
  tokens: number;
  lastRefillAt: number;
}

export class RateLimitExceededError extends Error {
  /** Seconds until the bucket refills enough for one call. */
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Rate limit exceeded; retry after ${retryAfterSeconds}s`);
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

class TenantRateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
    this.config = config;
  }

  /**
   * Consumes one token for `tenantKey` (org id) + `provider` (e.g. "microsoft-graph").
   * Throws RateLimitExceededError when the bucket is empty.
   */
  consume(tenantKey: string, provider: string): void {
    const key = `${tenantKey}:${provider}`;
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.config.capacity,
      lastRefillAt: now,
    };

    // Refill based on elapsed time.
    const elapsedSeconds = (now - bucket.lastRefillAt) / 1000;
    bucket.tokens = Math.min(
      this.config.capacity,
      bucket.tokens + elapsedSeconds * this.config.refillPerSecond
    );
    bucket.lastRefillAt = now;

    if (bucket.tokens < 1) {
      const needed = 1 - bucket.tokens;
      const retryAfterSeconds = Math.max(1, Math.ceil(needed / this.config.refillPerSecond));
      this.buckets.set(key, bucket);
      throw new RateLimitExceededError(retryAfterSeconds);
    }

    bucket.tokens -= 1;
    this.buckets.set(key, bucket);

    // Opportunistic cleanup so idle tenants don't leak memory.
    if (this.buckets.size > 10_000) {
      const cutoff = now - 5 * 60 * 1000;
      for (const [k, b] of this.buckets) {
        if (b.lastRefillAt < cutoff) this.buckets.delete(k);
      }
    }
  }
}

/** Shared limiter instance for all outbound provider calls. */
export const tenantRateLimiter = new TenantRateLimiter();

// ---------------------------------------------------------------------------
// Edge case #5 — Circuit breaker with graceful degradation
// ---------------------------------------------------------------------------

export type CircuitState = "closed" | "open" | "half_open";

interface CircuitRecord {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number;
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. */
  failureThreshold?: number;
  /** How long the circuit stays open before allowing a probe (ms). */
  cooldownMs?: number;
  /** Status codes that count as breaker failures. */
  failingStatuses?: number[];
}

const DEFAULT_CIRCUIT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  failingStatuses: [429, 503],
};

export class CircuitOpenError extends Error {
  retryAfterMs: number;

  constructor(name: string, retryAfterMs: number) {
    super(`Circuit "${name}" is open — provider unavailable`);
    this.name = "CircuitOpenError";
    this.retryAfterMs = retryAfterMs;
  }
}

class CircuitBreakerRegistry {
  private circuits = new Map<string, CircuitRecord>();

  private get(name: string, opts: Required<CircuitBreakerOptions>): CircuitRecord {
    let record = this.circuits.get(name);
    if (!record) {
      record = { state: "closed", consecutiveFailures: 0, openedAt: 0 };
      this.circuits.set(name, record);
      return record;
    }
    // Transition open → half_open after the cooldown elapses.
    if (record.state === "open" && Date.now() - record.openedAt >= opts.cooldownMs) {
      record.state = "half_open";
    }
    return record;
  }

  /**
   * Throws CircuitOpenError when the named circuit is open (callers should
   * degrade gracefully instead of calling the provider).
   */
  assertAvailable(name: string, opts: CircuitBreakerOptions = {}): void {
    const o = { ...DEFAULT_CIRCUIT_OPTIONS, ...opts };
    const record = this.get(name, o);
    if (record.state === "open") {
      throw new CircuitOpenError(name, Math.max(0, o.cooldownMs - (Date.now() - record.openedAt)));
    }
  }

  /** Record a successful provider call. */
  recordSuccess(name: string): void {
    const record = this.circuits.get(name);
    if (record) {
      record.state = "closed";
      record.consecutiveFailures = 0;
    }
  }

  /** Record a failing provider call (error or failing HTTP status). */
  recordFailure(name: string, opts: CircuitBreakerOptions = {}): void {
    const o = { ...DEFAULT_CIRCUIT_OPTIONS, ...opts };
    const record = this.get(name, o);
    record.consecutiveFailures += 1;
    if (
      record.state === "half_open" ||
      record.consecutiveFailures >= o.failureThreshold
    ) {
      record.state = "open";
      record.openedAt = Date.now();
    }
  }

  /** Test/debug introspection. */
  snapshot(): Array<{ name: string } & CircuitRecord> {
    return Array.from(this.circuits.entries()).map(([name, record]) => ({ name, ...record }));
  }
}

/** Shared breaker registry for all outbound provider calls. */
export const circuitBreakers = new CircuitBreakerRegistry();

// ---------------------------------------------------------------------------
// Combined wrapper — rate limit + circuit break around any provider fetch
// ---------------------------------------------------------------------------

export interface ResilientFetchOptions extends CircuitBreakerOptions {
  /** Tenant (organization id or user id) attributed for rate limiting. */
  tenantKey: string;
  /** Provider identity, doubles as the rate-limit bucket and circuit name. */
  provider: string;
  fetchImpl?: typeof fetch;
}

/**
 * Fetch with the full resilience stack:
 *   1. per-tenant rate limit check (throws RateLimitExceededError),
 *   2. circuit breaker check (throws CircuitOpenError),
 *   3. the actual fetch,
 *   4. success/failure recording so 429/503 storms trip the breaker.
 *
 * Callers catch RateLimitExceededError / CircuitOpenError and degrade
 * gracefully (plan §5.5: report other sources' results with a disclaimer).
 */
export async function resilientFetch(
  url: string,
  init: RequestInit,
  options: ResilientFetchOptions
): Promise<Response> {
  const { tenantKey, provider, fetchImpl = fetch, ...breakerOpts } = options;

  tenantRateLimiter.consume(tenantKey, provider);
  circuitBreakers.assertAvailable(provider, breakerOpts);

  try {
    const res = await fetchImpl(url, init);
    const isFailure = breakerOpts.failingStatuses
      ? (breakerOpts.failingStatuses as number[]).includes(res.status)
      : res.status === 429 || res.status === 503;

    if (isFailure) {
      circuitBreakers.recordFailure(provider, breakerOpts);
    } else {
      circuitBreakers.recordSuccess(provider);
    }
    return res;
  } catch (err) {
    // Network/timeout errors also trip the breaker.
    circuitBreakers.recordFailure(provider, breakerOpts);
    throw err;
  }
}
