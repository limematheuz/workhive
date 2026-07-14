"use client";

import React from "react";
import { Paperclip, Camera } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";

interface TechTaskAttachmentsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isCurrentTaskSessionActive: boolean;
    uploadingAttachment: boolean;
    onUploadAttachment: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function TechTaskAttachmentsDialog({
    open,
    onOpenChange,
    isCurrentTaskSessionActive,
    uploadingAttachment,
    onUploadAttachment,
}: TechTaskAttachmentsDialogProps) {
    const { dict } = useDictionary();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-main)] rounded-3xl p-6 flex flex-col max-h-[80vh] overflow-hidden">
                <DialogHeader className="border-b border-[var(--border-soft)] pb-4">
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <Paperclip className="w-5 h-5 text-accent" />
                        {dict.tech.attachments_title}
                    </DialogTitle>
                    <DialogDescription className="text-2xs text-[var(--text-muted)]">
                        {dict.tech.attachments_subtitle}
                    </DialogDescription>
                </DialogHeader>

                {/* Upload area */}
                {isCurrentTaskSessionActive && (
                    <div className="mt-4">
                        <label className="border-2 border-dashed border-[var(--border-soft)] hover:border-accent/50 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 bg-[var(--bg-primary)]/5">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={onUploadAttachment}
                                className="hidden"
                                disabled={uploadingAttachment}
                            />
                            <Camera className={`w-8 h-8 ${uploadingAttachment ? "text-accent animate-pulse" : "text-[var(--text-muted)]"}`} />
                            <span className="text-xs font-bold text-[var(--text-main)]">
                                {uploadingAttachment ? dict.tech.attachments_uploading : dict.tech.attachments_upload_btn}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">
                                {dict.tech.attachments_max_size}
                            </span>
                        </label>
                    </div>
                )}

                <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
                    {dict.task_reports.worker_hint}
                </p>
            </DialogContent>
        </Dialog>
    );
}
