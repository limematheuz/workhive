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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { User } from "@/types/user";
import {
    Dialog,
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

const scrollHide =
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

function useTechTaskChecklistDialogState(props: TechTaskChecklistDialogProps) {
    const {
        checklist,
        categoryItems,
        getCategoryForItem,
        setActiveCategory,
        setHideCompleted,
    } = props;
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

    return { firstPendingItem, goToFirstPending, progress };
}

export function TechTaskChecklistDialog(props: TechTaskChecklistDialogProps) {
    const state = useTechTaskChecklistDialogState(props);
    return <TechTaskChecklistDialogContent {...props} {...state} />;
}

function TechTaskChecklistDialogContent({
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
    firstPendingItem,
    goToFirstPending,
    progress,
}: TechTaskChecklistDialogProps & ReturnType<typeof useTechTaskChecklistDialogState>) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                overlayClassName="dialog-glass-overlay"
                className={`flex h-[min(92dvh,760px)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-3xl p-0 ${scrollHide}`}
            >
                <DialogHeader className="shrink-0 space-y-1 border-b border-[var(--border-soft)] px-4 py-3 pr-14 text-left sm:px-5 sm:pr-16">
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <ClipboardCheck className="h-4 w-4" />
                        </span>
                        {dict.tech.requirements_title}
                    </DialogTitle>
                    <DialogDescription className="text-[11px] sm:text-xs">
                        {dict.tech.requirements_subtitle}
                    </DialogDescription>
                </DialogHeader>

                <main className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-5 ${scrollHide}`}>
                    <section
                        aria-labelledby="checklist-progress-title"
                        className="rounded-xl bg-[var(--bg-secondary)]/70 px-3 py-2.5"
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
                            className="h-1.5 overflow-hidden rounded-full bg-[var(--border-soft)]"
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
                        <details className="group rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/40">
                            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-black marker:hidden">
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
                                    className="min-h-10 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-accent"
                                />
                                <select
                                    name="assignee_id"
                                    defaultValue=""
                                    required
                                    aria-label={dict.tech.assign_to_placeholder}
                                    className="min-h-10 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-accent"
                                >
                                    <option value="" disabled>{dict.tech.assign_to_placeholder}</option>
                                    {availableAssignees.map(user => (
                                        <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                                    ))}
                                </select>
                                <Button type="submit" className="min-h-10 rounded-lg bg-accent px-4 text-xs font-black text-white hover:bg-accent-light">
                                    {dict.tech.btn_add}
                                </Button>
                            </form>
                        </details>
                    )}

                    <ChecklistRequirementsList
                        categoryItems={categoryItems}
                        dict={dict}
                        expandedItem={expandedItem}
                        hideCompleted={hideCompleted}
                        onAnswer={onAnswer}
                        onChecklistPhoto={onChecklistPhoto}
                        onNoteChange={onNoteChange}
                        onPersistNote={onPersistNote}
                        setExpandedItem={setExpandedItem}
                        uploadingChecklistItem={uploadingChecklistItem}
                    />

                    <button
                        type="button"
                        onClick={onResetChecklist}
                        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-wide text-[var(--btn-cancel-text)] transition-colors hover:bg-red-500/5"
                    >
                        <RotateCcw className="h-4 w-4" />
                        {dict.tech.reset_checklist}
                    </button>
                </main>

                <footer className="dialog-glass-chrome flex shrink-0 items-center gap-2 border-t border-[var(--border-soft)] px-3 py-2.5 sm:px-5">
                    <label className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-1 text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)] sm:text-xs">
                        <input
                            type="checkbox"
                            checked={hideCompleted}
                            onChange={event => setHideCompleted(event.target.checked)}
                            className="!m-0 !h-4 !min-h-0 !w-4 shrink-0 cursor-pointer rounded border-[var(--border-color)] accent-accent"
                        />
                        <span className="truncate">{dict.tech.hide_completed}</span>
                    </label>
                    <Button
                        type="button"
                        onClick={goToFirstPending}
                        disabled={!firstPendingItem}
                        className="min-h-10 shrink-0 rounded-xl bg-accent px-3 text-[10px] font-black text-white hover:bg-accent-light disabled:bg-emerald-600 disabled:opacity-100 sm:px-4 sm:text-xs"
                    >
                        {firstPendingItem ? dict.tech.requirements_next_pending : dict.tech.requirements_all_done}
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
}

interface ChecklistRequirementsListProps {
    categoryItems: ChecklistItem[];
    dict: Dictionary;
    expandedItem: string | null;
    hideCompleted: boolean;
    onAnswer: (itemId: string, answer: "yes" | "no") => Promise<void>;
    onChecklistPhoto: (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    onNoteChange: (itemId: string, note: string) => void;
    onPersistNote: (itemId: string, note: string) => Promise<void>;
    setExpandedItem: React.Dispatch<React.SetStateAction<string | null>>;
    uploadingChecklistItem: string | null;
}

function ChecklistRequirementsList({
    categoryItems,
    dict,
    expandedItem,
    hideCompleted,
    onAnswer,
    onChecklistPhoto,
    onNoteChange,
    onPersistNote,
    setExpandedItem,
    uploadingChecklistItem,
}: ChecklistRequirementsListProps) {
    return (
        <section aria-label={dict.tech.requirements_list} className="space-y-2">
            {categoryItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-soft)] px-4 py-8 text-center text-sm font-semibold text-[var(--text-muted)]">
                    {hideCompleted ? dict.tech.requirements_hidden_done : dict.tech.requirements_empty}
                </div>
            ) : (
                categoryItems.map((item, index) => (
                    <ChecklistRequirementItem
                        key={item.id}
                        dict={dict}
                        expanded={expandedItem === item.id}
                        index={index}
                        item={item}
                        onAnswer={onAnswer}
                        onChecklistPhoto={onChecklistPhoto}
                        onNoteChange={onNoteChange}
                        onPersistNote={onPersistNote}
                        onToggleNote={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                        uploading={uploadingChecklistItem === item.id}
                    />
                ))
            )}
        </section>
    );
}

interface ChecklistRequirementItemProps {
    dict: Dictionary;
    expanded: boolean;
    index: number;
    item: ChecklistItem;
    onAnswer: ChecklistRequirementsListProps["onAnswer"];
    onChecklistPhoto: ChecklistRequirementsListProps["onChecklistPhoto"];
    onNoteChange: ChecklistRequirementsListProps["onNoteChange"];
    onPersistNote: ChecklistRequirementsListProps["onPersistNote"];
    onToggleNote: () => void;
    uploading: boolean;
}

function ChecklistRequirementItem({
    dict,
    expanded,
    index,
    item,
    onAnswer,
    onChecklistPhoto,
    onNoteChange,
    onPersistNote,
    onToggleNote,
    uploading,
}: ChecklistRequirementItemProps) {
    const answered = item.answer !== null;
    const label = (dict.tech.checklist as Record<string, string>)?.[item.id] || item.question;
    const photoInputId = `tech-checklist-photo-${item.id}`;

    return (
        <article
            id={`checklist-requirement-${item.id}`}
            tabIndex={-1}
            className={`scroll-mt-24 rounded-xl border px-3 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                answered ? "border-accent/25 bg-accent/[0.04]" : "border-[var(--border-soft)] bg-[var(--bg-card)]"
            }`}
        >
            <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    answered ? "bg-accent text-white" : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                }`}>
                    {answered ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-[var(--text-main)]">{label}</p>
                        {item.assignedUserId && (
                            <p className="inline-flex max-w-[45%] shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-accent">
                                <span className="truncate">
                                    {dict.tech.requirements_assign_to} {item.assignedUserName || `ID: ${item.assignedUserId}`}
                                </span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <fieldset className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2.5">
                <legend className="sr-only">{dict.tech.requirements_answer}</legend>
                <div className="flex items-center gap-1.5">
                    <ChecklistAnswerButton active={item.answer === "yes"} label={dict.tech.yes_label} onClick={() => onAnswer(item.id, "yes")} />
                    <ChecklistAnswerButton active={item.answer === "no"} danger label={dict.tech.no_label} onClick={() => onAnswer(item.id, "no")} />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <input
                        id={photoInputId}
                        type="file"
                        accept="image/*"
                        aria-label={dict.tech.btn_upload_photo}
                        className="sr-only"
                        disabled={uploading}
                        onChange={event => onChecklistPhoto(item.id, event)}
                    />
                    <ChecklistIconButton
                        active={item.photoAttached}
                        ariaLabel={dict.tech.btn_upload_photo}
                        disabled={uploading}
                        icon={<Camera className="h-3.5 w-3.5 shrink-0" />}
                        onClick={() => document.getElementById(photoInputId)?.click()}
                    />
                    <ChecklistIconButton
                        active={Boolean(item.note) || expanded}
                        ariaLabel={dict.tech.btn_add_note}
                        icon={<Pencil className="h-3.5 w-3.5 shrink-0" />}
                        onClick={onToggleNote}
                        expanded={expanded}
                    />
                </div>
            </fieldset>

            {expanded && (
                <div className="mt-2.5 space-y-1.5 border-t border-dashed border-[var(--border-soft)] pt-2.5">
                    <label htmlFor={`tech-checklist-note-${item.id}`} className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                        {dict.tech.ops_notes_label}
                    </label>
                    <textarea
                        id={`tech-checklist-note-${item.id}`}
                        value={item.note}
                        onChange={event => onNoteChange(item.id, event.target.value)}
                        onBlur={event => onPersistNote(item.id, event.target.value)}
                        placeholder={dict.tech.notes_placeholder}
                        rows={2}
                        className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-medium text-[var(--text-main)] outline-none focus:border-accent"
                    />
                </div>
            )}
        </article>
    );
}

function ChecklistAnswerButton({
    active,
    danger = false,
    label,
    onClick,
}: {
    active: boolean;
    danger?: boolean;
    label: string;
    onClick: () => void;
}) {
    const activeClassName = danger ? "border-red-600 bg-red-600 text-white" : "border-accent bg-accent text-white";
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={`min-h-8 min-w-14 rounded-full border px-3 text-[10px] font-black transition-colors ${
                active ? activeClassName : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-main)] hover:bg-[var(--bg-secondary)]/80"
            }`}
        >
            {label}
        </button>
    );
}

function ChecklistIconButton({
    active,
    ariaLabel,
    disabled = false,
    expanded,
    icon,
    onClick,
}: {
    active: boolean;
    ariaLabel: string;
    disabled?: boolean;
    expanded?: boolean;
    icon: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            title={ariaLabel}
            aria-label={ariaLabel}
            aria-expanded={expanded}
            disabled={disabled}
            onClick={onClick}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
        >
            {icon}
        </button>
    );
}
