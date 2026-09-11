/**
 * Shared metrics for page-level create / add / connect CTAs.
 * Source of truth: PrivacyControls "Exportar mis datos" button.
 */

/** Layout, type metrics, motion, and disabled — no color tokens. */
export const PAGE_ACTION_BUTTON_BASE =
    "inline-flex items-center justify-center gap-1.5 rounded-xl border px-5 py-2.5 text-xs font-semibold shadow-sm ui-motion hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

/** Primary black/white semantic tokens (matches Export CTA). */
export const PAGE_ACTION_BUTTON_PRIMARY =
    `${PAGE_ACTION_BUTTON_BASE} border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]`;
