export type Person = {
  name: string;
  slug: string;
};

export function personMonogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);

  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }

  const word = parts[0] ?? "";
  return word.slice(0, 2).toUpperCase();
}

export function filterPeople(people: Person[], query: string): Person[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return people;
  }

  return people.filter((person) => person.name.toLowerCase().includes(needle));
}
