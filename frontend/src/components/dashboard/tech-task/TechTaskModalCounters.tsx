"use client";

import React from "react";
import { CheckCircle2, Paperclip, MessageSquare } from "lucide-react";

interface TechTaskModalCountersProps {
    locale: string;
    completedCount: number;
    totalCount: number;
    onOpenRequisitos: () => void;
    onOpenAdjuntos: () => void;
    onOpenComentarios: () => void;
}

export function TechTaskModalCounters({
    locale,
    completedCount,
    totalCount,
    onOpenRequisitos,
    onOpenAdjuntos,
    onOpenComentarios,
}: TechTaskModalCountersProps) {
    return (
        <div className="grid grid-cols-3 gap-2">
            <button
                type="button"
                onClick={onOpenRequisitos}
                className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/70 px-2 py-2.5 text-center transition hover:border-accent/35 hover:bg-[var(--bg-secondary)] cursor-pointer"
            >
                <CheckCircle2 className="h-4 w-4 text-accent" />
                <span className="mt-1 text-xs font-black text-[var(--text-main)]">{completedCount}/{totalCount}</span>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    {locale === "es" ? "Requisitos" : "Requirements"}
                </span>
            </button>

            <button
                type="button"
                onClick={onOpenAdjuntos}
                className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/70 px-2 py-2.5 text-center transition hover:border-accent/35 hover:bg-[var(--bg-secondary)] cursor-pointer"
            >
                <Paperclip className="h-4 w-4 text-accent" />
                <span className="mt-1 text-xs font-black text-[var(--text-main)]">+</span>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    {locale === "es" ? "Enviar foto" : "Send photo"}
                </span>
            </button>

            <button
                type="button"
                onClick={onOpenComentarios}
                className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/70 px-2 py-2.5 text-center transition hover:border-accent/35 hover:bg-[var(--bg-secondary)] cursor-pointer"
            >
                <MessageSquare className="h-4 w-4 text-accent" />
                <span className="mt-1 text-xs font-black text-[var(--text-main)]">+</span>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    {locale === "es" ? "Enviar nota" : "Send note"}
                </span>
            </button>
        </div>
    );
}
