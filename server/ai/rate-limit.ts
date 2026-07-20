type WindowRecord = { startedAt: number; count: number; active: number };

export type RateLimitDecision =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: "rate-limited" | "ip-busy" | "service-busy"; retryAfterSeconds: number };

export class AnonymousAIRateLimiter {
  private readonly records = new Map<string, WindowRecord>();
  private globalActive = 0;
  private lastSweep = 0;

  constructor(
    private readonly requestLimit = 10,
    private readonly windowMs = 5 * 60_000,
    private readonly perIpConcurrent = 2,
    private readonly globalConcurrent = 20,
  ) {}

  acquire(ip: string, now = Date.now()): RateLimitDecision {
    if (now - this.lastSweep >= this.windowMs || this.records.size > 5_000) {
      for (const [key, value] of this.records) {
        if (value.active === 0 && now - value.startedAt >= this.windowMs) this.records.delete(key);
      }
      this.lastSweep = now;
    }
    let record = this.records.get(ip);
    if (!record || now - record.startedAt >= this.windowMs) {
      record = { startedAt: now, count: 0, active: record?.active ?? 0 };
      this.records.set(ip, record);
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((record.startedAt + this.windowMs - now) / 1_000));
    if (record.count >= this.requestLimit) return { allowed: false, reason: "rate-limited", retryAfterSeconds };
    if (record.active >= this.perIpConcurrent) return { allowed: false, reason: "ip-busy", retryAfterSeconds: 5 };
    if (this.globalActive >= this.globalConcurrent) return { allowed: false, reason: "service-busy", retryAfterSeconds: 10 };

    record.count += 1;
    record.active += 1;
    this.globalActive += 1;
    let released = false;
    return {
      allowed: true,
      release: () => {
        if (released) return;
        released = true;
        record!.active = Math.max(0, record!.active - 1);
        this.globalActive = Math.max(0, this.globalActive - 1);
      },
    };
  }
}
