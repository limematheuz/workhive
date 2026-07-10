"use client";

import { useState, useMemo } from "react";
import { toast } from "@/lib/toast";
import { TaskService } from "@/services/task.service";
import { UploadService } from "@/services/upload.service";
import type { TaskItem, User } from "@/types/user";

interface LegacyTaskMetadata {
    comments?: NonNullable<TaskItem["operational_notes"]>;
    attachments?: NonNullable<TaskItem["attachments"]>;
}

interface UseTechTaskAttachmentsCommentsParams {
    task: TaskItem;
    currentUser: User;
    onStatusUpdate: () => void;
}

export function useTechTaskAttachmentsComments({
    task,
    currentUser,
    onStatusUpdate,
}: UseTechTaskAttachmentsCommentsParams) {
    const legacyMetadata = useMemo<LegacyTaskMetadata>(() => {
        if (!task.description) return {};
        const match = task.description.match(/<!-- workhive_meta: ([\s\S]*?) -->/);
        if (match) {
            try {
                return JSON.parse(match[1]) as LegacyTaskMetadata;
            } catch (e) {
                console.error("Failed to parse task metadata", e);
            }
        }
        return {};
    }, [task.description]);

    const comments = useMemo(
        () => task.operational_notes?.length
            ? task.operational_notes
            : (legacyMetadata.comments || []),
        [task.operational_notes, legacyMetadata]
    );

    const attachments = useMemo(
        () => task.attachments?.length
            ? task.attachments
            : (legacyMetadata.attachments || []),
        [task.attachments, legacyMetadata]
    );

    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [newCommentText, setNewCommentText] = useState("");

    const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];

        setUploadingAttachment(true);
        try {
            const res = await UploadService.uploadFile(file, "location");
            const newAttachment = {
                url: res.url,
                date: new Date().toISOString(),
                name: file.name
            };
            await TaskService.updateTaskItem(task.id, {
                attachments: [...attachments, newAttachment]
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

    const handleDeleteAttachment = async (urlToDelete: string) => {
        try {
            await TaskService.updateTaskItem(task.id, {
                attachments: attachments.filter((attachment) => attachment.url !== urlToDelete)
            });
            onStatusUpdate();
            toast.success("Archivo eliminado");
        } catch (err) {
            console.error("Error deleting attachment", err);
            toast.error("Error al eliminar el archivo");
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCommentText.trim()) return;

        const newComment = {
            author: currentUser?.full_name || currentUser?.email || "Técnico",
            text: newCommentText.trim(),
            date: new Date().toISOString()
        };

        try {
            await TaskService.updateTaskItem(task.id, {
                operational_notes: [...comments, newComment]
            });
            onStatusUpdate();
            setNewCommentText("");
            toast.success("Comentario añadido");
        } catch (err) {
            console.error("Error adding comment", err);
            toast.error("Error al añadir el comentario");
        }
    };

    const handleDeleteComment = async (dateToDelete: string) => {
        try {
            await TaskService.updateTaskItem(task.id, {
                operational_notes: comments.filter((comment) => comment.date !== dateToDelete)
            });
            onStatusUpdate();
            toast.success("Comentario eliminado");
        } catch (err) {
            console.error("Error deleting comment", err);
            toast.error("Error al eliminar el comentario");
        }
    };

    return {
        comments,
        attachments,
        uploadingAttachment,
        newCommentText,
        setNewCommentText,
        handleUploadAttachment,
        handleDeleteAttachment,
        handleAddComment,
        handleDeleteComment,
    };
}
