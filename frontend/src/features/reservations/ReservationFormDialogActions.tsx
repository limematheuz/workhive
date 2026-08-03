import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";

type ReservationFormDialogActionsProps = {
    saving: boolean;
    onClose: () => void;
    dict: Dictionary;
};

export function ReservationFormDialogActions({
    saving,
    onClose,
    dict,
}: ReservationFormDialogActionsProps) {
    return (
        <div className="dialog-glass-chrome p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] flex-shrink-0 justify-end">
            <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="w-1/2 sm:w-auto bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion"
            >
                {dict.reservations?.form?.btn_close || "Cerrar"}
            </Button>
            <Button
                type="submit"
                disabled={saving}
                className="w-1/2 sm:w-auto bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer ui-motion"
            >
                {saving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {dict.reservations?.form?.btn_save ||
                    "Guardar reserva"}
            </Button>
        </div>
    );
}
