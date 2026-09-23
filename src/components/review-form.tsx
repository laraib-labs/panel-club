"use client";

type ReviewFormProps = {
  action: (formData: FormData) => Promise<void>;
  defaultDisplayName?: string;
};

export function ReviewForm({ action, defaultDisplayName = "" }: ReviewFormProps) {
  return (
    <form className="form" action={action}>
      <strong>Your review replaces the last one from this browser</strong>
      <label className="line" htmlFor="displayName">Display name</label>
      <input
        id="displayName"
        name="displayName"
        type="text"
        required
        defaultValue={defaultDisplayName}
      />
      <fieldset className="stars">
        <legend>Stars</legend>
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star}>
            <input type="radio" name="stars" value={String(star)} required />
            {star}
          </label>
        ))}
      </fieldset>
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
