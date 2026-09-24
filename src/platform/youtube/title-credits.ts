function stripHandle(name: string): string {
  return name.replace(/^@/, "").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

export function parseCredits(title: string, description?: string | null): string {
  const fromTitle = parseFeaturedGuests(title);
  if (fromTitle.length > 0) {
    return fromTitle;
  }

  if (!description || description.length === 0) {
    return "";
  }

  const ftMatch = description.match(/\b(?:ft\.?|feat\.?|featuring)\s+([^\n]+)/i);
  if (ftMatch) {
    const trimmed = ftMatch[1].replace(/\s+in\s+.+$/i, "").trim();
    return parseFeaturedGuests(`ft. ${trimmed}`);
  }

  const guestsMatch = description.match(/\bGuests:\s*([^\n]+)/i);
  if (guestsMatch) {
    const trimmed = guestsMatch[1].replace(/\s+in\s+.+$/i, "").trim();
    return parseFeaturedGuests(`ft. ${trimmed}`);
  }

  return "";
}

export function parseFeaturedGuests(title: string): string {
  const match = title.match(/\b(?:ft\.?|feat\.?|featuring)\s+(.+)$/i);

  if (!match) {
    return "";
  }

  const raw = match[1]
    .replace(/\s*[|/].*$/, "")
    .replace(/\s*\([^)]*\)\s*/g, " ");

  const names = raw
    .split(/\s*,\s*|\s+&\s+|\s+and\s+/i)
    .map((part) => stripHandle(part.replace(/\s+/g, " ").trim()))
    .filter((part) => part.length > 0 && !/^s\d/i.test(part) && !/^ep\b/i.test(part));

  return names.join(", ");
}

export function titleMatchesInclude(title: string, titleInclude: string | null): boolean {
  if (!titleInclude || titleInclude.length === 0) {
    return true;
  }

  return title.toLowerCase().includes(titleInclude.toLowerCase());
}

export function looksLikeShort(title: string): boolean {
  return /#shorts\b/i.test(title) || /\bshort\b/i.test(title);
}
