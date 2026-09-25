"use client";

import { useState } from "react";

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

type ReviewFormProps = {
  action: (formData: FormData) => Promise<void>;
  defaultDisplayName?: string;
};

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

export function ReviewForm({ action, defaultDisplayName = "" }: ReviewFormProps) {
  return (
    <form
      className="grid gap-4 rounded-card border border-border-subtle bg-surface p-5"
      action={action}
    >
      <div className="grid gap-1">
        <h4 className="text-[15px] font-semibold normal-case text-text">Leave a review</h4>
        <p className="meta">Your review replaces the last one from this browser</p>
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
        <span className="text-[13px] font-semibold text-text-muted">Review</span>
        <textarea
          id="body"
          name="body"
          required
          rows={4}
          maxLength={500}
          placeholder="Who killed it, what landed, would you watch again?"
          className={`${fieldInputClassName} min-h-[108px] resize-y`}
        />
      </label>
      <label className="flex min-h-10 items-center gap-2.5 text-text-muted">
        <input name="spoiler" type="checkbox" value="true" className="h-4.5 w-4.5 accent-accent" />
        This review spoils the episode
      </label>
      <button className={`${chipClassName(true)} min-w-40 justify-self-start`} type="submit">
        Submit review
      </button>
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
      <ReviewBody body={thread.body} spoiler={thread.spoiler} />
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
