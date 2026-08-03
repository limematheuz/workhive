"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    onConfirm: () => void;
    isDeleting?: boolean;
    confirmText?: string;
    cancelText?: string;
    confirmIcon?: LucideIcon;
    confirmVariant?: "danger" | "soft-danger" | "primary";
}

export function DeleteConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
    isDeleting = false,
    confirmText = "Delete",
    cancelText = "Cancel",
    confirmIcon: ConfirmIcon = Trash2,
    confirmVariant = "danger",
}: DeleteConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="w-[calc(100vw-2rem)] border border-[var(--border-soft)] text-[var(--text-main)] rounded-2xl p-5 sm:max-w-md sm:p-6"
            >
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-[var(--btn-cancel-bg)] rounded-xl border border-[var(--btn-cancel-border)] text-[var(--btn-cancel-text)] shrink-0">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="space-y-2 flex-1">
                        <DialogTitle className="text-base font-black tracking-tight text-[var(--text-main)] mt-0.5">
                            {title}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-[var(--text-muted)] font-medium leading-relaxed">
                            {description}
                        </DialogDescription>
                    </div>
                </div>
                <div className="flex flex-col-reverse gap-3 mt-6 pt-4 border-t border-[var(--border-soft)] sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="w-full bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] border border-[var(--btn-neutral-border)] hover:bg-[var(--btn-neutral-hover-bg)] text-sm font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion sm:w-auto"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className={`w-full text-sm font-semibold rounded-xl px-5 py-2.5 border-none flex items-center justify-center gap-2 cursor-pointer ui-motion active:scale-[0.98] disabled:opacity-60 sm:w-auto ${
                            confirmVariant === "primary"
                                ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]"
                                : confirmVariant === "soft-danger"
                                  ? "border border-red-500/30 bg-red-500/10 text-red-600 hover:border-red-600 hover:bg-red-600 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500/40"
                                  : "border border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500/40"
                        }`}
                    >
                        {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <ConfirmIcon className="w-3.5 h-3.5" />
                        )}
                        {confirmText}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
