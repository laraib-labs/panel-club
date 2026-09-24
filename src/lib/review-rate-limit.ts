import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const REVIEWS_PER_IP_PER_MINUTE = 5;

export type ReviewRateLimiter = {
  limit: (identifier: string) => Promise<{ success: boolean }>;
};

const WINDOW_MS = 60_000;

type Slot = {
  count: number;
  windowStart: number;
};

type InMemoryReviewLimiter = ReviewRateLimiter & {
  __setNowForTests: (fn: () => number) => void;
  __reset: () => void;
};

let limiterOverride: ReviewRateLimiter | null = null;
let productionLimiter: Ratelimit | null = null;
let inMemoryLimiter: InMemoryReviewLimiter | null = null;

export function createInMemoryReviewLimiter(): InMemoryReviewLimiter {
  const slots = new Map<string, Slot>();
  let nowFn = (): number => Date.now();

  const limiter: InMemoryReviewLimiter = {
    async limit(ip: string) {
      const now = nowFn();
      const existing = slots.get(ip);

      if (!existing || now - existing.windowStart >= WINDOW_MS) {
        slots.set(ip, { count: 1, windowStart: now });
        return { success: true };
      }

      if (existing.count >= REVIEWS_PER_IP_PER_MINUTE) {
        return { success: false };
      }

      existing.count += 1;
      return { success: true };
    },
    __setNowForTests(fn: () => number) {
      nowFn = fn;
    },
    __reset() {
      slots.clear();
      nowFn = () => Date.now();
    },
  };

  return limiter;
}

export function __setLimiterForTests(limiter: ReviewRateLimiter | null): void {
  limiterOverride = limiter;
}

export function __setNowForTests(fn: () => number): void {
  if (!inMemoryLimiter) {
    inMemoryLimiter = createInMemoryReviewLimiter();
    limiterOverride = inMemoryLimiter;
  }
  inMemoryLimiter.__setNowForTests(fn);
}

export function __resetRateLimitForTests(): void {
  if (!inMemoryLimiter) {
    inMemoryLimiter = createInMemoryReviewLimiter();
  }
  inMemoryLimiter.__reset();
  limiterOverride = inMemoryLimiter;
}

function getProductionLimiter(): Ratelimit {
  if (!productionLimiter) {
    productionLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(REVIEWS_PER_IP_PER_MINUTE, "60 s"),
    });
  }

  return productionLimiter;
}

async function getLimiter(): Promise<ReviewRateLimiter> {
  if (limiterOverride) {
    return limiterOverride;
  }

  return getProductionLimiter();
}

export async function takeReviewSlot(ip: string): Promise<boolean> {
  const limiter = await getLimiter();
  const result = await limiter.limit(ip);
  return result.success;
}

export function parseClientIp(
  xForwardedFor: string | null | undefined,
  xRealIp: string | null | undefined,
): string {
  if (xForwardedFor) {
    const hops = xForwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);
    const lastHop = hops.at(-1);
    if (lastHop) {
      return lastHop;
    }
  }

  const realIp = xRealIp?.trim();
  if (realIp) {
    return realIp;
  }

  return "local";
}
