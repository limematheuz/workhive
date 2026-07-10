"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface RegisterClientDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    loading: boolean
    clientDisplayName: string
    onAcceptOnly: () => void
    onRegisterAndAccept: () => void
}

export function RegisterClientDialog({
    open,
    onOpenChange,
    loading,
    clientDisplayName,
    onAcceptOnly,
    onRegisterAndAccept,
}: RegisterClientDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-6 rounded-2xl border-[var(--border-soft)] bg-[var(--bg-card)]">
                <DialogHeader>
                    <DialogTitle className="text-lg font-black text-[var(--text-main)]">
                        ¿Registrar cliente nuevo?
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 text-sm text-[var(--text-muted)] font-medium">
                    Este presupuesto no está asociado a ningún cliente registrado. ¿Deseas añadir automáticamente a{" "}
                    <strong className="text-[var(--text-main)] font-semibold">
                        &quot;{clientDisplayName}&quot;
                    </strong>{" "}
                    a tu base de datos de clientes antes de marcarlo como aceptado?
                </div>
                <div className="flex justify-end gap-2.5 pt-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="px-4 py-2 text-xs font-semibold bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] rounded-xl transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onAcceptOnly}
                        className="px-4 py-2 text-xs font-semibold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 rounded-xl transition-all cursor-pointer"
                    >
                        No, sólo aceptar
                    </button>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onRegisterAndAccept}
                        className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-all cursor-pointer"
                    >
                        Sí, registrar y aceptar
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
