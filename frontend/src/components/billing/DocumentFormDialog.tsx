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
};

/** Shared shell for quote and invoice forms; only their business fields differ. */
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
}: DocumentFormDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[95vh] w-[calc(100vw-2rem)] max-w-[1280px] flex-col overflow-hidden rounded-[28px] border-[var(--border-soft)] p-0">
                <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <DialogHeader className="flex-none border-b border-[var(--border-soft)] px-5 py-5 sm:px-6">
                        <DialogTitle className="flex items-center gap-2.5 text-xl font-black tracking-tight text-[var(--text-main)]">
                            <span className="flex size-9 items-center justify-center rounded-xl border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]">
                                {icon}
                            </span>
                            {title}
                        </DialogTitle>
                        <DialogDescription className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                            {description}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-6">
                        <div className="min-w-0">{children}</div>
                        <aside className="min-w-0 border-t border-[var(--border-soft)] pt-5 lg:sticky lg:top-0 lg:self-start lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                            {sidebar}
                        </aside>
                    </div>

                    <footer className="dialog-glass-chrome flex flex-none flex-col-reverse gap-2 border-t border-[var(--border-soft)] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <Button type="button" variant="dangerSoft" onClick={onCancel} className="w-full sm:w-auto">
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
