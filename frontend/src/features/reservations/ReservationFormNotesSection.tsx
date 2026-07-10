import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/dictionary-context";

import type { ReservationFormState } from "./types";

type ReservationFormNotesSectionProps = {
    form: ReservationFormState;
    onFormChange: (form: ReservationFormState) => void;
    dict: Dictionary;
};

export function ReservationFormNotesSection({
    form,
    onFormChange,
    dict,
}: ReservationFormNotesSectionProps) {
    return (
        <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                {form.assignedUserId
                    ? dict.reservations?.form?.notes_external ||
                      "Indicaciones para la empresa de servicio"
                    : dict.reservations?.form?.notes_internal ||
                      "Notas internas"}
            </Label>
            <textarea
                rows={3}
                aria-label={
                    form.assignedUserId
                        ? dict.reservations?.form
                              ?.notes_external ||
                          "Indicaciones para la empresa de servicio"
                        : dict.reservations?.form
                              ?.notes_internal ||
                          "Notas internas"
                }
                value={form.notes}
                onChange={(event) =>
                    onFormChange({
                        ...form,
                        notes: event.target.value,
                    })
                }
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2 rounded-xl outline-none text-sm font-medium focus:border-accent/50 resize-none transition-all"
            />
            <p className="text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                {form.assignedUserId
                    ? dict.reservations?.form
                          ?.notes_external_hint ||
                      "La empresa receptora verá estas indicaciones junto con la solicitud."
                    : dict.reservations?.form
                          ?.notes_internal_hint ||
                      "Solo será visible dentro de tu empresa."}
            </p>
        </div>
    );
}
