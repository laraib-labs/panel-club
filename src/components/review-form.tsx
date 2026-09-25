"use client";

import { useActionState, useState } from "react";

import { chipClassName } from "./chip-styles.ts";

export type ReviewThreadItem = {
  id: string;
  displayName: string;
  stars: number | null;
  body: string;
  spoiler: boolean;
  replies: Array<{
    id: string;
    displayName: string;
    body: string;
    spoiler: boolean;
  }>;
};

type ReviewFeedProps = {
  episodeId: string;
  initialThreads: ReviewThreadItem[];
  initialCursor: string | null;
  replyAction: (formData: FormData) => Promise<void>;
  defaultDisplayName?: string;
};

type ReviewFormProps = {
  action: (state: ReviewActionState, formData: FormData) => Promise<ReviewActionState>;
  defaultDisplayName?: string;
};

export type ReviewActionState = { status: "idle" | "success" | "error"; message: string };
const initialReviewState: ReviewActionState = { status: "idle", message: "" };

type ReplyFormProps = {
  action: (formData: FormData) => Promise<void>;
  parentId: string;
  defaultDisplayName?: string;
  onCancel: () => void;
};

type ReviewThreadCardProps = {
  thread: ReviewThreadItem;
  replyAction: (formData: FormData) => Promise<void>;
  defaultDisplayName?: string;
};

const fieldInputClassName =
  "w-full rounded-xl border border-border-subtle bg-[#0e0c12] px-3.5 py-3 font-sans text-text outline-none transition-colors duration-fast focus:border-accent";

function formatStars(stars: number): string {
  return `${"★".repeat(stars)}${"☆".repeat(5 - stars)}`;
}

function ReviewBody({ body, spoiler }: { body: string; spoiler: boolean }) {
  if (spoiler) {
    return (
      <details className="group">
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-pill border border-border-subtle bg-surface-raised px-3 text-xs text-text-muted transition-colors duration-fast hover:text-text [&::-webkit-details-marker]:hidden">
          Contains spoiler — tap to reveal
        </summary>
        <p className="mt-2 text-text-muted">{body}</p>
      </details>
    );
  }

  return <p className="m-0 text-text-muted">{body}</p>;
}

function StarPicker({ name }: { name: string }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const lit = hover || stars;

  return (
    <div
      className="flex gap-0.5"
      role="radiogroup"
      aria-label="Stars"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          className={`h-11 w-11 border-0 bg-transparent text-[28px] leading-none transition-colors duration-fast ${
            value <= lit ? "text-accent" : "text-text-subtle"
          }`}
          aria-label={`${value} star${value === 1 ? "" : "s"}`}
          aria-pressed={value <= stars}
          onMouseEnter={() => setHover(value)}
          onFocus={() => setHover(value)}
          onClick={() => setStars(value)}
        >
          ★
        </button>
      ))}
      <input type="hidden" name={name} value={stars > 0 ? String(stars) : ""} required />
    </div>
  );
}

export function ReviewForm({ action, defaultDisplayName = "Panel Club fan" }: ReviewFormProps) {
  const [state, formAction, pending] = useActionState(action, initialReviewState);
  return (
    <form
      className="grid gap-4 rounded-card border border-border-subtle bg-surface p-5"
      action={formAction}
    >
      <div className="grid gap-1">
        <h4 className="text-[15px] font-semibold normal-case text-text">Leave a review</h4>
        <p className="meta">Pick a rating, then add a comment only if you want to.</p>
        <p className="meta">Your rating replaces your previous one from this browser.</p>
      </div>
      <label className="grid gap-2 text-text" htmlFor="displayName">
        <span className="text-[13px] font-semibold text-text-muted">Display name</span>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          maxLength={40}
          placeholder="What should we call you?"
          defaultValue={defaultDisplayName}
          autoComplete="nickname"
          className={fieldInputClassName}
        />
      </label>
      <fieldset className="grid gap-2 border-0 p-0 text-text">
        <legend className="text-[13px] font-semibold text-text-muted">Stars</legend>
        <StarPicker name="stars" />
      </fieldset>
      <label className="grid gap-2 text-text" htmlFor="body">
        <span className="text-[13px] font-semibold text-text-muted">
          Comment <span className="font-normal">(optional)</span>
        </span>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={500}
          placeholder="Add a thought if you like — a star rating is enough."
          className={`${fieldInputClassName} min-h-[108px] resize-y`}
        />
      </label>
      <label className="flex min-h-10 items-center gap-2.5 text-text-muted">
        <input name="spoiler" type="checkbox" value="true" className="h-4.5 w-4.5 accent-accent" />
        This review spoils the episode
      </label>
      <button
        disabled={pending}
        className={`${chipClassName(true)} min-w-40 justify-self-start disabled:cursor-wait disabled:opacity-60`}
        type="submit"
      >
        {pending ? "Posting…" : "Post rating"}
      </button>
      {state.message ? (
        <p
          aria-live="polite"
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "error" ? "m-0 text-sm text-danger" : "m-0 text-sm text-text-muted"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function ReplyForm({
  action,
  parentId,
  defaultDisplayName = "",
  onCancel,
}: ReplyFormProps) {
  return (
    <form className="ml-5 grid gap-2" action={action}>
      <input type="hidden" name="parentId" value={parentId} />
      <label className="grid gap-2 text-text" htmlFor={`reply-name-${parentId}`}>
        <span className="text-[13px] font-semibold text-text-muted">Display name</span>
        <input
          id={`reply-name-${parentId}`}
          name="displayName"
          type="text"
          required
          maxLength={40}
          placeholder="What should we call you?"
          defaultValue={defaultDisplayName}
          autoComplete="nickname"
          className={fieldInputClassName}
        />
      </label>
      <label className="grid gap-2 text-text" htmlFor={`reply-body-${parentId}`}>
        <span className="text-[13px] font-semibold text-text-muted">Reply</span>
        <textarea
          id={`reply-body-${parentId}`}
          name="body"
          required
          rows={3}
          maxLength={500}
          placeholder="Add a reply"
          className={`${fieldInputClassName} min-h-[108px] resize-y`}
        />
      </label>
      <label className="flex min-h-10 items-center gap-2.5 text-text-muted">
        <input name="spoiler" type="checkbox" value="true" className="h-4.5 w-4.5 accent-accent" />
        This review spoils the episode
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button className={chipClassName(true)} type="submit">
          Reply
        </button>
        <button className={chipClassName(false)} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ReviewThreadCard({
  thread,
  replyAction,
  defaultDisplayName = "",
}: ReviewThreadCardProps) {
  const [replying, setReplying] = useState(false);

  return (
    <article className="grid gap-2 rounded-xl border border-border-subtle bg-surface p-4">
      <strong className="text-[17px] font-semibold text-text">
        {thread.displayName}
        {thread.stars !== null ? (
          <span className="ml-2 text-accent">{formatStars(thread.stars)}</span>
        ) : null}
      </strong>
      {thread.body.trim() ? <ReviewBody body={thread.body} spoiler={thread.spoiler} /> : null}
      {!replying ? (
        <button
          type="button"
          className="justify-self-start text-sm text-text-muted transition-colors duration-fast hover:text-text"
          onClick={() => setReplying(true)}
        >
          Reply
        </button>
      ) : (
        <ReplyForm
          action={replyAction}
          parentId={thread.id}
          defaultDisplayName={defaultDisplayName}
          onCancel={() => setReplying(false)}
        />
      )}
      {thread.replies.length > 0 ? (
        <div className="grid gap-2">
          {thread.replies.map((reply) => (
            <div
              key={reply.id}
              className="ml-5 rounded-r-xl border-l-2 border-accent bg-surface-raised px-3 py-2.5"
            >
              <strong className="text-text">{reply.displayName}</strong>
              <ReviewBody body={reply.body} spoiler={reply.spoiler} />
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function ReviewFeed({
  episodeId,
  initialThreads,
  initialCursor,
  replyAction,
  defaultDisplayName,
}: ReviewFeedProps) {
  const [threads, setThreads] = useState(initialThreads);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadOlder() {
    if (!cursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/reviews/${encodeURIComponent(episodeId)}?cursor=${encodeURIComponent(cursor)}`,
      );
      if (!response.ok) throw new Error("Could not load older reviews.");
      const page = await response.json() as { threads: ReviewThreadItem[]; nextCursor: string | null };
      setThreads((current) => [...current, ...page.threads]);
      setCursor(page.nextCursor);
    } catch {
      setError("Could not load older reviews. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-3">
      {threads.map((thread) => (
        <ReviewThreadCard
          key={thread.id}
          thread={thread}
          replyAction={replyAction}
          defaultDisplayName={defaultDisplayName}
        />
      ))}
      {error ? <p role="alert" className="m-0 text-sm text-danger">{error}</p> : null}
      {cursor ? (
        <button
          type="button"
          onClick={loadOlder}
          disabled={loading}
          className="min-h-11 justify-self-start rounded-pill border border-border-subtle bg-surface px-4 text-sm text-text transition-colors hover:border-border disabled:opacity-60"
        >
          {loading ? "Loading…" : "Show older reviews"}
        </button>
      ) : null}
    </div>
  );
}
