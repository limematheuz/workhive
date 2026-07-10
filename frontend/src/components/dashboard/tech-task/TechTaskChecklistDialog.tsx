"use client";

import React from "react";
import { ClipboardCheck, Camera, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { User } from "@/types/user";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ChecklistItem } from "./hooks/useTechTaskChecklist";
import type { Dictionary } from "@/lib/dictionary-context";

interface TechTaskChecklistDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    checklist: ChecklistItem[];
    categoryItems: ChecklistItem[];
    activeCategory: "General" | "Baño" | "Cocina";
    setActiveCategory: (cat: "General" | "Baño" | "Cocina") => void;
    isCurrentTaskSessionActive: boolean;
    dict: Dictionary;
    expandedItem: string | null;
    setExpandedItem: React.Dispatch<React.SetStateAction<string | null>>;
    hideCompleted: boolean;
    setHideCompleted: React.Dispatch<React.SetStateAction<boolean>>;
    uploadingChecklistItem: string | null;
    availableAssignees: User[];
    getCategoryForItem: (question: string) => "General" | "Baño" | "Cocina";
    onAnswer: (itemId: string, answer: "yes" | "no") => Promise<void>;
    onNoteChange: (itemId: string, note: string) => void;
    onPersistNote: (itemId: string, note: string) => Promise<void>;
    onChecklistPhoto: (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    onResetChecklist: () => Promise<void>;
    onAddChecklistItem: (e: React.FormEvent) => Promise<void>;
}

export function TechTaskChecklistDialog({
    open,
    onOpenChange,
    checklist,
    categoryItems,
    activeCategory,
    setActiveCategory,
    isCurrentTaskSessionActive,
    dict,
    expandedItem,
    setExpandedItem,
    hideCompleted,
    setHideCompleted,
    uploadingChecklistItem,
    availableAssignees,
    getCategoryForItem,
    onAnswer,
    onNoteChange,
    onPersistNote,
    onChecklistPhoto,
    onResetChecklist,
    onAddChecklistItem,
}: TechTaskChecklistDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-main)] rounded-3xl p-6 flex flex-col max-h-[85vh] overflow-hidden">
                <DialogHeader className="border-b border-[var(--border-soft)] pb-4">
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5 text-accent" />
                        {dict.tech.requirements_title}
                    </DialogTitle>
                    <DialogDescription className="text-2xs text-[var(--text-muted)]">
                        {dict.tech.requirements_subtitle}
                    </DialogDescription>
                </DialogHeader>

                {/* Category Tabs */}
                <div className="flex border-b border-[var(--border-soft)] mt-3">
                    {(["General", "Baño", "Cocina"] as const).map((cat) => {
                        const itemsInCat = checklist.filter(i => getCategoryForItem(i.question) === cat);
                        const completedInCat = itemsInCat.filter(i => i.answer !== null).length;
                        const totalInCat = itemsInCat.length;
                        const isActive = activeCategory === cat;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setActiveCategory(cat)}
                                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-all relative border-none bg-transparent cursor-pointer ${
                                    isActive ? "text-accent font-black" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                }`}
                            >
                                {cat === "General" ? dict.tech.category_general : cat === "Baño" ? dict.tech.category_bathroom : dict.tech.category_kitchen} <span className="text-[10px] opacity-70">({completedInCat}/{totalInCat})</span>
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                    {/* Add checklist item form */}
                    {isCurrentTaskSessionActive && (
                        <form
                            onSubmit={onAddChecklistItem}
                            className="grid gap-2 bg-[var(--bg-secondary)]/40 p-2 border border-[var(--border-soft)] rounded-xl sm:grid-cols-[1fr_12rem_auto]"
                        >
                            <input
                                type="text"
                                name="question"
                                placeholder={dict.tech.checklist_item_placeholder || "ej: Limpiar debajo del sofá"}
                                required
                                className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
                            />
                            <select
                                name="assignee_id"
                                defaultValue=""
                                required
                                aria-label={dict.tech?.assign_to_placeholder || "Assign to..."}
                                className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
                            >
                                <option value="" disabled>{dict.tech?.assign_to_placeholder || "Assign to..."}</option>
                                {availableAssignees.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.full_name || user.email}
                                    </option>
                                ))}
                            </select>
                            <Button
                                type="submit"
                                className="bg-accent hover:bg-accent-light text-white font-black text-xs px-3.5 py-1.5 rounded-lg border-none cursor-pointer flex items-center justify-center h-8"
                            >
                                {dict.tech.btn_add || "Añadir"}
                            </Button>
                        </form>
                    )}

                    {/* Checklist items */}
                    <div className="space-y-3">
                        {categoryItems.length === 0 ? (
                            <div className="text-center py-8 bg-[var(--bg-primary)]/5 rounded-2xl border border-dashed text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                                {dict.tech.requirements_empty}
                            </div>
                        ) : (
                            categoryItems.map(item => {
                                const isExpanded = expandedItem === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        className={`p-3.5 rounded-2xl border transition-all duration-200 bg-[var(--bg-card)] ${
                                            item.answer !== null
                                                ? "border-accent/20 bg-accent/[0.01]"
                                                : "border-[var(--border-soft)] hover:border-accent/20"
                                        }`}
                                    >
                                        <div className="flex flex-col gap-3">
                                            <div className="text-xs font-bold text-[var(--text-main)] leading-relaxed">
                                                {(dict.tech.checklist as Record<string, string>)?.[item.id] || item.question}
                                                {item.assignedUserId && (
                                                    <span className="ml-2 text-[9px] bg-accent/10 border border-accent/20 px-2 py-0.5 rounded text-accent font-black uppercase tracking-wide inline-block">
                                                        {dict.tech.requirements_assign_to} {item.assignedUserName || `ID: ${item.assignedUserId}`}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between gap-4 mt-1 border-t border-[var(--border-soft)]/40 pt-2">
                                                <div className="flex gap-2 w-1/2">
                                                    <button
                                                        type="button"
                                                        onClick={() => onAnswer(item.id, "yes")}
                                                        className={`flex-1 py-1.5 px-3 border rounded-xl text-2xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                                            item.answer === "yes"
                                                                ? "bg-accent border-accent text-white shadow-sm"
                                                                : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
                                                        }`}
                                                    >
                                                        {dict.tech.btn_yes}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onAnswer(item.id, "no")}
                                                        className={`flex-1 py-1.5 px-3 border rounded-xl text-2xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                                            item.answer === "no"
                                                                ? "bg-red-600 border-red-600 text-white shadow-sm"
                                                                : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
                                                        }`}
                                                    >
                                                        {dict.tech.btn_no}
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <label
                                                        className={`p-2 rounded-xl border transition-all cursor-pointer bg-transparent ${
                                                            item.photoAttached
                                                                ? "bg-accent/10 border-accent text-accent"
                                                                : "border-[var(--border-soft)] hover:bg-[var(--bg-primary)] text-[var(--text-muted)]"
                                                        }`}
                                                        title={dict.tech.btn_upload_photo}
                                                    >
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            aria-label={dict.tech.btn_upload_photo}
                                                            className="hidden"
                                                            disabled={uploadingChecklistItem === item.id}
                                                            onChange={(event) => onChecklistPhoto(item.id, event)}
                                                        />
                                                        <Camera className="w-3.5 h-3.5" />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                                        className={`p-2 rounded-xl border transition-all cursor-pointer bg-transparent ${
                                                            item.note
                                                                ? "bg-accent/10 border-accent text-accent"
                                                                : "border-[var(--border-soft)] hover:bg-[var(--bg-primary)] text-[var(--text-muted)]"
                                                        }`}
                                                        title={dict.tech.btn_add_note}
                                                        aria-label={dict.tech.btn_add_note}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Note expanded */}
                                        {isExpanded && (
                                            <div className="mt-3 pt-3 border-t border-dashed border-[var(--border-soft)] space-y-2">
                                                <label htmlFor={`tech-checklist-note-${item.id}`} className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider">
                                                    {dict.tech.ops_notes_label}
                                                </label>
                                                <textarea
                                                    id={`tech-checklist-note-${item.id}`}
                                                    value={item.note}
                                                    onChange={(e) => onNoteChange(item.id, e.target.value)}
                                                    onBlur={(e) => onPersistNote(item.id, e.target.value)}
                                                    placeholder={dict.tech.notes_placeholder}
                                                    rows={2}
                                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent resize-none font-semibold"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Dialog Footer */}
                <div className="border-t border-[var(--border-soft)] pt-4 flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-2">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="hideCompletedDialog"
                            checked={hideCompleted}
                            onChange={(e) => setHideCompleted(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-accent focus:ring-accent accent-accent cursor-pointer"
                        />
                        <label htmlFor="hideCompletedDialog" className="cursor-pointer">
                            {dict.tech.hide_completed}
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={onResetChecklist}
                        className="text-[var(--btn-cancel-text)] hover:text-[var(--btn-cancel-text)] transition-colors bg-transparent border-none cursor-pointer font-bold uppercase"
                    >
                        {dict.tech.reset_checklist}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
