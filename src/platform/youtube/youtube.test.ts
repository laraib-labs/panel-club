import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseSourceUrl } from "./source-url.ts";
import { iso8601DurationToSeconds } from "./duration.ts";
import { looksLikeShort, parseCredits, parseFeaturedGuests, titleMatchesInclude } from "./title-credits.ts";
import { createYoutubeClient, parseAtomFeed } from "./client.ts";

describe("parseSourceUrl", () => {
  it("reads playlist ids", () => {
    const parsed = parseSourceUrl("https://www.youtube.com/playlist?list=PLFcSwHXxax7zjumzGWwvSUoMv6H8FNZtO");
    assert.equal(parsed.kind, "playlist");
    assert.equal(parsed.playlistId, "PLFcSwHXxax7zjumzGWwvSUoMv6H8FNZtO");
  });

  it("reads handles from /videos paths", () => {
    const parsed = parseSourceUrl("https://www.youtube.com/@SamayRainaOfficial/videos");
    assert.equal(parsed.kind, "channel");
    assert.equal(parsed.handle, "SamayRainaOfficial");
  });
});

describe("duration and credits", () => {
  it("parses ISO-8601 durations", () => {
    assert.equal(iso8601DurationToSeconds("PT59M21S"), 3561);
    assert.equal(iso8601DurationToSeconds("PT1H5M3S"), 3903);
  });

  it("parses ft. guest lists and @handles", () => {
    assert.equal(
      parseFeaturedGuests("INDIA’S GOT LATENT S2 EP1 ft. Alia Bhatt, Sharvari, Ashish Solanki"),
      "Alia Bhatt, Sharvari, Ashish Solanki",
    );
    assert.equal(parseFeaturedGuests("Pretty Good Roast Show: S1. EP 1/7 | Ft. @AakashGupta"), "Aakash Gupta");
    assert.equal(parseFeaturedGuests("No guests in this title"), "");
  });

  it("applies title include and shorts heuristics", () => {
    assert.equal(titleMatchesInclude("India's Got Latent S2", "LATENT"), true);
    assert.equal(titleMatchesInclude("Chess stream", "LATENT"), false);
    assert.equal(looksLikeShort("Funny bit #shorts"), true);
  });

  it("falls back to description credits", () => {
    assert.equal(parseCredits("LATENT EP9", "Guests: Priya Malik, Aakash Gupta"), "Priya Malik, Aakash Gupta");
    assert.equal(parseCredits("LATENT EP9", "Featuring @SomeHandle in studio"), "Some Handle");
  });
});

describe("YouTube client", () => {
  it("parses Atom RSS entries", () => {
    const videos = parseAtomFeed(`
      <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
        <entry>
          <yt:videoId>newVid001</yt:videoId>
          <title>India's Got Latent S2 EP8 ft. New Guest</title>
          <published>2026-09-24T00:00:00+00:00</published>
        </entry>
      </feed>
    `);
    assert.equal(videos.length, 1);
    assert.equal(videos[0]?.videoId, "newVid001");
  });

  it("uses playlist RSS when no API key", async () => {
    const client = createYoutubeClient({
      fetch: async (url) => {
        assert.match(url, /playlist_id=PLTEST/);
        return {
          ok: true,
          status: 200,
          text: async () =>
            `<feed><entry><yt:videoId>abc</yt:videoId><title>Show EP</title><published>2026-01-01T00:00:00Z</published></entry></feed>`,
          json: async () => ({}),
        };
      },
    });

    const videos = await client.listLatest({
      kind: "playlist",
      playlistId: "PLTEST",
      channelId: null,
      handle: null,
    });
    assert.equal(videos[0]?.videoId, "abc");
  });

  it("walks channels.list then playlistItems.list with an API key", async () => {
    const client = createYoutubeClient({
      apiKey: "test-key",
      fetch: async (url) => {
        if (url.includes("/channels?")) {
          assert.match(url, /forHandle=SamayRainaOfficial/);
          return {
            ok: true,
            status: 200,
            text: async () => "",
            json: async () => ({
              items: [{ contentDetails: { relatedPlaylists: { uploads: "UU123" } } }],
            }),
          };
        }

        if (url.includes("/playlistItems?")) {
          assert.match(url, /playlistId=UU123/);
          return {
            ok: true,
            status: 200,
            text: async () => "",
            json: async () => ({
              items: [
                {
                  snippet: { title: "Latent EP", publishedAt: "2026-09-01T00:00:00Z", resourceId: { videoId: "vid9" } },
                  contentDetails: { videoId: "vid9" },
                },
              ],
            }),
          };
        }

        if (url.includes("/videos?")) {
          assert.match(url, /part=snippet%2CcontentDetails%2Cstatus%2CliveStreamingDetails/);
          return {
            ok: true,
            status: 200,
            text: async () => "",
            json: async () => ({
              items: [
                {
                  id: "vid9",
                  snippet: { description: "Guests: Test Guest", liveBroadcastContent: "none" },
                  contentDetails: { duration: "PT50M" },
                  status: { privacyStatus: "public" },
                },
              ],
            }),
          };
        }

        throw new Error(url);
      },
    });

    const videos = await client.listLatest({
      kind: "channel",
      playlistId: null,
      channelId: null,
      handle: "SamayRainaOfficial",
    });
    assert.equal(videos[0]?.videoId, "vid9");
    assert.equal(videos[0]?.durationSeconds, 3000);
  });

  it("marks playlist items missing from videos.list", async () => {
    const client = createYoutubeClient({
      apiKey: "test-key",
      fetch: async (url) => {
        if (url.includes("/playlistItems?")) {
          return {
            ok: true,
            status: 200,
            text: async () => "",
            json: async () => ({
              items: [
                {
                  snippet: { title: "Latent EP", publishedAt: "2026-09-01T00:00:00Z", resourceId: { videoId: "gone" } },
                  contentDetails: { videoId: "gone" },
                },
              ],
            }),
          };
        }

        if (url.includes("/videos?")) {
          return {
            ok: true,
            status: 200,
            text: async () => "",
            json: async () => ({ items: [] }),
          };
        }

        throw new Error(url);
      },
    });

    const videos = await client.listLatest({
      kind: "playlist",
      playlistId: "PLTEST",
      channelId: null,
      handle: null,
    });
    assert.equal(videos[0]?.missingFromApi, true);
  });
});
