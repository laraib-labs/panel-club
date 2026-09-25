"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";

import {
  createBrowserStorage,
  getLibraryRecord,
  markFinished,
  recordWatch,
  toggleSave,
} from "../lib/library.ts";
import { CastButton } from "./cast-button.tsx";
import { chipClassName } from "./chip-styles.ts";

type PlayerProps = {
  episodeId: string;
  videoId: string;
  mediaUrl: string | null;
  title: string;
};

type YouTubeErrorEvent = { data: number };

type YouTubePlayer = {
  destroy: () => void;
};

type YouTubeNamespace = {
  Player: new (
    elementId: string,
    config: {
      videoId: string;
      host?: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: { onError?: (event: YouTubeErrorEvent) => void };
    },
  ) => YouTubePlayer;
};

const EMBED_BLOCKED_CODES = new Set([100, 101, 150]);

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function handleTimeUpdate(
  episodeId: string,
  videoRef: RefObject<HTMLVideoElement | null>,
): void {
  const positionSeconds = Math.floor(videoRef.current?.currentTime ?? 0);
  recordWatch(createBrowserStorage(), episodeId, positionSeconds);
}

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  return new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) {
        resolve(window.YT);
      }
    };

    if (!document.querySelector("script[src='https://www.youtube.com/iframe_api']")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.append(script);
    }
  });
}

function YouTubeStage({
  videoId,
  title,
  onBlocked,
}: {
  videoId: string;
  title: string;
  onBlocked: () => void;
}) {
  const reactId = useId();
  const containerId = `yt${reactId.replaceAll(":", "")}`;

  useEffect(() => {
    let player: YouTubePlayer | undefined;
    let cancelled = false;

    void loadYouTubeApi().then((YT) => {
      if (cancelled) {
        return;
      }

      player = new YT.Player(containerId, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: {
          origin: window.location.origin,
        },
        events: {
          onError: (event) => {
            if (EMBED_BLOCKED_CODES.has(event.data)) {
              onBlocked();
            }
          },
        },
      });

      const frame = document.getElementById(containerId)?.querySelector("iframe");
      frame?.setAttribute("title", title);
      frame?.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
      );
      frame?.setAttribute("allowfullscreen", "true");
    });

    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [containerId, onBlocked, title, videoId]);

  return <div id={containerId} className="h-full w-full" />;
}

export function Player({ episodeId, videoId, mediaUrl, title }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [saved, setSaved] = useState(false);
  const [finished, setFinished] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const handleBlocked = useCallback(() => {
    setBlocked(true);
  }, []);

  useEffect(() => {
    const record = getLibraryRecord(createBrowserStorage(), episodeId);
    setSaved(Boolean(record?.saved));
    setFinished(Boolean(record?.finished));
    setBlocked(false);
  }, [episodeId]);

  function handleSave(): void {
    setSaved(toggleSave(createBrowserStorage(), episodeId));
  }

  function handleMarkFinished(): void {
    markFinished(createBrowserStorage(), episodeId);
    setFinished(true);
  }

  const watchUrl = youtubeWatchUrl(videoId);
  const showYouTube = !mediaUrl;

  return (
    <>
      {blocked && showYouTube ? (
        <div className="grid aspect-video place-items-center rounded-card bg-surface-raised text-center">
          <div>
            <p className="m-0">
              <strong>This episode won’t play here.</strong>
            </p>
            <p className="meta">YouTube blocked the embed (age gate or embedding off).</p>
          </div>
        </div>
      ) : (
        <div className="relative aspect-video overflow-hidden rounded-card bg-black">
          {mediaUrl ? (
            <video
              ref={videoRef}
              className="h-full w-full border-0"
              src={mediaUrl}
              controls
              title={title}
              onTimeUpdate={() => handleTimeUpdate(episodeId, videoRef)}
            />
          ) : (
            <YouTubeStage videoId={videoId} title={title} onBlocked={handleBlocked} />
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {showYouTube ? (
          <a
            className="text-sm font-semibold text-accent transition-colors duration-fast hover:text-accent-hover"
            href={watchUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open on YouTube
          </a>
        ) : (
          <CastButton videoRef={videoRef} />
        )}
        <button className={chipClassName(saved)} aria-pressed={saved} type="button" onClick={handleSave}>
          Save
        </button>
        <button
          className={chipClassName(finished)}
          aria-pressed={finished}
          type="button"
          onClick={handleMarkFinished}
        >
          Mark finished
        </button>
      </div>
    </>
  );
}
