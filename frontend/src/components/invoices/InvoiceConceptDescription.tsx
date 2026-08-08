"use client";

import { useEffect, useMemo, useState } from "react";
import {
    composeInvoiceConceptDescription,
    parseInvoiceConceptDescription,
    type InvoiceConceptDescriptionParts,
} from "@/lib/task-invoice-billing";

type InvoiceConceptDescriptionFieldProps = {
    id: string;
    value: string;
    placeholder?: string;
    label: string;
    onChange: (value: string) => void;
};

function WorkerChip({ name, time }: { name: string; time: string }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-main)]">
            <span className="max-w-[7rem] truncate">{name}</span>
            <span className="font-mono text-[var(--text-muted)]">{time}</span>
        </span>
    );
}

function emptyParts(title = ""): InvoiceConceptDescriptionParts {
    return {
        title,
        location: null,
        date: null,
        teamTime: null,
        workers: [],
        charge: null,
        extras: [],
    };
}

export function InvoiceConceptDescriptionField({
    id,
    value,
    placeholder,
    label,
    onChange,
}: InvoiceConceptDescriptionFieldProps) {
    const parsed = useMemo(() => parseInvoiceConceptDescription(value), [value]);
    const isStructured = Boolean(
        parsed.title && (parsed.location || parsed.date || parsed.teamTime || parsed.workers.length),
    );
    const [editing, setEditing] = useState(!isStructured);
    const [draft, setDraft] = useState<InvoiceConceptDescriptionParts>(
        parsed.title ? parsed : emptyParts(value),
    );
    const [workersText, setWorkersText] = useState(
        (parsed.title ? parsed.workers : [])
            .map((worker) => `${worker.name}: ${worker.time}`)
            .join("\n"),
    );

    useEffect(() => {
        if (editing) return;
        setDraft(parsed.title ? parsed : emptyParts(value));
        setWorkersText(
            (parsed.title ? parsed.workers : [])
                .map((worker) => `${worker.name}: ${worker.time}`)
                .join("\n"),
        );
    }, [editing, parsed, value]);

    const publish = (next: InvoiceConceptDescriptionParts, nextWorkersText = workersText) => {
        const workers = nextWorkersText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [name, ...rest] = line.split(":");
                return {
                    name: (name || "").trim(),
                    time: rest.join(":").trim() || "0m",
                };
            });
        const composed = composeInvoiceConceptDescription({ ...next, workers });
        setDraft({ ...next, workers });
        onChange(composed);
    };

    if (editing) {
        return (
            <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6.5rem]">
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-title`}>
                            {label}
                        </label>
                        <input
                            id={`${id}-title`}
                            value={draft.title}
                            onChange={(event) => {
                                const next = { ...draft, title: event.target.value };
                                setDraft(next);
                                publish(next);
                            }}
                            placeholder={placeholder || "Servicio"}
                            required
                            autoFocus
                            className="h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 text-xs font-semibold text-[var(--text-main)] outline-none focus:border-accent"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-location`}>
                            Ubicación
                        </label>
                        <input
                            id={`${id}-location`}
                            value={draft.location || ""}
                            onChange={(event) => {
                                const next = { ...draft, location: event.target.value };
                                setDraft(next);
                                publish(next);
                            }}
                            placeholder="Casa / local"
                            className="h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 text-xs text-[var(--text-main)] outline-none focus:border-accent"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-date`}>
                            Fecha
                        </label>
                        <input
                            id={`${id}-date`}
                            value={draft.date || ""}
                            onChange={(event) => {
                                const next = { ...draft, date: event.target.value };
                                setDraft(next);
                                publish(next);
                            }}
                            placeholder="dd/mm/aaaa"
                            className="h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 font-mono text-xs text-[var(--text-main)] outline-none focus:border-accent"
                        />
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-team`}>
                            Tiempo equipo
                        </label>
                        <input
                            id={`${id}-team`}
                            value={draft.teamTime || ""}
                            onChange={(event) => {
                                const next = { ...draft, teamTime: event.target.value };
                                setDraft(next);
                                publish(next);
                            }}
                            placeholder="1h 30m"
                            className="h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 font-mono text-xs text-[var(--text-main)] outline-none focus:border-accent"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-workers`}>
                            Equipo (Nombre: tiempo)
                        </label>
                        <textarea
                            id={`${id}-workers`}
                            value={workersText}
                            onChange={(event) => {
                                setWorkersText(event.target.value);
                                publish(draft, event.target.value);
                            }}
                            rows={Math.max(2, Math.min(4, workersText.split("\n").length || 2))}
                            className="w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 py-1.5 font-mono text-[11px] leading-5 text-[var(--text-main)] outline-none focus:border-accent"
                            placeholder={"Andrea: 1h 2m\nOwnet: 8m"}
                        />
                    </div>
                </div>

                {isStructured && (
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
        <div className="min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-5 text-[var(--text-main)]">
                        {parsed.title}
                    </p>
                    {parsed.location && (
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                            {parsed.location}
                        </p>
                    )}
                </div>
                {parsed.date && (
                    <span className="shrink-0 rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-muted)]">
                        {parsed.date}
                    </span>
                )}
            </div>

            {(parsed.teamTime || parsed.workers.length > 0 || parsed.charge) && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {parsed.teamTime && (
                        <span className="inline-flex items-center rounded-md border border-[var(--border-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-main)]">
                            Equipo {parsed.teamTime}
                        </span>
                    )}
                    {parsed.workers.filter((worker) => worker.time !== "0m").map((worker) => (
                        <WorkerChip key={`${worker.name}-${worker.time}`} name={worker.name} time={worker.time} />
                    ))}
                    {parsed.charge && (
                        <span className="inline-flex items-center rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                            {parsed.charge}
                        </span>
                    )}
                </div>
            )}

            {parsed.extras.length > 0 && (
                <p className="text-[11px] text-[var(--text-muted)]">
                    {parsed.extras.join(" · ")}
                </p>
            )}

            <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-3xs font-semibold text-accent hover:underline"
            >
                Editar
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
        <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-5 text-[var(--text-main)] print:text-black">
                        {parts.title}
                    </p>
                    {parts.location && (
                        <p className="text-[11px] text-[var(--text-muted)] print:text-neutral-600">
                            {parts.location}
                        </p>
                    )}
                </div>
                {parts.date && (
                    <span className="shrink-0 font-mono text-[10px] font-semibold text-[var(--text-muted)] print:text-neutral-600">
                        {parts.date}
                    </span>
                )}
            </div>
            {(parts.teamTime || parts.workers.length > 0) && (
                <div className="space-y-0.5 text-[11px] text-[var(--text-muted)] print:text-neutral-700">
                    {parts.teamTime && (
                        <p className="font-semibold text-[var(--text-main)] print:text-black">
                            Tiempo del equipo: {parts.teamTime}
                        </p>
                    )}
                    {parts.workers.map((worker) => (
                        <p key={`${worker.name}-${worker.time}`}>
                            {worker.name}: {worker.time}
                        </p>
                    ))}
                </div>
            )}
            {parts.charge && (
                <p className="text-[11px] font-semibold text-[var(--text-main)] print:text-black">
                    Cobro: {parts.charge}
                </p>
            )}
            {parts.extras.map((extra) => (
                <p key={extra} className="text-[11px] text-[var(--text-muted)]">
                    {extra}
                </p>
            ))}
        </div>
    );
}
