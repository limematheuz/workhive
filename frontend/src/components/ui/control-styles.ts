/**
 * WorkHive's single surface for interactive shadcn form controls.
 *
 * Keep visual identity here; compose it only through Input, Textarea, Select
 * and Checkbox instead of reintroducing dialog-specific form CSS.
 */
export const formControlSurfaceClassName =
  "dialog-compact-control border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-main)] shadow-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
