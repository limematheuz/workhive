import { Clock3, Home } from "lucide-react";

import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/types/location";

import type { ReservationFormState } from "./types";

type ReservationFormMainFieldsProps = {
    form: ReservationFormState;
    onFormChange: (form: ReservationFormState) => void;
    locations: Location[];
    dict: Dictionary;
};

export function ReservationFormMainFields({
    form,
    onFormChange,
    locations,
    dict,
}: ReservationFormMainFieldsProps) {
    return (
        <>
            <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {dict.reservations?.form?.property ||
                        "Propiedad"}
                </Label>
                <select
                    required
                    aria-label={
                        dict.reservations?.form?.property ||
                        "Propiedad"
                    }
                    value={form.locationId}
                    onChange={(event) => {
                        const location = locations.find(
                            (item) =>
                                item.id === Number(event.target.value)
                        );
                        onFormChange({
                            ...form,
                            locationId: event.target.value,
                            assignedUserId:
                                location?.default_service_provider_id?.toString() ||
                                "",
                        });
                    }}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2.5 rounded-xl outline-none text-sm font-semibold cursor-pointer focus:border-accent/50 transition-all"
                >
                    <option value="" disabled>
                        {dict.reservations?.form?.select_property ||
                            "Selecciona una propiedad"}
                    </option>
                    {locations.map((location) => (
                        <option
                            key={location.id}
                            value={location.id}
                        >
                            {location.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        <Home className="w-3.5 h-3.5 text-accent" />
                        {dict.reservations?.form?.check_in ||
                            "Entrada"}
                    </Label>
                    <input
                        required
                        type="datetime-local"
                        aria-label={
                            dict.reservations?.form?.check_in ||
                            "Entrada"
                        }
                        value={form.checkIn}
                        onChange={(event) =>
                            onFormChange({
                                ...form,
                                checkIn: event.target.value,
                            })
                        }
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2.5 rounded-xl outline-none text-sm font-semibold focus:border-accent/50 transition-all"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        <Clock3 className="w-3.5 h-3.5 text-accent" />
                        {dict.reservations?.form?.check_out ||
                            "Salida"}
                    </Label>
                    <input
                        required
                        type="datetime-local"
                        aria-label={
                            dict.reservations?.form?.check_out ||
                            "Salida"
                        }
                        value={form.checkOut}
                        onChange={(event) => {
                            const nextCheckOut =
                                event.target.value;
                            onFormChange({
                                ...form,
                                checkOut: nextCheckOut,
                                cleaningScheduledAt:
                                    !form.cleaningScheduledAt ||
                                    form.cleaningScheduledAt ===
                                        form.checkOut
                                        ? nextCheckOut
                                        : form.cleaningScheduledAt,
                            });
                        }}
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2.5 rounded-xl outline-none text-sm font-semibold focus:border-accent/50 transition-all"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.reservations?.form?.guests ||
                            "Huéspedes"}
                    </Label>
                    <input
                        required
                        min="0"
                        type="number"
                        aria-label={
                            dict.reservations?.form?.guests ||
                            "Huéspedes"
                        }
                        value={form.guestCount}
                        onChange={(event) =>
                            onFormChange({
                                ...form,
                                guestCount: event.target.value,
                            })
                        }
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2.5 rounded-xl outline-none text-sm font-semibold focus:border-accent/50 transition-all"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.reservations?.form?.stay_type ||
                            "Tipo de estancia"}
                    </Label>
                    <select
                        aria-label={
                            dict.reservations?.form?.stay_type ||
                            "Tipo de estancia"
                        }
                        value={form.stayType}
                        onChange={(event) =>
                            onFormChange({
                                ...form,
                                stayType: event.target.value,
                            })
                        }
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2.5 rounded-xl outline-none text-sm font-semibold cursor-pointer focus:border-accent/50 transition-all"
                    >
                        <option value="guest">
                            {dict.reservations?.form
                                ?.stay_type_guest || "Huéspedes"}
                        </option>
                        <option value="owner">
                            {dict.reservations?.form
                                ?.stay_type_owner || "Propietario"}
                        </option>
                        <option value="block">
                            {dict.reservations?.form
                                ?.stay_type_block || "Bloqueo"}
                        </option>
                    </select>
                </div>
            </div>
        </>
    );
}
