import Link from "next/link";

export type NavKey = "discover" | "people" | "library";

type SiteHeaderProps = {
  current?: NavKey;
};

const links: { href: string; label: string; key: NavKey }[] = [
  { href: "/", label: "Discover", key: "discover" },
  { href: "/people", label: "People", key: "people" },
  { href: "/library", label: "Library", key: "library" },
];

export function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-10 flex flex-wrap items-center gap-4 border-b border-border-subtle bg-bg/90 px-5 py-3.5 backdrop-blur-md">
      <Link
        href="/"
        className="mr-auto flex items-center text-[15px] font-extrabold tracking-tight text-text"
      >
        <span
          aria-hidden="true"
          className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]"
        />
        Panel Club
      </Link>
      {links.map((link) => {
        const active = current === link.key;
        return (
          <Link
            key={link.key}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-10 items-center border-b-2 text-sm transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
              active
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </header>
  );
}
