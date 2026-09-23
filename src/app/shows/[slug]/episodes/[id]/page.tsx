import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { Player } from "../../../../../components/player.tsx";
import { SiteHeader } from "../../../../../components/site-header.tsx";
import { ReviewForm } from "../../../../../components/review-form.tsx";
import { getEpisode, getShow, loadCatalog } from "../../../../../lib/catalog.ts";
import type { Review } from "../../../../../lib/reviews.ts";
import {
  averageScore,
  initReviewsSchema,
  listReviews,
  saveReview,
} from "../../../../../lib/reviews.ts";

type ViewerCookie = {
  id: string;
  displayName: string;
};

const dbPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../data/panel-club.sqlite",
);

function openReviewsDb(): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  initReviewsSchema(db);
  return db;
}

function parseViewerCookie(value: string | undefined): ViewerCookie | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as ViewerCookie;
    if (typeof parsed.id === "string" && typeof parsed.displayName === "string") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function splitGuestNames(guest: string): string[] {
  return guest
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function formatScore(score: number | null, reviewCount: number): string {
  if (score === null || reviewCount === 0) {
    return "No score yet";
  }

  return `${score.toFixed(1)} from ${reviewCount} review${reviewCount === 1 ? "" : "s"}`;
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="review">
      <strong>
        {review.displayName} · {review.stars} star{review.stars === 1 ? "" : "s"}
        {review.spoiler ? " · Spoiler" : ""}
      </strong>
      {review.spoiler ? (
        <details>
          <summary className="pill">Show spoiler</summary>
          <p className="meta">{review.body}</p>
        </details>
      ) : (
        <p className="meta">{review.body}</p>
      )}
    </article>
  );
}

async function submitReview(episodeId: string, formData: FormData): Promise<void> {
  "use server";

  const displayName = String(formData.get("displayName") ?? "").trim();
  const stars = Number(formData.get("stars"));
  const body = String(formData.get("body") ?? "").trim();
  const spoiler = formData.get("spoiler") === "true";

  if (!displayName || !body || !Number.isInteger(stars)) {
    return;
  }

  const cookieStore = await cookies();
  const existingViewer = parseViewerCookie(cookieStore.get("pc_viewer")?.value);
  const viewer: ViewerCookie = existingViewer ?? {
    id: randomUUID(),
    displayName,
  };

  if (!existingViewer) {
    cookieStore.set("pc_viewer", JSON.stringify(viewer), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  } else if (existingViewer.displayName !== displayName) {
    cookieStore.set(
      "pc_viewer",
      JSON.stringify({ ...existingViewer, displayName }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
    );
  }

  const catalog = loadCatalog();
  const db = openReviewsDb();

  saveReview(db, catalog, {
    episodeId,
    viewerId: viewer.id,
    displayName,
    stars,
    body,
    spoiler,
  });
}

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const catalog = loadCatalog();
  const show = getShow(catalog, slug);
  const episode = show ? getEpisode(show, id) : undefined;

  if (!show || !episode) {
    notFound();
  }

  const db = openReviewsDb();
  const reviews = listReviews(db, id);
  const score = averageScore(db, id);
  const cookieStore = await cookies();
  const viewer = parseViewerCookie(cookieStore.get("pc_viewer")?.value);
  const submit = submitReview.bind(null, id);

  const guests = splitGuestNames(episode.guest);
  const statusLabel = episode.status === "upcoming" ? "Upcoming" : "Aired";

  return (
    <>
    <SiteHeader />
    <main className="pad">
      <p className="meta">
        <a href={`/shows/${slug}`}>{show.name}</a> / {episode.title}
      </p>
      <h1>{episode.title}</h1>
      <p className="meta">
        {formatDuration(episode.duration)} · {statusLabel} · {formatScore(score, reviews.length)}
      </p>

      <Player
        episodeId={id}
        videoId={episode.videoId}
        mediaUrl={episode.mediaUrl}
        title={episode.title}
      />

      {guests.length > 0 ? (
        <p className="meta">Guests: {guests.join(", ")}</p>
      ) : null}

      {reviews.map((review) => (
        <ReviewCard key={`${review.viewerId}-${review.createdAt}`} review={review} />
      ))}

      <ReviewForm action={submit} defaultDisplayName={viewer?.displayName ?? ""} />
    </main>
    </>
  );
}
