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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
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
    onAddChecklistItem: (question: string, assigneeId: number) => Promise<boolean>;
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
    const [newChecklistQuestion, setNewChecklistQuestion] = React.useState("");
    const [newChecklistAssigneeId, setNewChecklistAssigneeId] = React.useState("");

    const addChecklistItem = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const added = await onAddChecklistItem(newChecklistQuestion, Number(newChecklistAssigneeId));
        if (!added) return;
        setNewChecklistQuestion("");
        setNewChecklistAssigneeId("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                overlayClassName="dialog-glass-overlay"
                className={cn(
                    // Do not add `relative` here: cn/tailwind-merge would override DialogContent's
                    // required `fixed` positioning and the modal would not appear on screen.
                    "flex h-[min(92dvh,760px)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-[28px] border-[var(--border-soft)] p-0",
                    scrollHide,
                )}
            >
                <DialogHeader className="shrink-0 space-y-1 border-b border-[var(--border-soft)] px-4 py-3 pr-14 text-left sm:px-5 sm:pr-16">
                    <DialogTitle className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-[var(--text-main)] sm:text-lg">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]">
                            <ClipboardCheck className="h-4 w-4" />
                        </span>
                        {dict.tech.requirements_title}
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-5 text-[var(--text-muted)] sm:text-sm">
                        {dict.tech.requirements_subtitle}
                    </DialogDescription>
                </DialogHeader>

                <main className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-5", scrollHide)}>
                    <section
                        aria-labelledby="checklist-progress-title"
                        className="billing-block relative overflow-hidden rounded-2xl px-3.5 py-3"
                    >
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p id="checklist-progress-title" className="text-sm font-semibold text-[var(--text-main)]">
                                    {dict.tech.requirements_progress}
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--text-muted)]" aria-live="polite">
                                    {progress.pending === 0
                                        ? dict.tech.requirements_all_done
                                        : dict.tech.requirements_pending.replace("{count}", String(progress.pending))}
                                </p>
                            </div>
                            <strong className="shrink-0 text-sm font-semibold tabular-nums text-accent">
                                {progress.completed}/{progress.total}
                            </strong>
                        </div>
                        <div
                            className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border-soft)_80%,transparent)]"
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
                        <details className="billing-block group overflow-hidden rounded-2xl">
                            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-semibold text-[var(--text-main)] marker:hidden">
                                <span className="flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-accent" />
                                    {dict.tech.add_checklist_item}
                                </span>
                                <ChevronDown className="h-4 w-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
                            </summary>
                            <form
                                onSubmit={addChecklistItem}
                                className="grid gap-2 border-t border-[var(--border-soft)] p-3.5 sm:grid-cols-[1fr_11rem_auto]"
                            >
                                <Label htmlFor="new-checklist-question" className="sr-only">
                                    {dict.tech.checklist_item_placeholder}
                                </Label>
                                <Input
                                    id="new-checklist-question"
                                    type="text"
                                    value={newChecklistQuestion}
                                    onChange={event => setNewChecklistQuestion(event.target.value)}
                                    placeholder={dict.tech.checklist_item_placeholder}
                                    required
                                    className="h-10 text-xs"
                                />
                                <Select value={newChecklistAssigneeId} onValueChange={setNewChecklistAssigneeId}>
                                    <SelectTrigger aria-label={dict.tech.assign_to_placeholder} className="h-10 text-xs">
                                        <SelectValue placeholder={dict.tech.assign_to_placeholder} />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {availableAssignees.map(user => (
                                        <SelectItem key={user.id} value={String(user.id)}>{user.full_name || user.email}</SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="submit"
                                    className="min-h-10 border-none bg-accent px-4 text-xs font-semibold text-white shadow-sm hover:bg-accent-light hover:shadow-sm"
                                >
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

                    <Button
                        type="button"
                        variant="cancel"
                        onClick={onResetChecklist}
                        className="w-full"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {dict.tech.reset_checklist}
                    </Button>
                </main>

                <footer className="dialog-glass-chrome flex shrink-0 items-center gap-3 border-t border-[var(--border-soft)] px-3 py-3 sm:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Checkbox
                            id="checklist-hide-completed"
                            checked={hideCompleted}
                            onCheckedChange={checked => setHideCompleted(checked === true)}
                            aria-label={dict.tech.hide_completed}
                            className="border-[var(--dialog-control-border)] bg-[var(--dialog-control-bg)] shadow-sm data-[state=unchecked]:border-[var(--border-color)]"
                        />
                        <Label
                            htmlFor="checklist-hide-completed"
                            className="cursor-pointer truncate text-xs font-medium text-[var(--text-muted)]"
                        >
                            {dict.tech.hide_completed}
                        </Label>
                    </div>
                    <Button
                        type="button"
                        onClick={goToFirstPending}
                        disabled={!firstPendingItem}
                        className={cn(
                            "min-h-10 shrink-0 border-none px-3.5 text-xs font-semibold shadow-sm hover:shadow-sm sm:px-4",
                            firstPendingItem
                                ? "bg-accent text-white hover:bg-accent-light"
                                : "bg-accent text-white hover:bg-accent-light disabled:opacity-100",
                        )}
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
                <div className="billing-block rounded-2xl px-4 py-8 text-center text-sm font-medium text-[var(--text-muted)]">
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
            className={cn(
                "billing-block scroll-mt-24 rounded-2xl px-3.5 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                answered && "ring-1 ring-accent/20",
            )}
        >
            <div className="flex items-start gap-2.5">
                <span
                    className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold",
                        answered
                            ? "bg-accent text-white"
                            : "bg-[color-mix(in_srgb,var(--bg-secondary)_70%,transparent)] text-[var(--text-muted)]",
                    )}
                >
                    {answered ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[var(--text-main)]">
                            {label}
                        </p>
                        {item.assignedUserId && (
                            <Badge
                                variant="secondary"
                                className="max-w-[45%] truncate border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
                            >
                                <span className="truncate">
                                    {dict.tech.requirements_assign_to}{" "}
                                    {item.assignedUserName || `ID: ${item.assignedUserId}`}
                                </span>
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            <fieldset className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2.5">
                <legend className="sr-only">{dict.tech.requirements_answer}</legend>
                <div className="flex items-center gap-1.5">
                    <ChecklistAnswerButton
                        active={item.answer === "yes"}
                        label={dict.tech.yes_label}
                        onClick={() => onAnswer(item.id, "yes")}
                    />
                    <ChecklistAnswerButton
                        active={item.answer === "no"}
                        danger
                        label={dict.tech.no_label}
                        onClick={() => onAnswer(item.id, "no")}
                    />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Input
                        id={photoInputId}
                        type="file"
                        accept="image/*"
                        aria-label={dict.tech.btn_upload_photo}
                        className="hidden"
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
                    <Label
                        htmlFor={`tech-checklist-note-${item.id}`}
                        className="text-[11px] font-medium text-[var(--text-muted)]"
                    >
                        {dict.tech.ops_notes_label}
                    </Label>
                    <Textarea
                        id={`tech-checklist-note-${item.id}`}
                        value={item.note}
                        onChange={event => onNoteChange(item.id, event.target.value)}
                        onBlur={event => onPersistNote(item.id, event.target.value)}
                        placeholder={dict.tech.notes_placeholder}
                        rows={2}
                        className="min-h-16 resize-none text-xs"
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
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                "min-h-8 min-w-14 rounded-lg border-none px-3 text-[11px] font-semibold shadow-sm transition-colors",
                active
                    ? danger
                        ? "bg-[var(--btn-cancel-hover-bg)] text-[var(--btn-cancel-hover-text)]"
                        : "bg-accent text-white"
                    : "bg-[var(--bg-secondary)] text-[var(--text-main)] hover:bg-[var(--bg-secondary)]/80",
            )}
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
            className={cn(
                "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors",
                "border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]",
                "hover:border-[var(--btn-select-border)] hover:bg-[var(--btn-select-bg)] hover:text-[var(--btn-select-text)]",
                active && "border-[var(--btn-select-border)] bg-[var(--btn-select-bg)] text-[var(--btn-select-text)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
            )}
        >
            {icon}
        </button>
    );
}
