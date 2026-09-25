import Link from "next/link";

import { SiteHeader } from "../components/site-header.tsx";

export default function NotFound() {
  return (
    <>
      <SiteHeader current="discover" />
      <div className="mx-auto grid max-w-[1080px] gap-3 px-5 pb-7 pt-6">
        <h3 className="m-0 text-[26px] sm:text-4xl leading-[1.08] tracking-[-0.04em] text-text">
          That show or episode is not in the catalog.
        </h3>
        <p className="m-0 text-text-muted">
          The link may be old, or the episode was removed from the public list.
        </p>
        <Link
          className="justify-self-start text-sm font-semibold text-accent transition-colors duration-fast hover:text-accent-hover"
          href="/"
        >
          Back to Discover
        </Link>
      </div>
    </>
  );
}
