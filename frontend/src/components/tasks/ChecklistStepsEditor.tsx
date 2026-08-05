"use client";

import React from "react";
import { ListTodo, Plus, Trash2 } from "lucide-react";

import { createEditableLineKey } from "@/lib/editable-line-key";
import {
    parseChecklistStepTexts,
    serializeChecklistSteps,
} from "@/lib/checklist-steps";

type EditableChecklistStep = {
    id: string;
    text: string;
};

function buildSteps(description: string): EditableChecklistStep[] {
    return parseChecklistStepTexts(description).map((text) => ({
        id: createEditableLineKey("checklist-step"),
        text,
    }));
}

interface ChecklistStepsEditorProps {
    description: string;
    onChange: (description: string) => void;
    contextKey?: string | number;
    label?: string;
    helpText?: string;
    addLabel?: string;
    emptyText?: string;
}

/** A human editor for task steps. Markdown remains an internal storage format. */
export function ChecklistStepsEditor({
    description,
    onChange,
    contextKey,
    label = "Pasos de la tarea",
    helpText,
    addLabel = "Añadir paso",
    emptyText = "Aún no hay pasos. Añade el primero si esta tarea los requiere.",
}: ChecklistStepsEditorProps) {
    const [steps, setSteps] = React.useState(() => buildSteps(description));
    const lastEmittedDescription = React.useRef(description);
    const lastContextKey = React.useRef(contextKey);

    React.useEffect(() => {
        // Keep local editing state when this component itself emits an empty row.
        // Only replace it when a parent loads a different template/task description.
        if (description === lastEmittedDescription.current && contextKey === lastContextKey.current) return;
        lastEmittedDescription.current = description;
        lastContextKey.current = contextKey;
        setSteps(buildSteps(description));
    }, [contextKey, description]);

    const updateSteps = (nextSteps: EditableChecklistStep[]) => {
        const nextDescription = serializeChecklistSteps(nextSteps);
        setSteps(nextSteps);
        lastEmittedDescription.current = nextDescription;
        onChange(nextDescription);
    };

    return (
        <section className="space-y-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/20 p-3.5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="flex items-center gap-2 text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        <ListTodo className="h-4 w-4 text-accent" />
                        {label}
                    </p>
                    {helpText && <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{helpText}</p>}
                </div>
                <button
                    type="button"
                    onClick={() => updateSteps([...steps, { id: createEditableLineKey("checklist-step"), text: "" }])}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/10 px-2.5 py-2 text-xs font-bold text-accent ui-motion hover:bg-accent hover:text-white"
                >
                    <Plus className="h-3.5 w-3.5" />
                    {addLabel}
                </button>
            </div>

            {steps.length ? (
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {steps.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-black text-white">
                                {index + 1}
                            </span>
                            <label className="sr-only" htmlFor={`checklist-step-${step.id}`}>
                                {label} {index + 1}
                            </label>
                            <input
                                id={`checklist-step-${step.id}`}
                                type="text"
                                value={step.text}
                                onChange={(event) => {
                                    const nextSteps = [...steps];
                                    nextSteps[index] = { ...step, text: event.target.value };
                                    updateSteps(nextSteps);
                                }}
                                placeholder="Describe un paso concreto"
                                className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-main)] outline-none focus:border-accent"
                            />
                            <button
                                type="button"
                                onClick={() => updateSteps(steps.filter((item) => item.id !== step.id))}
                                aria-label={`Eliminar paso ${index + 1}`}
                                className="shrink-0 rounded-xl p-2 text-[var(--btn-cancel-text)] ui-motion hover:bg-[var(--btn-cancel-bg)]"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-card)]/40 px-3 py-4 text-center text-xs font-medium text-[var(--text-muted)]">
                    {emptyText}
                </p>
            )}
        </section>
    );
}
