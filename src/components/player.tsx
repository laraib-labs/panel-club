"use client";

import { useRef, type RefObject } from "react";

import {
  createBrowserStorage,
  markFinished,
  recordWatch,
  toggleSave,
} from "../lib/library.ts";
import { CastButton } from "./cast-button.tsx";

type PlayerProps = {
  episodeId: string;
  videoId: string;
  mediaUrl: string | null;
  title: string;
};

function handleTimeUpdate(
  episodeId: string,
  videoRef: RefObject<HTMLVideoElement | null>,
): void {
  const positionSeconds = Math.floor(videoRef.current?.currentTime ?? 0);
  recordWatch(createBrowserStorage(), episodeId, positionSeconds);
}

export function Player({ episodeId, videoId, mediaUrl, title }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  function handleSave(): void {
    toggleSave(createBrowserStorage(), episodeId);
  }

  function handleMarkFinished(): void {
    markFinished(createBrowserStorage(), episodeId);
  }

  return (
    <>
      <div className="player">
        <div>
          <strong>Playing on this page</strong>
          {mediaUrl ? (
            <>
              <video
                ref={videoRef}
                src={mediaUrl}
                controls
                title={title}
                onTimeUpdate={() => handleTimeUpdate(episodeId, videoRef)}
              />
              <CastButton videoRef={videoRef} />
            </>
          ) : (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </div>
      <div className="row">
        <button type="button" onClick={handleSave}>Save</button>
        <button type="button" onClick={handleMarkFinished}>Mark finished</button>
      </div>
    </>
  );
}
