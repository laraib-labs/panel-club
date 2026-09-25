import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { CATALOG_CACHE_TAG } from "../../../lib/catalog-cache.ts";

function isAuthorized(request: Request): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return false;
  }

  const expected = Buffer.from(secret);
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidateTag(CATALOG_CACHE_TAG);
  return NextResponse.json({ revalidated: true, tag: CATALOG_CACHE_TAG });
}
