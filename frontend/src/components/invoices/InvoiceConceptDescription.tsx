"use client";

import { useState } from "react";
import { parseInvoiceConceptDescription } from "@/lib/task-invoice-billing";

type InvoiceConceptDescriptionFieldProps = {
    id: string;
    value: string;
    placeholder?: string;
    label: string;
    onChange: (value: string) => void;
};

export function InvoiceConceptDescriptionField({
    id,
    value,
    placeholder,
    label,
    onChange,
}: InvoiceConceptDescriptionFieldProps) {
    const [editing, setEditing] = useState(false);
    const parts = parseInvoiceConceptDescription(value);
    const lineCount = Math.max(3, Math.min(7, value.split("\n").length + 1));

    if (editing || !parts.title) {
        return (
            <div className="space-y-1.5">
                <label className="sr-only" htmlFor={id}>{label}</label>
                <textarea
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    rows={lineCount}
                    className="w-full resize-y rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2.5 py-2 text-xs leading-relaxed text-[var(--text-main)] outline-none focus:border-accent"
                    placeholder={placeholder}
                    required
                    autoFocus={editing}
                />
                {editing && (
                    <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="text-3xs font-semibold text-accent hover:underline"
                    >
                        Listo
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <div className="rounded-xl border border-transparent px-0.5 py-0.5">
                <p className="text-sm font-semibold leading-5 text-[var(--text-main)]">
                    {parts.title}
                </p>
                {parts.meta && (
                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                        {parts.meta}
                    </p>
                )}
                {parts.details.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--border-soft)] pt-2">
                        {parts.details.map((line) => {
                            const isTeamTime = /^tiempo del equipo:/i.test(line);
                            const isCharge = /^cobro:/i.test(line);
                            return (
                                <p
                                    key={line}
                                    className={
                                        isTeamTime || isCharge
                                            ? "text-[11px] font-semibold text-[var(--text-main)]"
                                            : "text-[11px] leading-4 text-[var(--text-muted)]"
                                    }
                                >
                                    {line}
                                </p>
                            );
                        })}
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-3xs font-semibold text-accent hover:underline"
            >
                Editar texto
            </button>
        </div>
    );
}

type InvoiceConceptDescriptionViewProps = {
    description: string;
};

export function InvoiceConceptDescriptionView({
    description,
}: InvoiceConceptDescriptionViewProps) {
    const parts = parseInvoiceConceptDescription(description);
    if (!parts.title) {
        return <span className="whitespace-pre-line">{description}</span>;
    }

    return (
        <div className="space-y-1">
            <p className="text-[12px] font-semibold leading-5 text-[var(--text-main)] print:text-black">
                {parts.title}
            </p>
            {parts.meta && (
                <p className="text-[11px] font-medium text-[var(--text-muted)] print:text-neutral-600">
                    {parts.meta}
                </p>
            )}
            {parts.details.length > 0 && (
                <div className="space-y-0.5 pt-1">
                    {parts.details.map((line) => (
                        <p
                            key={line}
                            className="text-[11px] leading-4 text-[var(--text-muted)] print:text-neutral-700"
                        >
                            {line}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}
