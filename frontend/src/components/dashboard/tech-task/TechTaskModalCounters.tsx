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
        <div className="grid grid-cols-3 gap-3 my-2">
            <button
                type="button"
                onClick={onOpenRequisitos}
                className="flex flex-col items-center justify-center p-3 bg-[var(--bg-card)] border border-[var(--border-soft)] hover:border-accent/30 hover:bg-[var(--bg-primary)]/5 rounded-2xl text-center shadow-2xs cursor-pointer transition-all duration-200"
            >
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span className="text-xs font-black text-[var(--text-main)] mt-1.5">{completedCount}/{totalCount}</span>
                <span className="text-[9px] font-extrabold uppercase text-[var(--text-muted)] tracking-wider mt-0.5">
                    {locale === "es" ? "Requisitos" : "Requirements"}
                </span>
            </button>

            <button
                type="button"
                onClick={onOpenAdjuntos}
                className="flex flex-col items-center justify-center p-3 bg-[var(--bg-card)] border border-[var(--border-soft)] hover:border-accent/30 hover:bg-[var(--bg-primary)]/5 rounded-2xl text-center shadow-2xs cursor-pointer transition-all duration-200"
            >
                <Paperclip className="w-5 h-5 text-accent" />
                <span className="text-xs font-black text-[var(--text-main)] mt-1.5">+</span>
                <span className="text-[9px] font-extrabold uppercase text-[var(--text-muted)] tracking-wider mt-0.5">
                    {locale === "es" ? "Enviar foto" : "Send photo"}
                </span>
            </button>

            <button
                type="button"
                onClick={onOpenComentarios}
                className="flex flex-col items-center justify-center p-3 bg-[var(--bg-card)] border border-[var(--border-soft)] hover:border-accent/30 hover:bg-[var(--bg-primary)]/5 rounded-2xl text-center shadow-2xs cursor-pointer transition-all duration-200"
            >
                <MessageSquare className="w-5 h-5 text-accent" />
                <span className="text-xs font-black text-[var(--text-main)] mt-1.5">+</span>
                <span className="text-[9px] font-extrabold uppercase text-[var(--text-muted)] tracking-wider mt-0.5">
                    {locale === "es" ? "Enviar nota" : "Send note"}
                </span>
            </button>
        </div>
    );
}
