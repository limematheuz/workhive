import { formControlSurfaceClassName } from "@/components/ui/control-styles";

export const taskFormSectionClass =
    "space-y-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4 sm:p-5";

export const taskFormSectionHeaderClass =
    "space-y-1 border-b border-[var(--border-soft)] pb-3";

export const taskFormSectionTitleClass =
    "text-xs font-black uppercase tracking-[0.12em] text-[var(--text-main)]";

export const taskFormSectionHintClass =
    "text-xs font-medium leading-relaxed text-[var(--text-muted)]";

export const taskFormLabelClass =
    "block text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]";

export const taskFormControlClass =
    `${formControlSurfaceClassName} h-11 w-full rounded-xl border px-3 text-base font-medium md:text-sm`;

export const taskFormTextAreaClass =
    `${formControlSurfaceClassName} w-full resize-none rounded-xl border px-3 py-2.5 text-base font-medium md:text-sm`;

export const taskFormReadOnlyClass =
    `${taskFormControlClass} flex items-center gap-2`;
