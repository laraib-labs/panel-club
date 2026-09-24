import { iso8601DurationToSeconds } from "./duration.ts";

export type YoutubeVideo = {
  videoId: string;
  title: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  description?: string;
  privacyStatus?: "public" | "private" | "unlisted";
  liveBroadcastContent?: "none" | "live" | "upcoming";
  scheduledStartTime?: string | null;
  missingFromApi?: boolean;
};

export type YoutubeClient = {
  listLatest(source: {
    kind: "playlist" | "channel";
    playlistId: string | null;
    channelId: string | null;
    handle: string | null;
  }): Promise<YoutubeVideo[]>;
};

export type FetchLike = (input: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

const API_BASE = "https://www.googleapis.com/youtube/v3";
const RSS_BASE = "https://www.youtube.com/feeds/videos.xml";

type PlaylistItemsResponse = {
  items?: Array<{
    snippet?: {
      title?: string;
      publishedAt?: string;
      resourceId?: { videoId?: string };
    };
    contentDetails?: { videoId?: string };
  }>;
};

type VideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      description?: string;
      liveBroadcastContent?: "none" | "live" | "upcoming";
    };
    contentDetails?: { duration?: string };
    status?: { privacyStatus?: "public" | "private" | "unlisted" };
    liveStreamingDetails?: { scheduledStartTime?: string };
  }>;
};

type ChannelsResponse = {
  items?: Array<{
    id?: string;
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
};

export function createYoutubeClient(options: {
  fetch: FetchLike;
  apiKey?: string;
  maxResults?: number;
}): YoutubeClient {
  const maxResults = options.maxResults ?? 15;

  return {
    async listLatest(source) {
      if (options.apiKey) {
        const playlistId = await resolvePlaylistId(options.fetch, options.apiKey, source);
        const items = await listPlaylistItems(options.fetch, options.apiKey, playlistId, maxResults);
        return enrichVideos(options.fetch, options.apiKey, items);
      }

      if (source.playlistId) {
        return parseAtomFeed(await readFeed(options.fetch, `${RSS_BASE}?playlist_id=${source.playlistId}`));
      }

      if (source.channelId) {
        return parseAtomFeed(await readFeed(options.fetch, `${RSS_BASE}?channel_id=${source.channelId}`));
      }

      throw new Error("YOUTUBE_API_KEY is required to resolve a channel handle");
    },
  };
}

async function resolvePlaylistId(
  fetchImpl: FetchLike,
  apiKey: string,
  source: {
    playlistId: string | null;
    channelId: string | null;
    handle: string | null;
  },
): Promise<string> {
  if (source.playlistId) {
    return source.playlistId;
  }

  const params = new URLSearchParams({ part: "contentDetails", key: apiKey });
  if (source.channelId) {
    params.set("id", source.channelId);
  } else if (source.handle) {
    params.set("forHandle", source.handle.replace(/^@/, ""));
  } else {
    throw new Error("source has no playlist, channel id, or handle");
  }

  const response = await fetchImpl(`${API_BASE}/channels?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`channels.list failed: ${response.status}`);
  }

  const body = (await response.json()) as ChannelsResponse;
  const uploads = body.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) {
    throw new Error("channel has no uploads playlist");
  }

  return uploads;
}

async function listPlaylistItems(
  fetchImpl: FetchLike,
  apiKey: string,
  playlistId: string,
  maxResults: number,
): Promise<YoutubeVideo[]> {
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    playlistId,
    maxResults: String(maxResults),
    key: apiKey,
  });
  const response = await fetchImpl(`${API_BASE}/playlistItems?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`playlistItems.list failed: ${response.status}`);
  }

  const body = (await response.json()) as PlaylistItemsResponse;
  return (body.items ?? [])
    .map((item) => {
      const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title ?? "";
      if (!videoId || title.length === 0) {
        return null;
      }

      return {
        videoId,
        title,
        publishedAt: item.snippet?.publishedAt ?? null,
        durationSeconds: null,
      };
    })
    .filter((item): item is YoutubeVideo => item !== null);
}

async function enrichVideos(
  fetchImpl: FetchLike,
  apiKey: string,
  videos: YoutubeVideo[],
): Promise<YoutubeVideo[]> {
  if (videos.length === 0) {
    return videos;
  }

  const params = new URLSearchParams({
    part: "snippet,contentDetails,status,liveStreamingDetails",
    id: videos.map((video) => video.videoId).join(","),
    key: apiKey,
  });
  const response = await fetchImpl(`${API_BASE}/videos?${params.toString()}`);
  if (!response.ok) {
    return videos;
  }

  const body = (await response.json()) as VideosResponse;
  const detailsById = new Map<string, YoutubeVideo>();
  for (const item of body.items ?? []) {
    if (!item.id) {
      continue;
    }

    detailsById.set(item.id, {
      videoId: item.id,
      title: "",
      publishedAt: null,
      durationSeconds: item.contentDetails?.duration
        ? iso8601DurationToSeconds(item.contentDetails.duration)
        : null,
      description: item.snippet?.description,
      privacyStatus: item.status?.privacyStatus,
      liveBroadcastContent: item.snippet?.liveBroadcastContent,
      scheduledStartTime: item.liveStreamingDetails?.scheduledStartTime ?? null,
      missingFromApi: false,
    });
  }

  return videos.map((video) => {
    const details = detailsById.get(video.videoId);
    if (!details) {
      return { ...video, missingFromApi: true };
    }

    return {
      ...video,
      durationSeconds: details.durationSeconds ?? video.durationSeconds,
      description: details.description,
      privacyStatus: details.privacyStatus,
      liveBroadcastContent: details.liveBroadcastContent,
      scheduledStartTime: details.scheduledStartTime,
      missingFromApi: false,
    };
  });
}

async function readFeed(fetchImpl: FetchLike, url: string): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  return response.text();
}

export function parseAtomFeed(xml: string): YoutubeVideo[] {
  const entries = xml.split(/<entry>/i).slice(1);
  const videos: YoutubeVideo[] = [];

  for (const entry of entries) {
    const videoId = textBetween(entry, "<yt:videoId>", "</yt:videoId>");
    const title = decodeXml(textBetween(entry, "<title>", "</title>") ?? "");
    const publishedAt = textBetween(entry, "<published>", "</published>");
    if (!videoId || title.length === 0) {
      continue;
    }

    videos.push({
      videoId,
      title,
      publishedAt,
      durationSeconds: null,
    });
  }

  return videos;
}

function textBetween(haystack: string, start: string, end: string): string | null {
  const from = haystack.indexOf(start);
  if (from < 0) {
    return null;
  }

  const begin = from + start.length;
  const to = haystack.indexOf(end, begin);
  if (to < 0) {
    return null;
  }

  return haystack.slice(begin, to).trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
