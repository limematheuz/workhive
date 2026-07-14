"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { UploadService } from "@/services/upload.service";
import { TaskReportService } from "@/services/task-report.service";
import type { TaskItem } from "@/types/user";

interface UseTechTaskAttachmentsCommentsParams {
    task: TaskItem;
    onStatusUpdate: () => void;
}

export function useTechTaskAttachmentsComments({
    task,
    onStatusUpdate,
}: UseTechTaskAttachmentsCommentsParams) {
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [newCommentText, setNewCommentText] = useState("");

    const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];

        setUploadingAttachment(true);
        try {
            const res = await UploadService.uploadFile(file, "location");
            await TaskReportService.create({
                task_item_id: task.id,
                report_type: "photo",
                media_url: res.url,
                file_name: file.name,
            });
            onStatusUpdate();
            toast.success("Foto adjuntada y guardada con éxito");
        } catch (err) {
            console.error("Error uploading attachment", err);
            toast.error("Error al subir el archivo");
        } finally {
            setUploadingAttachment(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCommentText.trim()) return;

        try {
            await TaskReportService.create({
                task_item_id: task.id,
                report_type: "note",
                description: newCommentText.trim(),
            });
            onStatusUpdate();
            setNewCommentText("");
            toast.success("Comentario añadido");
        } catch (err) {
            console.error("Error adding comment", err);
            toast.error("Error al añadir el comentario");
        }
    };

    return {
        uploadingAttachment,
        newCommentText,
        setNewCommentText,
        handleUploadAttachment,
        handleAddComment,
    };
}
