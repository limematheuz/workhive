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
import { Input } from "@/components/ui/input";

interface TechTaskAttachmentsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    uploadingAttachment: boolean;
    onUploadAttachment: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function TechTaskAttachmentsDialog({
    open,
    onOpenChange,
    uploadingAttachment,
    onUploadAttachment,
}: TechTaskAttachmentsDialogProps) {
    const { dict } = useDictionary();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[80vh] max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--border-soft)] p-6 text-[var(--text-main)]">
                <DialogHeader className="border-b border-[var(--border-soft)] pb-4">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Paperclip className="h-5 w-5 text-accent" />
                        {dict.tech.attachments_title}
                    </DialogTitle>
                    <DialogDescription className="text-2xs text-[var(--text-muted)]">
                        {dict.tech.attachments_subtitle}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--bg-primary)]/5 p-6 transition-colors duration-200 hover:border-accent/50">
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={onUploadAttachment}
                            className="hidden"
                            disabled={uploadingAttachment}
                        />
                        <Camera className={`h-8 w-8 ${uploadingAttachment ? "animate-pulse text-accent" : "text-[var(--text-muted)]"}`} />
                        <span className="text-xs font-bold text-[var(--text-main)]">
                            {uploadingAttachment ? dict.tech.attachments_uploading : dict.tech.attachments_upload_btn}
                        </span>
                        <span className="text-[10px] font-medium text-[var(--text-muted)]">
                            {dict.tech.attachments_max_size}
                        </span>
                    </label>
                </div>

                <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
                    {dict.task_reports.worker_hint}
                </p>
            </DialogContent>
        </Dialog>
    );
}
