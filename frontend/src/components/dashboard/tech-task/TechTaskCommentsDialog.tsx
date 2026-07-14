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
    isCurrentTaskSessionActive: boolean;
    newCommentText: string;
    setNewCommentText: (text: string) => void;
    onAddComment: (e: React.FormEvent) => Promise<void>;
}

export function TechTaskCommentsDialog({
    open,
    onOpenChange,
    isCurrentTaskSessionActive,
    newCommentText,
    setNewCommentText,
    onAddComment,
}: TechTaskCommentsDialogProps) {
    const { dict } = useDictionary();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-main)] rounded-3xl p-6 flex flex-col max-h-[80vh] overflow-hidden">
                <DialogHeader className="border-b border-[var(--border-soft)] pb-4">
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-accent" />
                        {dict.tech.comments_title}
                    </DialogTitle>
                    <DialogDescription className="text-2xs text-[var(--text-muted)]">
                        {dict.tech.comments_subtitle}
                    </DialogDescription>
                </DialogHeader>

                <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                    {dict.task_reports.worker_hint}
                </p>

                {/* Comment input form */}
                {isCurrentTaskSessionActive && (
                    <form onSubmit={onAddComment} className="border-t border-[var(--border-soft)] pt-4 mt-2 flex gap-2">
                        <textarea
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder={dict.tech.comments_placeholder}
                            required
                            rows={2}
                            className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-2xl px-3 py-2 text-xs outline-none focus:border-accent resize-none font-medium"
                        />
                        <Button
                            type="submit"
                            className="bg-accent hover:bg-accent-light text-white font-black text-xs px-4 rounded-2xl border-none cursor-pointer flex items-center justify-center self-end h-10"
                        >
                            {dict.tech.comments_submit}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
