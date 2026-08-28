"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

function workersTextFromParts(parts: InvoiceConceptDescriptionParts): string {
    return parts.workers
        .map((worker) => `${worker.name}: ${worker.time}`)
        .join("\n");
}

function parseWorkersText(value: string): InvoiceConceptDescriptionParts["workers"] {
    return value.split("\n").reduce<InvoiceConceptDescriptionParts["workers"]>(
        (workers, rawLine) => {
            const line = rawLine.trim();
            if (!line) return workers;
            const [name, ...rest] = line.split(":");
            workers.push({
                name: (name || "").trim(),
                time: rest.join(":").trim() || "0m",
            });
            return workers;
        },
        [],
    );
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
    const [workersText, setWorkersText] = useState(() => (
        workersTextFromParts(parsed.title ? parsed : emptyParts(value))
    ));

    useEffect(() => {
        if (editing) return;
        let active = true;
        queueMicrotask(() => {
            if (!active) return;
            const next = parsed.title ? parsed : emptyParts(value);
            setDraft(next);
            setWorkersText(workersTextFromParts(next));
        });
        return () => {
            active = false;
        };
    }, [editing, parsed, value]);

    const publish = (next: InvoiceConceptDescriptionParts, nextWorkersText = workersText) => {
        const workers = parseWorkersText(nextWorkersText);
        const composed = composeInvoiceConceptDescription({ ...next, workers });
        setDraft({ ...next, workers });
        onChange(composed);
    };

    if (editing) {
        return (
            <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6.5rem]">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-title`}>
                            {label}
                        </Label>
                        <Input
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
                            className="dialog-compact-control h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 text-xs font-semibold text-[var(--text-main)] shadow-none outline-none focus:border-accent"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-location`}>
                            Ubicación
                        </Label>
                        <Input
                            id={`${id}-location`}
                            value={draft.location || ""}
                            onChange={(event) => {
                                const next = { ...draft, location: event.target.value };
                                setDraft(next);
                                publish(next);
                            }}
                            placeholder="Casa / local"
                            className="dialog-compact-control h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 text-xs text-[var(--text-main)] shadow-none outline-none focus:border-accent"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-date`}>
                            Fecha
                        </Label>
                        <Input
                            id={`${id}-date`}
                            value={draft.date || ""}
                            onChange={(event) => {
                                const next = { ...draft, date: event.target.value };
                                setDraft(next);
                                publish(next);
                            }}
                            placeholder="dd/mm/aaaa"
                            className="dialog-compact-control h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 font-mono text-xs text-[var(--text-main)] shadow-none outline-none focus:border-accent"
                        />
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-team`}>
                            Tiempo equipo
                        </Label>
                        <Input
                            id={`${id}-team`}
                            value={draft.teamTime || ""}
                            onChange={(event) => {
                                const next = { ...draft, teamTime: event.target.value };
                                setDraft(next);
                                publish(next);
                            }}
                            placeholder="1h 30m"
                            className="dialog-compact-control h-8 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 font-mono text-xs text-[var(--text-main)] shadow-none outline-none focus:border-accent"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" htmlFor={`${id}-workers`}>
                            Equipo (Nombre: tiempo)
                        </Label>
                        <Textarea
                            id={`${id}-workers`}
                            value={workersText}
                            onChange={(event) => {
                                setWorkersText(event.target.value);
                                publish(draft, event.target.value);
                            }}
                            rows={Math.max(2, Math.min(4, workersText.split("\n").length || 2))}
                            className="dialog-compact-control w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 py-1.5 font-mono text-[11px] leading-5 text-[var(--text-main)] shadow-none outline-none focus:border-accent"
                            placeholder={"Andrea: 1h 2m\nOwnet: 8m"}
                        />
                    </div>
                </div>

                {isStructured && (
                    <Button
                        type="button"
                        onClick={() => setEditing(false)}
                        variant="link"
                        size="xs"
                        className="h-auto border-transparent px-0 py-0 text-3xs font-semibold shadow-none hover:translate-y-0 hover:shadow-none"
                    >
                        Listo
                    </Button>
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
                    {parsed.workers.flatMap((worker) => (
                        worker.time === "0m"
                            ? []
                            : [
                                <WorkerChip
                                    key={`${worker.name}-${worker.time}`}
                                    name={worker.name}
                                    time={worker.time}
                                />,
                            ]
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

            <Button
                type="button"
                onClick={() => setEditing(true)}
                variant="link"
                size="xs"
                className="h-auto border-transparent px-0 py-0 text-3xs font-semibold shadow-none hover:translate-y-0 hover:shadow-none"
            >
                Editar
            </Button>
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
