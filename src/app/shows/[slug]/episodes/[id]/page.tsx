import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Player } from "../../../../../components/player.tsx";
import { SiteHeader } from "../../../../../components/site-header.tsx";
import {
  ReviewForm,
  ReviewFeed,
  type ReviewActionState,
  type ReviewThreadItem,
} from "../../../../../components/review-form.tsx";
import { loadAppCatalog } from "../../../../../lib/catalog-cache.ts";
import { getEpisode, getShow, type Episode } from "../../../../../lib/catalog.ts";
import { parseClientIp, takeReviewSlot } from "../../../../../lib/review-rate-limit.ts";
import { getReviewsPool } from "../../../../../lib/reviews-db.ts";
import { listReviewThreadPage, saveReply, saveReview } from "../../../../../lib/reviews-pg.ts";
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
      secure: process.env.NODE_ENV === "production",
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
        secure: process.env.NODE_ENV === "production",
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
  _state: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  "use server";

  if (!(await takeReviewSlot(await clientIpFromHeaders()))) {
    return { status: "error", message: "Too many ratings in a short time. Please try again shortly." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const stars = Number(formData.get("stars"));
  const body = String(formData.get("body") ?? "").trim();
  const spoiler = formData.get("spoiler") === "true";

  if (!displayName || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { status: "error", message: "Choose a display name and a star rating to continue." };
  }

  try {
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
    return { status: "success", message: "Your rating is posted. Thank you!" };
  } catch {
    return { status: "error", message: "We couldn’t post your rating. Please try again." };
  }
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

/**
 * Everything that depends on the reviews DB round trip, isolated behind its
 * own Suspense boundary so the shell (title, player, guests) can paint
 * without waiting on it — the biggest perceived-latency win on a cold Neon
 * connection. Only the first page of threads is loaded for the initial render.
 */
async function ReviewsSection({ slug, episode }: { slug: string; episode: Episode }) {
  const pool = getReviewsPool();
  const page = await listReviewThreadPage(pool, episode.videoId, null);
  const reviewCount = page.totalCount;
  const cookieStore = await cookies();
  const viewer = parseViewerCookie(cookieStore.get("pc_viewer")?.value);
  const submit = submitReview.bind(null, slug, episode.videoId);
  const reply = submitReply.bind(null, slug, episode.videoId);
  const threadItems = toReviewThreadItems(page.threads);

  return (
    <>
      <p className="m-0 text-sm text-text-muted">{formatScore(page.averageScore, reviewCount)}</p>

      <ReviewForm action={submit} defaultDisplayName={viewer?.displayName ?? "Panel Club fan"} />

      {threadItems.length === 0 ? (
        <p className="m-0 text-sm text-text-muted">Be the first.</p>
      ) : (
        <ReviewFeed
          episodeId={episode.videoId}
          initialThreads={threadItems}
          initialCursor={page.nextCursor}
          replyAction={reply}
          defaultDisplayName={viewer?.displayName ?? "Panel Club fan"}
        />
      )}

    </>
  );
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

  const guests = splitGuestNames(episode.guest);
  const statusLabel = episode.status === "upcoming" ? "Upcoming" : "Aired";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-[1080px] gap-6 px-5 pb-7 pt-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="grid gap-3">
          <p className="meta">
            <a href={`/shows/${slug}`}>{show.name}</a> / {episode.title}
          </p>
          <h1 className="m-0 text-2xl leading-[1.1] tracking-[-0.02em] text-text sm:text-[28px]">
            {episode.title}
          </h1>
          {episode.mediaUrl ? (
            <p className="meta">Not in the YouTube seed. Shown only so Cast has a place.</p>
          ) : (
            <p className="meta">
              Playing on this page · {formatDuration(episode.duration)} · {statusLabel}
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
        </div>

        <aside className="grid gap-3 lg:sticky lg:top-[86px]">
          <h2 className="m-0 text-xs uppercase tracking-[0.1em] text-text-muted">Reviews</h2>
          <Suspense fallback={<p className="m-0 text-sm text-text-muted">Loading reviews…</p>}>
            <ReviewsSection slug={slug} episode={episode} />
          </Suspense>
        </aside>
      </main>
    </>
  );
}
