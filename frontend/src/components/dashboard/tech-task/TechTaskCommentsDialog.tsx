"use client";

import React from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";

interface Comment {
    author: string;
    text: string;
    date: string;
}

interface TechTaskCommentsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    comments: Comment[];
    isCurrentTaskSessionActive: boolean;
    locale: string;
    newCommentText: string;
    setNewCommentText: (text: string) => void;
    onAddComment: (e: React.FormEvent) => Promise<void>;
    onDeleteComment: (date: string) => Promise<void>;
}

export function TechTaskCommentsDialog({
    open,
    onOpenChange,
    comments,
    isCurrentTaskSessionActive,
    locale,
    newCommentText,
    setNewCommentText,
    onAddComment,
    onDeleteComment,
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

                {/* Comments feed */}
                <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1 mt-2">
                    {comments.length === 0 ? (
                        <div className="text-center py-12 text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            {dict.tech.comments_empty}
                        </div>
                    ) : (
                        comments.map((c) => {
                            const formattedDate = (() => {
                                try {
                                    return new Date(c.date).toLocaleTimeString(locale === "en" ? "en-US" : "es-ES", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        timeZone: "UTC",
                                    }) + " - " + new Date(c.date).toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
                                        month: "short",
                                        day: "numeric",
                                        timeZone: "UTC",
                                    });
                                } catch {
                                    return "";
                                }
                            })();

                            return (
                                <div key={`${c.author}-${c.date}-${c.text}`} className="flex flex-col gap-1 p-3 bg-[var(--bg-secondary)]/50 rounded-2xl border border-[var(--border-soft)]/60 relative group">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wide text-accent">
                                        <span>{c.author}</span>
                                        <span className="text-[9px] text-[var(--text-muted)] font-bold lowercase">{formattedDate}</span>
                                    </div>
                                    <p className="text-xs font-semibold text-[var(--text-main)] leading-relaxed whitespace-pre-wrap mt-0.5 pr-6">
                                        {c.text}
                                    </p>

                                    {isCurrentTaskSessionActive && (
                                        <button
                                            type="button"
                                            onClick={() => onDeleteComment(c.date)}
                                            className="absolute top-2 right-2 p-1 text-[var(--text-muted)] hover:text-red-500 bg-transparent border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                            title={dict.tech.comments_delete}
                                            aria-label={dict.tech.comments_delete}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

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
