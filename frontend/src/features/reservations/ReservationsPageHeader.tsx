"use client";

import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
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
                    className={PAGE_ACTION_BUTTON_PRIMARY}
                >
                    <Plus className="w-4 h-4" />
                    {dict.reservations?.new_reservation || "Nueva reserva"}
                </Button>
            ) : undefined}
        />
    );
}
