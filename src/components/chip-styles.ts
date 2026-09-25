/**
 * Shared button/chip visual language — filled accent for the active/primary
 * state, quiet outline for resting/secondary. Used for filter chips, toggle
 * actions (Save, Mark finished), and form buttons (Submit, Reply, Cancel) so
 * the whole site reuses one button, not a different one per component.
 */
export function chipClassName(active: boolean): string {
  const base =
    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-pill border px-3.5 text-sm transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
  return active
    ? `${base} border-accent bg-accent font-semibold text-ink`
    : `${base} border-border-subtle bg-surface text-text-muted hover:border-border hover:text-text`;
}
