import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Company } from "@/types/company";

import type { ReservationFormState } from "./types";

type ReservationFormCleaningSectionProps = {
    form: ReservationFormState;
    onFormChange: (form: ReservationFormState) => void;
    serviceProviders: Company[];
    dict: Dictionary;
};

export function ReservationFormCleaningSection({
    form,
    onFormChange,
    serviceProviders,
    dict,
}: ReservationFormCleaningSectionProps) {
    return (
        <div className="space-y-2 border-t border-b border-[var(--border-soft)]/50 py-3 my-1">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-main)] cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={form.cleaningRequired}
                    onChange={(event) =>
                        onFormChange({
                            ...form,
                            cleaningRequired:
                                event.target.checked,
                        })
                    }
                    className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-accent focus:ring-accent accent-accent cursor-pointer"
                />
                {dict.reservations?.form
                    ?.requires_checkout_cleaning ||
                    "Requiere limpieza de salida"}
            </label>
            {form.cleaningRequired && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                            {dict.reservations?.form
                                ?.cleaning_proposed_date ||
                                "Fecha propuesta de limpieza"}
                        </Label>
                        <input
                            required
                            type="datetime-local"
                            aria-label={
                                dict.reservations?.form
                                    ?.cleaning_proposed_date ||
                                "Fecha propuesta de limpieza"
                            }
                            min={form.checkOut}
                            value={form.cleaningScheduledAt}
                            onChange={(event) =>
                                onFormChange({
                                    ...form,
                                    cleaningScheduledAt:
                                        event.target.value,
                                })
                            }
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2.5 rounded-xl outline-none text-sm font-semibold focus:border-accent/50 ui-motion"
                        />
                        <p className="text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                            {dict.reservations?.form
                                ?.cleaning_proposed_hint ||
                                "La empresa receptora podrá ajustarla antes de aceptar."}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                            {dict.reservations?.form
                                ?.assigned_cleaning_company ||
                                "Empresa de limpieza asignada"}
                        </Label>
                        <select
                            aria-label={
                                dict.reservations?.form
                                    ?.assigned_cleaning_company ||
                                "Empresa de limpieza asignada"
                            }
                            value={form.assignedUserId}
                            onChange={(event) =>
                                onFormChange({
                                    ...form,
                                    assignedUserId:
                                        event.target.value,
                                })
                            }
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2.5 rounded-xl outline-none text-sm font-semibold cursor-pointer focus:border-accent/50 ui-motion"
                        >
                            <option value="">
                                {dict.reservations?.form
                                    ?.assigned_cleaning_company_internal ||
                                    "Gestión interna / Sin proveedor externo"}
                            </option>
                            {serviceProviders.map(
                                (provider) => (
                                    <option
                                        key={provider.id}
                                        value={provider.id}
                                    >
                                        {provider.name}
                                    </option>
                                )
                            )}
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}
