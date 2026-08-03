"use client";

import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
        <PageHeader
            icon={CalendarDays}
            title={dict.reservations?.page_title || "Reservas y estancias"}
            subtitle={
                dict.reservations?.page_subtitle
                || "Registra entradas y salidas. Las tareas de limpieza se crearán automáticamente."
            }
            className="mb-6"
            actions={showCreateButton ? (
                <Button
                    onClick={onCreate}
                    className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] font-semibold rounded-xl px-5 py-2.5 text-xs flex items-center justify-center gap-2 ui-motion shadow-sm border border-[var(--border-soft)] cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    {dict.reservations?.new_reservation || "Nueva reserva"}
                </Button>
            ) : undefined}
        />
    );
}
