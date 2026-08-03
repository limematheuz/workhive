"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface WorkSessionStopWarningDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pendingTasksCount: number;
    dict: {
        work_sessions: {
            pending_tasks_title?: string;
            pending_tasks_description?: string;
            pending_tasks_cancel?: string;
            pending_tasks_confirm?: string;
        };
    };
    onConfirmStop: () => void;
}

export function WorkSessionStopWarningDialog({
    open,
    onOpenChange,
    pendingTasksCount,
    dict,
    onConfirmStop,
}: WorkSessionStopWarningDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md border border-[var(--border-soft)] text-[var(--text-main)] rounded-3xl p-6 z-[10002]">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-[var(--alert-warning-bg)] rounded-2xl border border-[var(--alert-warning-border)] text-[var(--alert-warning-text)] shrink-0">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="space-y-2 flex-1">
                        <DialogTitle className="text-base font-black tracking-tight text-[var(--text-main)] mt-0.5">
                            {dict.work_sessions?.pending_tasks_title || "Pending Tasks"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                            {(dict.work_sessions?.pending_tasks_description || "You have {count} pending tasks assigned to this location. Are you sure you want to end your shift without completing them?")
                                .replace("{count}", pendingTasksCount.toString())}
                        </DialogDescription>
                    </div>
                </div>
                <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-[var(--border-soft)]/30">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion"
                    >
                        {dict.work_sessions?.pending_tasks_cancel || "Cancel"}
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirmStop}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl px-5 py-2.5 border-none cursor-pointer ui-motion"
                    >
                        {dict.work_sessions?.pending_tasks_confirm || "Yes, Clock Out"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
