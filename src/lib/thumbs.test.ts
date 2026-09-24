import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { youtubeThumbUrl } from "./thumbs.ts";

describe("youtubeThumbUrl", () => {
  it("returns hqdefault thumb URL for a video id", () => {
    assert.equal(
      youtubeThumbUrl("eHTXQW58WhA"),
      "https://i.ytimg.com/vi/eHTXQW58WhA/hqdefault.jpg",
    );
  });
});
