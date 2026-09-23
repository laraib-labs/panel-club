import Link from "next/link";

export type NavKey = "discover" | "upcoming" | "people" | "library";

type SiteHeaderProps = {
  current?: NavKey;
};

const links: { href: string; label: string; key: NavKey }[] = [
  { href: "/", label: "Discover", key: "discover" },
  { href: "/upcoming", label: "Upcoming", key: "upcoming" },
  { href: "/people", label: "People", key: "people" },
  { href: "/library", label: "Library", key: "library" },
];

export function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <header className="bar float-bar">
      <strong className="brand">
        <i />
        Panel Club
      </strong>
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          aria-current={current === link.key ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </header>
  );
}
