import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  REVIEWS_PER_IP_PER_MINUTE,
  __resetRateLimitForTests,
  __setNowForTests,
  parseClientIp,
  takeReviewSlot,
} from "./review-rate-limit.ts";

afterEach(() => {
  __resetRateLimitForTests();
});

describe("parseClientIp", () => {
  it("uses the first hop from x-forwarded-for", () => {
    assert.equal(parseClientIp("203.0.113.1, 198.51.100.2", null), "203.0.113.1");
  });

  it("falls back to x-real-ip", () => {
    assert.equal(parseClientIp(null, "198.51.100.9"), "198.51.100.9");
  });

  it("returns local when no headers are present", () => {
    assert.equal(parseClientIp(undefined, undefined), "local");
  });
});

describe("takeReviewSlot", () => {
  it("allows five review posts per ip per minute", () => {
    const ip = "203.0.113.50";

    for (let i = 0; i < REVIEWS_PER_IP_PER_MINUTE; i += 1) {
      assert.equal(takeReviewSlot(ip), true, `expected slot ${i + 1} to succeed`);
    }
  });

  it("rejects the sixth post in the same window", () => {
    const ip = "203.0.113.51";

    for (let i = 0; i < REVIEWS_PER_IP_PER_MINUTE; i += 1) {
      takeReviewSlot(ip);
    }

    assert.equal(takeReviewSlot(ip), false);
  });

  it("resets the window after one minute", () => {
    const ip = "203.0.113.52";
    let now = 1_000_000;

    __setNowForTests(() => now);

    for (let i = 0; i < REVIEWS_PER_IP_PER_MINUTE; i += 1) {
      assert.equal(takeReviewSlot(ip), true);
    }
    assert.equal(takeReviewSlot(ip), false);

    now += 60_000;
    assert.equal(takeReviewSlot(ip), true);
  });

  it("tracks ips independently", () => {
    const ipA = "203.0.113.60";
    const ipB = "203.0.113.61";

    for (let i = 0; i < REVIEWS_PER_IP_PER_MINUTE; i += 1) {
      assert.equal(takeReviewSlot(ipA), true);
    }
    assert.equal(takeReviewSlot(ipA), false);
    assert.equal(takeReviewSlot(ipB), true);
  });
});
