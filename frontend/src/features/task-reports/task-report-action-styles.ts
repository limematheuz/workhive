/** Compact action styles matching tech-task / premium-tabs personality. */

export const reportActionCluster =
    "inline-flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 p-1";

const chip =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border-none disabled:cursor-not-allowed disabled:opacity-40";

export const reportPrimaryBtn =
    `${chip} bg-accent text-white shadow-sm hover:bg-accent-light`;

export const reportNeutralBtn =
    `${chip} bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]`;

export const reportSoftAccentBtn =
    `${chip} bg-accent/10 text-accent hover:bg-accent/15`;

export const reportDangerBtn =
    `${chip} bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)]`;
