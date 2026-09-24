export type SourceKind = "playlist" | "channel";

export type ParsedSource = {
  kind: SourceKind;
  playlistId: string | null;
  channelId: string | null;
  handle: string | null;
};

export function parseSourceUrl(sourceUrl: string): ParsedSource {
  const url = new URL(sourceUrl);
  const playlistId = url.searchParams.get("list");

  if (playlistId && playlistId.length > 0) {
    return { kind: "playlist", playlistId, channelId: null, handle: null };
  }

  const channelMatch = url.pathname.match(/^\/channel\/(UC[\w-]+)/);
  if (channelMatch) {
    return { kind: "channel", playlistId: null, channelId: channelMatch[1], handle: null };
  }

  const handleMatch = url.pathname.match(/^\/@([\w.]+)/);
  if (handleMatch) {
    return { kind: "channel", playlistId: null, channelId: null, handle: handleMatch[1] };
  }

  throw new Error(`unsupported YouTube source URL: ${sourceUrl}`);
}
