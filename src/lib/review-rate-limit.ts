export const REVIEWS_PER_IP_PER_MINUTE = 5;

const WINDOW_MS = 60_000;

type Slot = {
  count: number;
  windowStart: number;
};

const slots = new Map<string, Slot>();

let nowFn = (): number => Date.now();

export function __setNowForTests(fn: () => number): void {
  nowFn = fn;
}

export function __resetRateLimitForTests(): void {
  slots.clear();
  nowFn = () => Date.now();
}

export function takeReviewSlot(ip: string): boolean {
  const now = nowFn();
  const existing = slots.get(ip);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    slots.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= REVIEWS_PER_IP_PER_MINUTE) {
    return false;
  }

  existing.count += 1;
  return true;
}

export function parseClientIp(
  xForwardedFor: string | null | undefined,
  xRealIp: string | null | undefined,
): string {
  if (xForwardedFor) {
    const firstHop = xForwardedFor.split(",")[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  const realIp = xRealIp?.trim();
  if (realIp) {
    return realIp;
  }

  return "local";
}
