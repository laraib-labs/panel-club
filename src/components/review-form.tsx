"use client";

import { useState } from "react";

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

function formatStars(stars: number): string {
  return `${"★".repeat(stars)}${"☆".repeat(5 - stars)}`;
}

function ReviewBody({ body, spoiler }: { body: string; spoiler: boolean }) {
  if (spoiler) {
    return (
      <details className="review-card__spoiler">
        <summary className="pill">Show spoiler</summary>
        <p className="review-card__body">{body}</p>
      </details>
    );
  }

  return <p className="review-card__body">{body}</p>;
}

function StarPicker({ name }: { name: string }) {
  const [stars, setStars] = useState(0);

  return (
    <div className="review-stars" role="radiogroup" aria-label="Stars">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          className={`review-star${value <= stars ? " review-star--on" : ""}`}
          aria-label={`${value} star${value === 1 ? "" : "s"}`}
          aria-pressed={value <= stars}
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
    <form className="review-form" action={action}>
      <strong>Your review replaces the last one from this browser</strong>
      <label className="line" htmlFor="displayName">Display name</label>
      <input
        id="displayName"
        name="displayName"
        type="text"
        required
        defaultValue={defaultDisplayName}
      />
      <p className="meta">Stars</p>
      <StarPicker name="stars" />
      <label>
        <input name="spoiler" type="checkbox" value="true" />
        This review spoils the episode
      </label>
      <label className="line" htmlFor="body">Review</label>
      <textarea id="body" name="body" required rows={4} />
      <div className="row">
        <button type="submit">Submit review</button>
      </div>
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
    <form className="reply-form" action={action}>
      <input type="hidden" name="parentId" value={parentId} />
      <label className="line" htmlFor={`reply-name-${parentId}`}>Display name</label>
      <input
        id={`reply-name-${parentId}`}
        name="displayName"
        type="text"
        required
        defaultValue={defaultDisplayName}
      />
      <label>
        <input name="spoiler" type="checkbox" value="true" />
        This review spoils the episode
      </label>
      <label className="line" htmlFor={`reply-body-${parentId}`}>Reply</label>
      <textarea id={`reply-body-${parentId}`} name="body" required rows={3} />
      <div className="row">
        <button type="submit">Reply</button>
        <button type="button" onClick={onCancel}>Cancel</button>
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
  const starsLabel = thread.stars === null ? "" : ` · ${formatStars(thread.stars)}`;

  return (
    <article className="review-card">
      <strong className="review-card__header">
        {thread.displayName}
        {starsLabel}
        {thread.spoiler ? " · Spoiler" : ""}
      </strong>
      <ReviewBody body={thread.body} spoiler={thread.spoiler} />
      {!replying ? (
        <button type="button" onClick={() => setReplying(true)}>Reply</button>
      ) : (
        <ReplyForm
          action={replyAction}
          parentId={thread.id}
          defaultDisplayName={defaultDisplayName}
          onCancel={() => setReplying(false)}
        />
      )}
      {thread.replies.length > 0 ? (
        <div className="reply-list">
          {thread.replies.map((reply) => (
            <div key={reply.id} className="reply-card">
              <strong>{reply.displayName}{reply.spoiler ? " · Spoiler" : ""}</strong>
              <ReviewBody body={reply.body} spoiler={reply.spoiler} />
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
