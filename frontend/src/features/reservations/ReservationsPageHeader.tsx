"use client";

import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";

type ReservationsPageHeaderProps = {
    dict: Dictionary;
    showCreateButton: boolean;
    onCreate: () => void;
};

export function ReservationsPageHeader({
    dict,
    showCreateButton,
    onCreate,
}: ReservationsPageHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] flex items-center gap-2">
                    <CalendarDays className="h-6 w-6 text-accent" />
                    {dict.reservations?.page_title || "Reservas y estancias"}
                </h1>
                <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
                    {dict.reservations?.page_subtitle ||
                        "Registra entradas y salidas. Las tareas de limpieza se crearán automáticamente."}
                </p>
            </div>
            {showCreateButton && (
                <Button
                    onClick={onCreate}
                    className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] font-semibold rounded-xl px-5 py-2.5 text-xs flex items-center justify-center gap-2 transition-all shadow-sm border border-[var(--border-soft)] cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    {dict.reservations?.new_reservation || "Nueva reserva"}
                </Button>
            )}
        </div>
    );
}
