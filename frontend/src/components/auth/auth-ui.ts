/** Shared field / alert styles for public auth & marketing forms. */
/** 16px on mobile avoids iOS input zoom; md+ can tighten. */
export const AUTH_FIELD_CLASS =
    "w-full min-w-0 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/80 px-4 py-3 text-base text-[var(--text-main)] placeholder:text-[var(--text-muted)] shadow-[inset_0_1px_0_var(--glass-sheet-highlight)] outline-none ui-motion focus:border-accent/45 focus:bg-[var(--bg-secondary)] focus:ring-[3px] focus:ring-accent/15 md:text-sm";

export const AUTH_LABEL_CLASS =
    "mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]";

export function authAlertClass(type: "error" | "success" | "info" = "error"): string {
    const tone =
        type === "success"
            ? "border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-main)]"
            : type === "info"
              ? "border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-main)]"
              : "border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)]";
    return `rounded-xl border px-3.5 py-3 text-sm font-medium ui-motion ${tone}`;
}
