"use client";

import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import type { Dictionary } from "@/lib/dictionary-context";

type ReservationsCancelDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dict: Dictionary;
    onConfirm: () => Promise<void>;
};

export function ReservationsCancelDialog({
    open,
    onOpenChange,
    dict,
    onConfirm,
}: ReservationsCancelDialogProps) {
    return (
        <DeleteConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            title={dict.reservations?.cancel_dialog?.title || "Cancelar reserva"}
            description={
                dict.reservations?.cancel_dialog?.description ||
                "¿Estás seguro de que deseas cancelar esta reserva? Se cancelarán los servicios vinculados no completados."
            }
            onConfirm={onConfirm}
            isDeleting={false}
            confirmText={dict.reservations?.cancel_dialog?.confirm || "Sí, cancelar"}
            cancelText={dict.reservations?.cancel_dialog?.cancel || "No, mantener"}
        />
    );
}
