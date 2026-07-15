/** Shared macOS/iOS-style chrome for task dialogs in the general list. */

export const taskDialogOverlayClass = "dialog-glass-overlay";

export const taskDialogContentClass =
    "dialog-glass flex w-[95vw] flex-col gap-0 overflow-visible rounded-[28px] border border-[var(--border-soft)] !border-t border-t-[var(--border-soft)] p-0 shadow-[0_28px_90px_var(--shadow-color)] [scrollbar-width:none]";

export const taskDialogHeaderClass =
    "dialog-glass-chrome shrink-0 space-y-1 border-b border-[var(--border-soft)] px-5 py-3.5 pr-16 text-left sm:px-6 sm:py-4 rounded-t-[28px]";

export const taskDialogBodyClass =
    "min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-5 font-sans [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:p-6";

export const taskDialogFooterClass =
    "dialog-glass-chrome flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--border-soft)] px-5 py-3.5 sm:px-6 rounded-b-[28px]";

export const taskDialogChipBtnClass =
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl px-4 text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]";

export const taskDialogPrimaryBtnClass =
    `${taskDialogChipBtnClass} border border-transparent bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-sm hover:bg-[var(--btn-primary-hover-bg)]`;

export const taskDialogSecondaryBtnClass =
    `${taskDialogChipBtnClass} border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)]`;

export const taskDialogDangerBtnClass =
    `${taskDialogChipBtnClass} border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent`;

export const taskDialogGhostBtnClass =
    `${taskDialogChipBtnClass} border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent`;
