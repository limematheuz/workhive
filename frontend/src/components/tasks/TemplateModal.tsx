"use client";

import React from "react";
import { Loader2, Plus, Trash2, ListTodo } from "lucide-react";
import { TemplateTask } from "@/hooks/useTasksPage";
import type { Dictionary } from "@/lib/dictionary-context";
import { createEditableLineKey } from "@/lib/editable-line-key";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    taskDialogBodyClass,
    taskDialogContentClass,
    taskDialogDangerBtnClass,
    taskDialogFooterClass,
    taskDialogHeaderClass,
    taskDialogOverlayClass,
    taskDialogPrimaryBtnClass,
} from "./taskDialogChrome";

const UNIT_OPTIONS = [
    "unit", "hour", "m²", "m³", "ml", "kg", "litre", "service", "day", "week", "month"
];

interface ChecklistQuestion {
    id: string;
    text: string;
}

const createQuestion = (text = ""): ChecklistQuestion => ({
    id: createEditableLineKey("template-question"),
    text,
});

function parseTemplateQuestions(description: string): ChecklistQuestion[] {
    if (!description) return [createQuestion()];

    const lines = description.split("\n");
    const parsedQuestions: string[] = [];

    for (const line of lines) {
        const match = line.match(/^\s*[-*]?\s*\[\s*[xX\s]?\s*\]\s*(.+)$/);
        if (match) {
            parsedQuestions.push(match[1].trim());
        }
    }

    if (parsedQuestions.length > 0) {
        return parsedQuestions.map(createQuestion);
    }

    return [createQuestion(description.trim())];
}

interface TemplateModalProps {
    dict: Dictionary;
    isSaving: boolean;
    isTemplateModalOpen: boolean;
    setIsTemplateModalOpen: (open: boolean) => void;
    selectedTemplate: TemplateTask | null;
    tmplName: string;
    setTmplName: (val: string) => void;
    tmplDescription: string;
    setTmplDescription: (val: string) => void;
    tmplPrice: string;
    setTmplPrice: (val: string) => void;
    tmplUnit: string;
    setTmplUnit: (val: string) => void;
    handleSaveTemplate: (e: React.FormEvent) => void;
}

export function TemplateModal({
    dict,
    isSaving,
    isTemplateModalOpen,
    setIsTemplateModalOpen,
    selectedTemplate,
    tmplName,
    setTmplName,
    tmplDescription,
    setTmplDescription,
    tmplPrice,
    setTmplPrice,
    tmplUnit,
    setTmplUnit,
    handleSaveTemplate,
}: TemplateModalProps) {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const questionContextKey = isTemplateModalOpen
        ? `${selectedTemplate?.id ?? "new"}|${tmplDescription}`
        : "closed";
    const buildQuestionState = React.useCallback(() => ({
        contextKey: questionContextKey,
        questions: parseTemplateQuestions(tmplDescription),
    }), [questionContextKey, tmplDescription]);
    const [questionState, setQuestionState] = React.useState(buildQuestionState);
    const questions = questionState.contextKey === questionContextKey
        ? questionState.questions
        : parseTemplateQuestions(tmplDescription);
    const setQuestions = React.useCallback((nextQuestions: React.SetStateAction<ChecklistQuestion[]>) => {
        setQuestionState((prev) => {
            const current = prev.contextKey === questionContextKey
                ? prev.questions
                : parseTemplateQuestions(tmplDescription);
            const resolved = typeof nextQuestions === "function"
                ? nextQuestions(current)
                : nextQuestions;
            return { contextKey: questionContextKey, questions: resolved };
        });
    }, [questionContextKey, tmplDescription]);

    const updateChecklistDescription = (updatedQuestions: ChecklistQuestion[]) => {
        setQuestions(updatedQuestions);
        const serialized = updatedQuestions
            .flatMap(q => {
                const text = q.text.trim();
                return text !== "" ? [`- [ ] ${text}`] : [];
            })
            .join("\n");
        setTmplDescription(serialized);
    };

    return (
        <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
            <DialogContent
                overlayClassName={taskDialogOverlayClass}
                className={`${taskDialogContentClass} max-h-[min(90vh,720px)] sm:max-w-md`}
            >
                <DialogHeader className={taskDialogHeaderClass}>
                    <DialogTitle className="text-lg font-bold tracking-tight text-[var(--text-main)]">
                        {selectedTemplate ? "Edit service" : "New service"}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                        Define the service and the steps the team must complete.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveTemplate} className="flex min-h-0 flex-1 flex-col font-sans">
                    <div className={taskDialogBodyClass}>
                        <div className="space-y-1">
                            <label htmlFor="template-name" className="text-xs uppercase font-bold text-[var(--text-muted)]">{dict.tasks.template_dialog.name_label}</label>
                            <input
                                id="template-name"
                                type="text"
                                value={tmplName}
                                onChange={(e) => setTmplName(e.target.value)}
                                required
                                placeholder="e.g.: Standard cleaning, Boiler inspection, etc."
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent"
                            />
                        </div>

                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--text-muted)]">
                                    <ListTodo className="h-4 w-4 text-accent" />
                                    Service steps
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        updateChecklistDescription([...questions, createQuestion()]);
                                        setTimeout(() => {
                                            if (scrollContainerRef.current) {
                                                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                                            }
                                        }, 50);
                                    }}
                                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--btn-secondary-bg)] px-3 py-2 text-xs font-semibold text-[var(--btn-secondary-text)] ui-motion hover:bg-[var(--btn-secondary-hover-bg)]"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add item
                                </button>
                            </div>
                            <div ref={scrollContainerRef} className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
                                {questions.map((q, idx) => (
                                    <div key={q.id} className="flex items-center gap-2">
                                        <div className="flex h-5 w-5 shrink-0 select-none items-center justify-center rounded-full bg-[var(--btn-primary-bg)] text-[10px] font-black text-[var(--btn-primary-text)]">
                                            {idx + 1}
                                        </div>
                                        <label className="sr-only" htmlFor={`template-question-${q.id}`}>
                                            Elemento de la lista de comprobación {idx + 1}
                                        </label>
                                        <input
                                            id={`template-question-${q.id}`}
                                            type="text"
                                            required={idx === 0}
                                            value={q.text}
                                            onChange={(e) => {
                                                const updated = [...questions];
                                                updated[idx] = { ...updated[idx], text: e.target.value };
                                                updateChecklistDescription(updated);
                                            }}
                                            placeholder="e.g.: Clean sink, Check switches..."
                                            className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-sm text-[var(--text-main)] outline-none focus:border-accent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (questions.length > 1) {
                                                    updateChecklistDescription(questions.filter((_, i) => i !== idx));
                                                } else {
                                                    updateChecklistDescription([createQuestion()]);
                                                }
                                            }}
                                            aria-label={`Remove item ${idx + 1}`}
                                            className="shrink-0 cursor-pointer rounded-lg border-none bg-transparent p-2 text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-bg)]"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label htmlFor="template-price" className="text-xs font-bold uppercase text-[var(--text-muted)]">{dict.tasks.template_dialog.price_label}</label>
                                <input
                                    id="template-price"
                                    type="number"
                                    step="0.01"
                                    value={tmplPrice}
                                    onChange={(e) => setTmplPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2.5 font-mono text-sm text-[var(--text-main)] outline-none focus:border-accent"
                                />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="template-unit" className="text-xs font-bold uppercase text-[var(--text-muted)]">{dict.tasks.template_dialog.unit_label}</label>
                                <select
                                    id="template-unit"
                                    value={tmplUnit}
                                    onChange={(e) => setTmplUnit(e.target.value)}
                                    aria-label={dict.tasks.template_dialog.unit_label}
                                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-sm text-[var(--text-main)] outline-none focus:border-accent"
                                >
                                    {UNIT_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className={`${taskDialogFooterClass} justify-end`}>
                        <button
                            type="button"
                            onClick={() => setIsTemplateModalOpen(false)}
                            className={taskDialogDangerBtnClass}
                        >
                            {dict.tasks.template_dialog.cancel}
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className={taskDialogPrimaryBtnClass}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {dict.tasks.template_dialog.saving}
                                </>
                            ) : (
                                selectedTemplate ? "Save changes" : "Create service"
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
