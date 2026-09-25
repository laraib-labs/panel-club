"use client";

import { useRef } from "react";

import type { Show } from "../lib/catalog.ts";
import { ShowCard } from "./show-card.tsx";

type Entry = { show: Show; slug: string; averageScore: number | null };

export function ShowRail({ title, entries }: { title: string; entries: Entry[] }) {
  const rail = useRef<HTMLDivElement>(null);
  if (entries.length === 0) return null;

  const move = (direction: -1 | 1) => rail.current?.scrollBy({
    left: direction * rail.current.clientWidth * 0.8,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });

  return (
    <section className="grid gap-3" aria-label={title}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="m-0 text-xl font-semibold tracking-tight text-text">{title}</h2>
          <p className="m-0 text-sm text-text-muted">Shows people are talking about</p>
        </div>
        <div className="flex gap-2">
          {([-1, 1] as const).map((direction) => (
            <button key={direction} type="button" aria-label={direction < 0 ? "Scroll favorites left" : "Scroll favorites right"}
              className="grid h-10 w-10 place-items-center rounded-full border border-border-subtle bg-surface text-text transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => move(direction)}>{direction < 0 ? "←" : "→"}</button>
          ))}
        </div>
      </div>
      <div ref={rail} className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entries.map((entry) => <div className="w-[min(78vw,260px)] shrink-0 snap-start" key={entry.slug}>
          <ShowCard {...entry} />
        </div>)}
      </div>
    </section>
  );
}
