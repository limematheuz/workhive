"use client";

import React from "react";
import Image from "next/image";
import { Paperclip, Camera, Trash2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";
import { resolveApiMediaUrl } from "@/lib/api";

interface Attachment {
    url: string;
    date: string;
    name?: string;
}

interface TechTaskAttachmentsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attachments: Attachment[];
    isCurrentTaskSessionActive: boolean;
    uploadingAttachment: boolean;
    onUploadAttachment: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    onDeleteAttachment: (url: string) => Promise<void>;
}

export function TechTaskAttachmentsDialog({
    open,
    onOpenChange,
    attachments,
    isCurrentTaskSessionActive,
    uploadingAttachment,
    onUploadAttachment,
    onDeleteAttachment,
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

                {/* Attachments grid */}
                <div className="flex-1 overflow-y-auto py-4 pr-1 mt-2">
                    {attachments.length === 0 ? (
                        <div className="text-center py-10 text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            {dict.tech.attachments_empty}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {attachments.map((att, idx) => (
                                <div key={`${att.url}-${att.date}-${att.name || "attachment"}`} className="relative rounded-2xl overflow-hidden border border-[var(--border-soft)] bg-[var(--bg-secondary)]/50 group aspect-square flex items-center justify-center">
                                    <Image
                                        src={resolveApiMediaUrl(att.url) || ""}
                                        alt={att.name || "Attachment"}
                                        fill
                                        sizes="(max-width: 768px) 50vw, 12rem"
                                        className="object-cover"
                                        unoptimized
                                    />
                                    {isCurrentTaskSessionActive && (
                                        <button
                                            type="button"
                                            onClick={() => onDeleteAttachment(att.url)}
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600/90 text-white hover:bg-red-700 transition-colors border-none cursor-pointer"
                                            title={dict.tech.btn_delete}
                                            aria-label={dict.tech.btn_delete}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-[9px] text-white font-semibold truncate">
                                        {att.name || `adjunto_${idx + 1}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
