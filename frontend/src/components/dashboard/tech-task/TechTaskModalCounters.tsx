"use client";

import { CheckCircle2, Paperclip, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface TechTaskModalCountersProps {
    locale: string;
    completedCount: number;
    totalCount: number;
    onOpenRequisitos: () => void;
    onOpenAdjuntos: () => void;
    onOpenComentarios: () => void;
}

const tileClass =
    "billing-block flex min-h-[4.75rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-center outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,var(--bg-tertiary))] focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]";

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
            <button type="button" onClick={onOpenRequisitos} className={tileClass}>
                <CheckCircle2 className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold tabular-nums text-[var(--text-main)]">
                    {completedCount}/{totalCount}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {locale === "es" ? "Requisitos" : "Requirements"}
                </span>
            </button>

            <button type="button" onClick={onOpenAdjuntos} className={cn(tileClass)}>
                <Paperclip className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold text-[var(--text-main)]">+</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {locale === "es" ? "Enviar foto" : "Send photo"}
                </span>
            </button>

            <button type="button" onClick={onOpenComentarios} className={cn(tileClass)}>
                <MessageSquare className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold text-[var(--text-main)]">+</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {locale === "es" ? "Enviar nota" : "Send note"}
                </span>
            </button>
        </div>
    );
}
