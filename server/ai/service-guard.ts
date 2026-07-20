export type AIServiceGuardDecision =
  | { allowed: true }
  | {
    allowed: false;
    reason: "daily-request-limit" | "daily-token-limit" | "provider-circuit-open";
    retryAfterSeconds: number;
  };

type GuardSnapshot = {
  day: string;
  requests: number;
  tokens: number;
  consecutiveProviderFailures: number;
  circuitOpen: boolean;
};

const DEFAULT_DAILY_REQUEST_LIMIT = 1_000;
const DEFAULT_DAILY_TOKEN_LIMIT = 20_000_000;
const DEFAULT_PROVIDER_FAILURE_THRESHOLD = 5;
const DEFAULT_PROVIDER_COOLDOWN_MS = 5 * 60_000;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function secondsUntilNextUtcDay(now: number): number {
  const current = new Date(now);
  const next = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now) / 1_000));
}

export class AIServiceGuard {
  private day = "";
  private requests = 0;
  private tokens = 0;
  private consecutiveProviderFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(
    private readonly dailyRequestLimit = DEFAULT_DAILY_REQUEST_LIMIT,
    private readonly dailyTokenLimit = DEFAULT_DAILY_TOKEN_LIMIT,
    private readonly providerFailureThreshold = DEFAULT_PROVIDER_FAILURE_THRESHOLD,
    private readonly providerCooldownMs = DEFAULT_PROVIDER_COOLDOWN_MS,
  ) {}

  private resetDailyWindow(now: number) {
    const nextDay = utcDay(now);
    if (this.day === nextDay) return;
    this.day = nextDay;
    this.requests = 0;
    this.tokens = 0;
  }

  beginProviderRequest(now = Date.now()): AIServiceGuardDecision {
    this.resetDailyWindow(now);
    if (this.circuitOpenedAt !== null) {
      const remaining = this.providerCooldownMs - (now - this.circuitOpenedAt);
      if (remaining > 0) {
        return { allowed: false, reason: "provider-circuit-open", retryAfterSeconds: Math.max(1, Math.ceil(remaining / 1_000)) };
      }
      this.circuitOpenedAt = null;
      this.consecutiveProviderFailures = 0;
    }
    if (this.requests >= this.dailyRequestLimit) {
      return { allowed: false, reason: "daily-request-limit", retryAfterSeconds: secondsUntilNextUtcDay(now) };
    }
    if (this.tokens >= this.dailyTokenLimit) {
      return { allowed: false, reason: "daily-token-limit", retryAfterSeconds: secondsUntilNextUtcDay(now) };
    }
    this.requests += 1;
    return { allowed: true };
  }

  recordProviderSuccess(totalTokens: number, now = Date.now()) {
    this.resetDailyWindow(now);
    this.tokens += Math.max(0, Math.round(totalTokens));
    this.consecutiveProviderFailures = 0;
    this.circuitOpenedAt = null;
  }

  recordProviderFailure(now = Date.now()) {
    this.resetDailyWindow(now);
    this.consecutiveProviderFailures += 1;
    if (this.consecutiveProviderFailures >= this.providerFailureThreshold) this.circuitOpenedAt = now;
  }

  snapshot(now = Date.now()): GuardSnapshot {
    this.resetDailyWindow(now);
    return {
      day: this.day,
      requests: this.requests,
      tokens: this.tokens,
      consecutiveProviderFailures: this.consecutiveProviderFailures,
      circuitOpen: this.circuitOpenedAt !== null && now - this.circuitOpenedAt < this.providerCooldownMs,
    };
  }
}

export function createAIServiceGuardFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AIServiceGuard {
  return new AIServiceGuard(
    positiveInteger(env.AI_DAILY_REQUEST_LIMIT, DEFAULT_DAILY_REQUEST_LIMIT),
    positiveInteger(env.AI_DAILY_TOKEN_LIMIT, DEFAULT_DAILY_TOKEN_LIMIT),
    positiveInteger(env.AI_PROVIDER_FAILURE_THRESHOLD, DEFAULT_PROVIDER_FAILURE_THRESHOLD),
    positiveInteger(env.AI_PROVIDER_COOLDOWN_MS, DEFAULT_PROVIDER_COOLDOWN_MS),
  );
}
