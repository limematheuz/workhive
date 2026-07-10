"use client";

import React from "react";
import { Loader2, Plus, Trash2, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            <DialogContent className="max-w-md p-0 overflow-hidden bg-[var(--bg-card)] border-[var(--border-soft)]">
                <DialogHeader className="p-6 border-b border-[var(--border-soft)] text-left sm:text-left">
                    <DialogTitle className="text-lg font-black text-[var(--text-main)]">
                        {selectedTemplate ? "Edit service" : "New service"}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-[var(--text-muted)] mt-1 font-semibold">
                        Define the service and the steps the team must complete.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveTemplate} className="p-6 space-y-4 font-sans">
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
                            <div className="flex justify-between items-center">
                                <span className="text-xs uppercase font-bold text-[var(--text-muted)] flex items-center gap-2">
                                    <ListTodo className="w-4 h-4 text-accent" />
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
                                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--btn-secondary-text)] text-xs font-semibold rounded-xl transition-all cursor-pointer border border-[var(--border-soft)]"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add item
                                </button>
                            </div>
                            <div ref={scrollContainerRef} className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                {questions.map((q, idx) => (
                                    <div key={q.id} className="flex gap-2 items-center">
                                        <div className="w-5 h-5 rounded-full bg-black text-[10px] font-black text-white flex items-center justify-center select-none shrink-0">
                                            {idx + 1}
                                        </div>
                                        <input
                                            type="text"
                                            required={idx === 0}
                                            value={q.text}
                                            onChange={(e) => {
                                                const updated = [...questions];
                                                updated[idx] = { ...updated[idx], text: e.target.value };
                                                updateChecklistDescription(updated);
                                            }}
                                            placeholder="e.g.: Clean sink, Check switches..."
                                            className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (questions.length > 1) {
                                                    const updated = questions.filter((_, i) => i !== idx);
                                                    updateChecklistDescription(updated);
                                                } else {
                                                    updateChecklistDescription([createQuestion()]);
                                                }
                                            }}
                                            aria-label={`Remove item ${idx + 1}`}
                                            className="p-2 text-[var(--btn-cancel-text)] hover:text-[var(--btn-cancel-text)] rounded-lg hover:bg-[var(--btn-cancel-bg)] cursor-pointer border-none bg-transparent shrink-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label htmlFor="template-price" className="text-xs uppercase font-bold text-[var(--text-muted)]">{dict.tasks.template_dialog.price_label}</label>
                            <input
                                id="template-price"
                                type="number"
                                step="0.01"
                                value={tmplPrice}
                                onChange={(e) => setTmplPrice(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent font-mono"
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="template-unit" className="text-xs uppercase font-bold text-[var(--text-muted)]">{dict.tasks.template_dialog.unit_label}</label>
                            <select
                                id="template-unit"
                                value={tmplUnit}
                                onChange={(e) => setTmplUnit(e.target.value)}
                                aria-label={dict.tasks.template_dialog.unit_label}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent"
                            >
                                {UNIT_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsTemplateModalOpen(false)}
                            className="bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-4 py-2.5 cursor-pointer transition-all"
                        >
                            {dict.tasks.template_dialog.cancel}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {dict.tasks.template_dialog.saving}
                                </>
                            ) : (
                                selectedTemplate ? "Save changes" : "Create service"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
