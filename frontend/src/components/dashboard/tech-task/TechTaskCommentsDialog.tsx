"use client";

import React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    onAddComment: (e: React.FormEvent) => Promise<void>;
}

export function TechTaskCommentsDialog({
    open,
    onOpenChange,
    newCommentText,
    setNewCommentText,
    onAddComment,
}: TechTaskCommentsDialogProps) {
    const { dict } = useDictionary();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[80vh] max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--border-soft)] p-6 text-[var(--text-main)]">
                <DialogHeader className="border-b border-[var(--border-soft)] pb-4">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <MessageSquare className="h-5 w-5 text-accent" />
                        {dict.tech.comments_title}
                    </DialogTitle>
                    <DialogDescription className="text-2xs text-[var(--text-muted)]">
                        {dict.tech.comments_subtitle}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={onAddComment} className="mt-4 flex flex-col gap-3">
                    <textarea
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder={dict.tech.comments_placeholder}
                        required
                        rows={3}
                        className="w-full resize-none rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-medium text-[var(--text-main)] outline-none focus:border-accent"
                    />
                    <Button
                        type="submit"
                        className="flex h-10 cursor-pointer items-center justify-center self-end rounded-2xl border-none bg-accent px-4 text-xs font-black text-white hover:bg-accent-light"
                    >
                        {dict.tech.comments_submit}
                    </Button>
                </form>

                <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
                    {dict.task_reports.worker_hint}
                </p>
            </DialogContent>
        </Dialog>
    );
}
