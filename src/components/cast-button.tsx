"use client";

import { useEffect, useState, type RefObject } from "react";

import { castDecision } from "../lib/cast.ts";
import { chipClassName } from "./chip-styles.ts";

type CastButtonProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function CastButton({ videoRef }: CastButtonProps) {
  const [deviceAvailable, setDeviceAvailable] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video?.remote) {
      return;
    }

    const handleAvailabilityChange = (event: Event) => {
      const availabilityEvent = event as Event & { available?: boolean };
      if (typeof availabilityEvent.available === "boolean") {
        setDeviceAvailable(availabilityEvent.available);
      }
    };

    video.remote
      .watchAvailability((available) => {
        setDeviceAvailable(available);
      })
      .catch(() => {
        setDeviceAvailable(false);
      });

    video.addEventListener("watchavailabilitychange", handleAvailabilityChange);

    return () => {
      video.removeEventListener("watchavailabilitychange", handleAvailabilityChange);
    };
  }, [videoRef]);

  const decision = castDecision({ kind: "file", deviceAvailable });

  if (decision !== "prompt") {
    return null;
  }

  return (
    <button
      className={chipClassName(false)}
      type="button"
      onClick={() => {
        void videoRef.current?.remote?.prompt();
      }}
    >
      Cast
    </button>
  );
}
