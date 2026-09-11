"use client";

import type { FormEvent, ReactNode } from "react";
import { Loader2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DocumentFormDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    icon: ReactNode;
    title: string;
    description: string;
    children: ReactNode;
    sidebar: ReactNode;
    cancelLabel: string;
    submitLabel: string;
    submittingLabel: string;
    submitting: boolean;
    submitDisabled: boolean;
    onCancel: () => void;
    contentClassName?: string;
    footerStart?: ReactNode;
};

/**
 * Shared shell for quote, invoice, and expense forms.
 * Overrides DialogContent defaults (sm:max-w-lg, grid, gap-4, p-6) that otherwise
 * crush the two-column document layout. Header and footer stay outside the scroll area.
 */
export function DocumentFormDialog({
    open,
    onOpenChange,
    onSubmit,
    icon,
    title,
    description,
    children,
    sidebar,
    cancelLabel,
    submitLabel,
    submittingLabel,
    submitting,
    submitDisabled,
    onCancel,
    contentClassName,
    footerStart,
}: DocumentFormDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    "flex h-auto max-h-[min(95vh,calc(100%-1rem))] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-[28px] border-[var(--border-soft)] p-0",
                    // Explicit sm: override — base max-w alone does not beat DialogContent sm:max-w-lg.
                    "sm:max-w-[min(1280px,calc(100vw-2rem))]",
                    contentClassName,
                )}
            >
                <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <DialogHeader className="flex-none border-b border-[var(--border-soft)] px-4 py-4 sm:px-6 sm:py-5">
                        <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--text-main)] sm:text-xl">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]">
                                {icon}
                            </span>
                            <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
                        </DialogTitle>
                        <DialogDescription className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                            {description}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="@container min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
                        <div className="grid grid-cols-1 gap-5 @[48rem]:grid-cols-[minmax(0,1fr)_minmax(16rem,19rem)] @[48rem]:items-start @[48rem]:gap-6">
                            <div className="flex min-w-0 w-full flex-col gap-5">{children}</div>
                            <aside className="min-w-0 w-full @[48rem]:sticky @[48rem]:top-0">
                                {sidebar}
                            </aside>
                        </div>
                    </div>

                    <footer className="dialog-glass-chrome flex flex-none flex-col-reverse gap-2 border-t border-[var(--border-soft)] px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                        {footerStart}
                        <Button type="button" variant="cancel" onClick={onCancel} className="w-full sm:w-auto">
                            {cancelLabel}
                        </Button>
                        <Button type="submit" disabled={submitDisabled || submitting} className="w-full sm:min-w-48 sm:w-auto">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {submitting ? submittingLabel : submitLabel}
                        </Button>
                    </footer>
                </form>
            </DialogContent>
        </Dialog>
    );
}
