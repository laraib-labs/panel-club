import Link from "next/link";

import { SiteHeader } from "../components/site-header.tsx";

export default function NotFound() {
  return (
    <>
      <SiteHeader current="discover" />
      <div className="pad">
        <h3>That show or episode is not in the catalog.</h3>
        <p className="meta">
          The link may be old, or the episode was removed from the public list.
        </p>
        <Link href="/">Back to Discover</Link>
      </div>
    </>
  );
}
