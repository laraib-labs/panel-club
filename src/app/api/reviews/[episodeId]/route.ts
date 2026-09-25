import { NextResponse } from "next/server";

import { getReviewsPool } from "../../../../lib/reviews-db.ts";
import { listReviewThreadPage } from "../../../../lib/reviews-pg.ts";

export async function GET(request: Request, { params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params;
  const cursorToken = new URL(request.url).searchParams.get("cursor");
  let cursor: { createdAt: string; id: string } | null = null;
  if (cursorToken) {
    try {
      const [createdAt, id] = Buffer.from(cursorToken, "base64url").toString().split("\n");
      if (!createdAt || !id || createdAt.length > 40 || id.length > 100) throw new Error("invalid cursor");
      cursor = { createdAt, id };
    } catch {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
  }
  const page = await listReviewThreadPage(getReviewsPool(), episodeId, cursor);
  return NextResponse.json({
    ...page,
    threads: page.threads.map(({ review, replies }) => ({
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
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
