import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { Player } from "../../../../../components/player.tsx";
import { SiteHeader } from "../../../../../components/site-header.tsx";
import {
  ReviewForm,
  ReviewThreadCard,
  type ReviewThreadItem,
} from "../../../../../components/review-form.tsx";
import { getEpisode, getShow, loadAppCatalog } from "../../../../../lib/catalog.ts";
import { parseClientIp, takeReviewSlot } from "../../../../../lib/review-rate-limit.ts";
import { getReviewsPool } from "../../../../../lib/reviews-db.ts";
import {
  averageScore,
  listReviewThread,
  saveReply,
  saveReview,
} from "../../../../../lib/reviews-pg.ts";
import type { ReviewThread } from "../../../../../lib/reviews.ts";

export const dynamic = "force-dynamic";

type ViewerCookie = {
  id: string;
  displayName: string;
};

const VIEWER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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

async function resolveViewer(displayName: string): Promise<ViewerCookie> {
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
      maxAge: VIEWER_COOKIE_MAX_AGE,
    });
  } else if (existingViewer.displayName !== displayName) {
    cookieStore.set(
      "pc_viewer",
      JSON.stringify({ ...existingViewer, displayName }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: VIEWER_COOKIE_MAX_AGE,
      },
    );
  }

  return existingViewer ? { ...existingViewer, displayName } : viewer;
}

async function clientIpFromHeaders(): Promise<string> {
  const headerStore = await headers();
  return parseClientIp(
    headerStore.get("x-forwarded-for"),
    headerStore.get("x-real-ip"),
  );
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

function toReviewThreadItems(threads: ReviewThread[]): ReviewThreadItem[] {
  return threads.map(({ review, replies }) => ({
    id: review.id,
    displayName: review.displayName,
    stars: review.stars,
    body: review.body,
    spoiler: review.spoiler,
    replies: replies.map((reply) => ({
      id: reply.id,
      displayName: reply.displayName,
      body: reply.body,
      spoiler: reply.spoiler,
    })),
  }));
}

async function submitReview(
  slug: string,
  episodeId: string,
  formData: FormData,
): Promise<void> {
  "use server";

  if (!(await takeReviewSlot(await clientIpFromHeaders()))) {
    return;
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const stars = Number(formData.get("stars"));
  const body = String(formData.get("body") ?? "").trim();
  const spoiler = formData.get("spoiler") === "true";

  if (!displayName || !body || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return;
  }

  const viewer = await resolveViewer(displayName);
  const catalog = await loadAppCatalog();

  await saveReview(getReviewsPool(), catalog, {
    episodeId,
    viewerId: viewer.id,
    displayName,
    stars,
    body,
    spoiler,
  });

  revalidatePath(`/shows/${slug}/episodes/${episodeId}`);
}

async function submitReply(
  slug: string,
  episodeId: string,
  formData: FormData,
): Promise<void> {
  "use server";

  if (!(await takeReviewSlot(await clientIpFromHeaders()))) {
    return;
  }

  const parentId = String(formData.get("parentId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const spoiler = formData.get("spoiler") === "true";

  if (!parentId || !displayName || !body) {
    return;
  }

  const viewer = await resolveViewer(displayName);

  await saveReply(getReviewsPool(), {
    parentId,
    viewerId: viewer.id,
    displayName,
    body,
    spoiler,
  });

  revalidatePath(`/shows/${slug}/episodes/${episodeId}`);
}

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const catalog = await loadAppCatalog();
  const show = getShow(catalog, slug);
  const episode = show ? getEpisode(show, id) : undefined;

  if (!show || !episode) {
    notFound();
  }

  const pool = getReviewsPool();
  const threads = await listReviewThread(pool, id);
  const reviewCount = threads.length;
  const score = await averageScore(pool, id);
  const cookieStore = await cookies();
  const viewer = parseViewerCookie(cookieStore.get("pc_viewer")?.value);
  const submit = submitReview.bind(null, slug, id);
  const reply = submitReply.bind(null, slug, id);
  const threadItems = toReviewThreadItems(threads);

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
        {episode.mediaUrl ? (
          <p className="meta">Not in the YouTube seed. Shown only so Cast has a place.</p>
        ) : (
          <p className="meta">
            Playing on this page · {formatDuration(episode.duration)} · {statusLabel} · {formatScore(score, reviewCount)}
          </p>
        )}

        <Player
          episodeId={id}
          videoId={episode.videoId}
          mediaUrl={episode.mediaUrl}
          title={episode.title}
        />

        {episode.mediaUrl ? (
          <p className="note">Cast opens the device picker. Play and pause stay on this page.</p>
        ) : null}

        {guests.length > 0 ? (
          <p className="meta">Guests: {guests.join(", ")}</p>
        ) : null}

        {threadItems.length === 0 ? (
          <p className="meta">Be the first.</p>
        ) : (
          threadItems.map((thread) => (
            <ReviewThreadCard
              key={thread.id}
              thread={thread}
              replyAction={reply}
              defaultDisplayName={viewer?.displayName ?? ""}
            />
          ))
        )}

        <ReviewForm action={submit} defaultDisplayName={viewer?.displayName ?? ""} />
      </main>
    </>
  );
}
