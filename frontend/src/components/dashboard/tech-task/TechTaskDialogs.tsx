"use client";

import React from "react";
import type { Dictionary } from "@/lib/dictionary-context";
import { TechTaskChecklistDialog } from "./TechTaskChecklistDialog";
import { TechTaskAttachmentsDialog } from "./TechTaskAttachmentsDialog";
import { TechTaskCommentsDialog } from "./TechTaskCommentsDialog";
import type { ChecklistItem } from "./hooks/useTechTaskChecklist";
import type { User } from "@/types/user";

type TechTaskDialogsProps = {
    requisitosOpen: boolean;
    setRequisitosOpen: (open: boolean) => void;
    adjuntosOpen: boolean;
    setAdjuntosOpen: (open: boolean) => void;
    comentariosOpen: boolean;
    setComentariosOpen: (open: boolean) => void;
    checklist: ChecklistItem[];
    categoryItems: ChecklistItem[];
    activeCategory: "General" | "Baño" | "Cocina";
    setActiveCategory: (cat: "General" | "Baño" | "Cocina") => void;
    currentTaskSessionActive: boolean;
    dict: Dictionary;
    expandedItem: string | null;
    setExpandedItem: React.Dispatch<React.SetStateAction<string | null>>;
    completedHidden: boolean;
    setCompletedHidden: React.Dispatch<React.SetStateAction<boolean>>;
    uploadingChecklistItem: string | null;
    availableAssignees: User[];
    getCategoryForItem: (question: string) => "General" | "Baño" | "Cocina";
    onAnswer: (itemId: string, answer: "yes" | "no") => Promise<void>;
    onNoteChange: (itemId: string, note: string) => void;
    onPersistNote: (itemId: string, note: string) => Promise<boolean>;
    onChecklistPhoto: (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    onResetChecklist: () => Promise<void>;
    onAddChecklistItem: (question: string, assigneeId: number) => Promise<boolean>;
    uploadingAttachment: boolean;
    onUploadAttachment: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    newCommentText: string;
    setNewCommentText: (text: string) => void;
    onAddComment: (e: React.FormEvent) => Promise<boolean>;
};

export function TechTaskDialogs(props: TechTaskDialogsProps) {
    return (
        <>
            <TechTaskChecklistDialog
                open={props.requisitosOpen}
                onOpenChange={props.setRequisitosOpen}
                checklist={props.checklist}
                categoryItems={props.categoryItems}
                activeCategory={props.activeCategory}
                setActiveCategory={props.setActiveCategory}
                isCurrentTaskSessionActive={props.currentTaskSessionActive}
                dict={props.dict}
                expandedItem={props.expandedItem}
                setExpandedItem={props.setExpandedItem}
                hideCompleted={props.completedHidden}
                setHideCompleted={props.setCompletedHidden}
                uploadingChecklistItem={props.uploadingChecklistItem}
                availableAssignees={props.availableAssignees}
                getCategoryForItem={props.getCategoryForItem}
                onAnswer={props.onAnswer}
                onNoteChange={props.onNoteChange}
                onPersistNote={props.onPersistNote}
                onChecklistPhoto={props.onChecklistPhoto}
                onResetChecklist={props.onResetChecklist}
                onAddChecklistItem={props.onAddChecklistItem}
            />

            <TechTaskAttachmentsDialog
                open={props.adjuntosOpen}
                onOpenChange={props.setAdjuntosOpen}
                uploadingAttachment={props.uploadingAttachment}
                onUploadAttachment={props.onUploadAttachment}
            />

            <TechTaskCommentsDialog
                open={props.comentariosOpen}
                onOpenChange={props.setComentariosOpen}
                newCommentText={props.newCommentText}
                setNewCommentText={props.setNewCommentText}
                onAddComment={props.onAddComment}
            />
        </>
    );
}
