import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
            <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-main)] cursor-pointer select-none">
                <Checkbox
                    checked={form.cleaningRequired}
                    onCheckedChange={(checked) =>
                        onFormChange({
                            ...form,
                            cleaningRequired:
                                checked === true,
                        })
                    }
                />
                {dict.reservations?.form
                    ?.requires_checkout_cleaning ||
                    "Requiere limpieza de salida"}
            </Label>
            {form.cleaningRequired && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                            {dict.reservations?.form
                                ?.cleaning_proposed_date ||
                                "Fecha propuesta de limpieza"}
                        </Label>
                        <DateTimePicker
                            id="reservation-cleaning-scheduled-at"
                            aria-label={
                                dict.reservations?.form
                                    ?.cleaning_proposed_date ||
                                "Fecha propuesta de limpieza"
                            }
                            min={form.checkOut}
                            value={form.cleaningScheduledAt}
                            onValueChange={(cleaningScheduledAt) =>
                                onFormChange({
                                    ...form,
                                    cleaningScheduledAt: cleaningScheduledAt ?? "",
                                })
                            }
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
                        <Select
                            aria-label={
                                dict.reservations?.form
                                    ?.assigned_cleaning_company ||
                                "Empresa de limpieza asignada"
                            }
                            value={form.assignedUserId || "none"}
                            onValueChange={(value) =>
                                onFormChange({
                                    ...form,
                                    assignedUserId: value === "none" ? "" : value,
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={dict.reservations?.form?.assigned_cleaning_company_internal || "Gestión interna / Sin proveedor externo"} />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="none">
                                {dict.reservations?.form
                                    ?.assigned_cleaning_company_internal ||
                                    "Gestión interna / Sin proveedor externo"}
                            </SelectItem>
                            {serviceProviders.map(
                                (provider) => (
                                    <SelectItem
                                        key={provider.id}
                                        value={String(provider.id)}
                                    >
                                        {provider.name}
                                    </SelectItem>
                                )
                            )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
        </div>
    );
}
