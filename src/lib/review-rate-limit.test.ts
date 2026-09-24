import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  REVIEWS_PER_IP_PER_MINUTE,
  __resetRateLimitForTests,
  __setNowForTests,
  parseClientIp,
  takeReviewSlot,
} from "./review-rate-limit.ts";

beforeEach(() => {
  __resetRateLimitForTests();
});

afterEach(() => {
  __resetRateLimitForTests();
});

describe("parseClientIp", () => {
  it("uses the last hop from x-forwarded-for (Vercel trusted)", () => {
    assert.equal(parseClientIp("203.0.113.1, 198.51.100.2", null), "198.51.100.2");
  });

  it("falls back to x-real-ip", () => {
    assert.equal(parseClientIp(null, "198.51.100.9"), "198.51.100.9");
  });

  it("returns local when no headers are present", () => {
    assert.equal(parseClientIp(undefined, undefined), "local");
  });
});

describe("takeReviewSlot", () => {
  it("allows five review posts per ip per minute", async () => {
    const ip = "203.0.113.50";

    for (let i = 0; i < REVIEWS_PER_IP_PER_MINUTE; i += 1) {
      assert.equal(await takeReviewSlot(ip), true, `expected slot ${i + 1} to succeed`);
    }
  });

  it("rejects the sixth post in the same window", async () => {
    const ip = "203.0.113.51";

    for (let i = 0; i < REVIEWS_PER_IP_PER_MINUTE; i += 1) {
      await takeReviewSlot(ip);
    }

    assert.equal(await takeReviewSlot(ip), false);
  });

  it("resets the window after one minute", async () => {
    const ip = "203.0.113.52";
    let now = 1_000_000;

    __setNowForTests(() => now);

    for (let i = 0; i < REVIEWS_PER_IP_PER_MINUTE; i += 1) {
      assert.equal(await takeReviewSlot(ip), true);
    }
    assert.equal(await takeReviewSlot(ip), false);

    now += 60_000;
    assert.equal(await takeReviewSlot(ip), true);
  });

  it("tracks ips independently", async () => {
    const ipA = "203.0.113.60";
    const ipB = "203.0.113.61";

    for (let i = 0; i < REVIEWS_PER_IP_PER_MINUTE; i += 1) {
      assert.equal(await takeReviewSlot(ipA), true);
    }
    assert.equal(await takeReviewSlot(ipA), false);
    assert.equal(await takeReviewSlot(ipB), true);
  });
});
