"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
                    <Button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        variant="cancel"
                        className="w-full sm:w-auto"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        variant={confirmVariant === "primary" ? "default" : confirmVariant === "soft-danger" ? "dangerSoft" : "destructive"}
                        className="w-full sm:w-auto"
                    >
                        {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <ConfirmIcon className="w-3.5 h-3.5" />
                        )}
                        {confirmText}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
