"use client";

import React from "react";
import {
    Camera,
    CheckCircle2,
    ChevronDown,
    ClipboardCheck,
    Pencil,
    Plus,
    RotateCcw,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { User } from "@/types/user";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    getChecklistProgress,
    getFirstPendingChecklistItem,
} from "@/lib/task-checklist-view";
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

const CATEGORIES = ["General", "Baño", "Cocina"] as const;

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
    const [focusItemId, setFocusItemId] = React.useState<string | null>(null);
    const progress = getChecklistProgress(checklist);
    const firstPendingItem = getFirstPendingChecklistItem(checklist);

    React.useEffect(() => {
        if (!focusItemId) return;

        const frame = window.requestAnimationFrame(() => {
            const item = document.getElementById(`checklist-requirement-${focusItemId}`);
            item?.scrollIntoView({ behavior: "smooth", block: "center" });
            item?.focus({ preventScroll: true });
            setFocusItemId(null);
        });

        return () => window.cancelAnimationFrame(frame);
    }, [categoryItems, focusItemId]);

    const goToFirstPending = () => {
        if (!firstPendingItem) return;
        setHideCompleted(false);
        setActiveCategory(getCategoryForItem(firstPendingItem.question));
        setFocusItemId(firstPendingItem.id);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="left-0 top-0 block h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-x-0 border-b-0 bg-[var(--bg-card)] p-0 text-[var(--text-main)] sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[88dvh] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border-x sm:border-b"
            >
                <DialogHeader className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[var(--bg-card)]/95 px-4 py-3 pr-14 text-left shadow-sm backdrop-blur-md sm:px-5 sm:pr-16">
                    <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <ClipboardCheck className="h-4 w-4" />
                        </span>
                        {dict.tech.requirements_title}
                    </DialogTitle>
                    <DialogDescription className="max-w-xl text-[11px] sm:text-xs">
                        {dict.tech.requirements_subtitle}
                    </DialogDescription>
                    <DialogClose
                        aria-label={dict.tech.requirements_close}
                        className="absolute right-3 top-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-main)] shadow-sm transition-colors hover:bg-[var(--bg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:right-4"
                    >
                        <X className="h-5 w-5" />
                    </DialogClose>
                </DialogHeader>

                <main className="space-y-3 px-3 pb-24 pt-3 sm:px-5 sm:pb-20">
                    <section
                        aria-labelledby="checklist-progress-title"
                        className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/45 p-3"
                    >
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                                <p id="checklist-progress-title" className="text-xs font-black text-[var(--text-main)]">
                                    {dict.tech.requirements_progress}
                                </p>
                                <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-muted)]" aria-live="polite">
                                    {progress.pending === 0
                                        ? dict.tech.requirements_all_done
                                        : dict.tech.requirements_pending.replace("{count}", String(progress.pending))}
                                </p>
                            </div>
                            <strong className="shrink-0 text-xs text-accent">
                                {progress.completed}/{progress.total}
                            </strong>
                        </div>
                        <div
                            className="h-2 overflow-hidden rounded-full bg-[var(--border-soft)]"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={progress.total}
                            aria-valuenow={progress.completed}
                            aria-label={dict.tech.requirements_progress}
                        >
                            <div
                                className="h-full rounded-full bg-accent transition-[width] duration-300"
                                style={{ width: `${progress.percentage}%` }}
                            />
                        </div>
                    </section>

                    <nav aria-label={dict.tech.requirements_categories}>
                        <PremiumTabs
                            activeTab={activeCategory}
                            onChange={setActiveCategory}
                            className="rounded-xl"
                            tabs={CATEGORIES.map(cat => {
                            const itemsInCategory = checklist.filter(item => getCategoryForItem(item.question) === cat);
                            const completed = itemsInCategory.filter(item => item.answer !== null).length;
                            const label = cat === "General"
                                ? dict.tech.category_general
                                : cat === "Baño"
                                    ? dict.tech.category_bathroom
                                    : dict.tech.category_kitchen;

                            return {
                                id: cat,
                                label: `${label} ${completed}/${itemsInCategory.length}`,
                            };
                        })}
                        />
                    </nav>

                    {isCurrentTaskSessionActive && (
                        <details className="group rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/35">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-black marker:hidden">
                                <span className="flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-accent" />
                                    {dict.tech.add_checklist_item}
                                </span>
                                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                            </summary>
                            <form onSubmit={onAddChecklistItem} className="grid gap-2 border-t border-[var(--border-soft)] p-3 sm:grid-cols-[1fr_11rem_auto]">
                                <input
                                    type="text"
                                    name="question"
                                    placeholder={dict.tech.checklist_item_placeholder}
                                    required
                                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                                />
                                <select
                                    name="assignee_id"
                                    defaultValue=""
                                    required
                                    aria-label={dict.tech.assign_to_placeholder}
                                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                                >
                                    <option value="" disabled>{dict.tech.assign_to_placeholder}</option>
                                    {availableAssignees.map(user => (
                                        <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                                    ))}
                                </select>
                                <Button type="submit" className="min-h-11 rounded-lg bg-accent px-4 text-xs font-black text-white hover:bg-accent-light">
                                    {dict.tech.btn_add}
                                </Button>
                            </form>
                        </details>
                    )}

                    <section aria-label={dict.tech.requirements_list} className="space-y-3">
                        {categoryItems.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-primary)]/5 px-4 py-10 text-center text-sm font-semibold text-[var(--text-muted)]">
                                {hideCompleted ? dict.tech.requirements_hidden_done : dict.tech.requirements_empty}
                            </div>
                        ) : (
                            categoryItems.map((item, index) => {
                                const isExpanded = expandedItem === item.id;
                                const isAnswered = item.answer !== null;
                                return (
                                    <article
                                        id={`checklist-requirement-${item.id}`}
                                        key={item.id}
                                        tabIndex={-1}
                                        className={`scroll-mt-24 rounded-xl border p-3 outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent ${
                                            isAnswered
                                                ? "border-accent/30 bg-accent/[0.04]"
                                                : "border-[var(--border-soft)] bg-[var(--bg-card)] shadow-sm"
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                                                isAnswered ? "bg-accent text-white" : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                                            }`}>
                                                {isAnswered ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="min-w-0 flex-1 text-xs font-black leading-snug text-[var(--text-main)] sm:text-sm">
                                                        {(dict.tech.checklist as Record<string, string>)?.[item.id] || item.question}
                                                    </p>
                                                    {item.assignedUserId && (
                                                        <p className="inline-flex max-w-[45%] shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-accent sm:text-[9px]">
                                                            <span className="truncate">{dict.tech.requirements_assign_to} {item.assignedUserName || `ID: ${item.assignedUserId}`}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <fieldset className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-3">
                                            <legend className="sr-only">{dict.tech.requirements_answer}</legend>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    aria-pressed={item.answer === "yes"}
                                                    onClick={() => onAnswer(item.id, "yes")}
                                                    className={`min-h-9 min-w-16 rounded-full border px-3 text-[10px] font-black transition-colors ${
                                                        item.answer === "yes"
                                                            ? "border-accent bg-accent text-white shadow-sm"
                                                            : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-main)] hover:border-accent/50"
                                                    }`}
                                                >
                                                    {dict.tech.yes_label}
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-pressed={item.answer === "no"}
                                                    onClick={() => onAnswer(item.id, "no")}
                                                    className={`min-h-9 min-w-16 rounded-full border px-3 text-[10px] font-black transition-colors ${
                                                        item.answer === "no"
                                                            ? "border-red-600 bg-red-600 text-white shadow-sm"
                                                            : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-main)] hover:border-red-500/50"
                                                    }`}
                                                >
                                                    {dict.tech.no_label}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label
                                                    title={dict.tech.btn_upload_photo}
                                                    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-colors ${
                                                        item.photoAttached
                                                            ? "border-accent bg-accent/10 text-accent"
                                                            : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-main)] shadow-sm hover:border-accent/50"
                                                    }`}
                                                >
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        aria-label={dict.tech.btn_upload_photo}
                                                        className="hidden"
                                                        disabled={uploadingChecklistItem === item.id}
                                                        onChange={event => onChecklistPhoto(item.id, event)}
                                                    />
                                                    <span className="flex h-full w-full items-center justify-center">
                                                        <Camera className="block h-4 w-4 shrink-0" />
                                                    </span>
                                                </label>
                                                <button
                                                    type="button"
                                                    title={dict.tech.btn_add_note}
                                                    aria-label={dict.tech.btn_add_note}
                                                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                                    aria-expanded={isExpanded}
                                                    className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                                                        item.note
                                                            ? "border-accent bg-accent/10 text-accent"
                                                            : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-main)] shadow-sm hover:border-accent/50"
                                                    }`}
                                                >
                                                    <Pencil className="block h-4 w-4 shrink-0" />
                                                </button>
                                            </div>
                                        </fieldset>

                                        {isExpanded && (
                                            <div className="mt-3 space-y-2 border-t border-dashed border-[var(--border-soft)] pt-3">
                                                <label htmlFor={`tech-checklist-note-${item.id}`} className="text-xs font-black text-[var(--text-muted)]">
                                                    {dict.tech.ops_notes_label}
                                                </label>
                                                <textarea
                                                    id={`tech-checklist-note-${item.id}`}
                                                    value={item.note}
                                                    onChange={event => onNoteChange(item.id, event.target.value)}
                                                    onBlur={event => onPersistNote(item.id, event.target.value)}
                                                    placeholder={dict.tech.notes_placeholder}
                                                    rows={3}
                                                    className="w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                                                />
                                            </div>
                                        )}
                                    </article>
                                );
                            })
                        )}
                    </section>

                    <button
                        type="button"
                        onClick={onResetChecklist}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-wide text-[var(--btn-cancel-text)] transition-colors hover:bg-red-500/5"
                    >
                        <RotateCcw className="h-4 w-4" />
                        {dict.tech.reset_checklist}
                    </button>
                </main>

                <footer className="sticky bottom-0 z-30 flex items-center gap-2 border-t border-[var(--border-soft)] bg-[var(--bg-card)]/80 px-3 py-2.5 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:px-5">
                    <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-1 text-[10px] font-black uppercase leading-none tracking-wide text-[var(--text-muted)] sm:text-xs">
                        <input
                            type="checkbox"
                            checked={hideCompleted}
                            onChange={event => setHideCompleted(event.target.checked)}
                            className="!m-0 !h-5 !min-h-0 !w-5 shrink-0 self-center cursor-pointer rounded border-[var(--border-color)] accent-accent"
                        />
                        <span className="truncate">{dict.tech.hide_completed}</span>
                    </label>
                    <Button
                        type="button"
                        onClick={goToFirstPending}
                        disabled={!firstPendingItem}
                        className="min-h-11 shrink-0 rounded-xl bg-accent px-3 text-[10px] font-black text-white hover:bg-accent-light disabled:bg-emerald-600 disabled:opacity-100 sm:px-4 sm:text-xs"
                    >
                        {firstPendingItem ? dict.tech.requirements_next_pending : dict.tech.requirements_all_done}
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
}
