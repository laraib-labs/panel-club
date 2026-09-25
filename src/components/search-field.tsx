"use client";

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 text-text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="8.5" cy="8.5" r="6" />
      <path d="M13 13 L18 18" strokeLinecap="round" />
    </svg>
  );
}

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
};

export function SearchField({ value, onChange, placeholder, ariaLabel }: SearchFieldProps) {
  return (
    <label className="flex min-h-12 items-center gap-2 rounded-pill border border-border-subtle bg-surface px-4 transition-colors duration-fast focus-within:border-accent">
      <SearchIcon />
      <span className="sr-only">{ariaLabel}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="min-w-0 flex-1 appearance-none border-0 bg-transparent font-sans text-text outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
      />
    </label>
  );
}
