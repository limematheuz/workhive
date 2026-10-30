"use client";

import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import { TechTaskCommentForm } from "./TechTaskCommentForm";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";

interface TechTaskCommentsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    newCommentText: string;
    setNewCommentText: (text: string) => void;
    onAddComment: (e: React.FormEvent) => Promise<boolean>;
}

export function TechTaskCommentsDialog({
    open,
    onOpenChange,
    newCommentText,
    setNewCommentText,
    onAddComment,
}: TechTaskCommentsDialogProps) {
    const { dict } = useDictionary();
    const [saving, setSaving] = useState(false);
    const changeOpen = (next: boolean) => {
        if (saving) return;
        if (!next) setNewCommentText("");
        onOpenChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={changeOpen}>
            <DialogContent
                showCloseButton={!saving}
                onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }}
                onPointerDownOutside={(event) => { if (saving) event.preventDefault(); }}
                className="flex max-h-[80vh] max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--border-soft)] p-6 text-[var(--text-main)]"
            >
                <DialogHeader className="border-b border-[var(--border-soft)] pb-4">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <MessageSquare className="h-5 w-5 text-accent" />
                        {dict.tech.comments_title}
                    </DialogTitle>
                    <DialogDescription className="text-2xs text-[var(--text-muted)]">
                        {dict.tech.comments_subtitle}
                    </DialogDescription>
                </DialogHeader>

                <TechTaskCommentForm
                    value={newCommentText}
                    onChange={setNewCommentText}
                    onSubmit={onAddComment}
                    saving={saving}
                    onSavingChange={setSaving}
                />

                <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
                    {dict.task_reports.worker_hint}
                </p>
            </DialogContent>
        </Dialog>
    );
}
