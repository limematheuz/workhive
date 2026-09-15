import { Clock3, Home } from "lucide-react";

import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
                <Select
                    aria-label={
                        dict.reservations?.form?.property ||
                        "Propiedad"
                    }
                    value={form.locationId}
                    onValueChange={(locationId) => {
                        const location = locations.find(
                            (item) =>
                                item.id === Number(locationId)
                        );
                        onFormChange({
                            ...form,
                            locationId,
                            assignedUserId:
                                location?.default_service_provider_id?.toString() ||
                                "",
                        });
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder={dict.reservations?.form?.select_property || "Selecciona una propiedad"} />
                    </SelectTrigger>
                    <SelectContent>
                        {locations.map((location) => (
                            <SelectItem key={location.id} value={String(location.id)}>
                                {location.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        <Home className="w-3.5 h-3.5 text-accent" />
                        {dict.reservations?.form?.check_in ||
                            "Entrada"}
                    </Label>
                    <DateTimePicker
                        id="reservation-check-in"
                        aria-label={
                            dict.reservations?.form?.check_in ||
                            "Entrada"
                        }
                        value={form.checkIn}
                        onValueChange={(checkIn) =>
                            onFormChange({
                                ...form,
                                checkIn: checkIn ?? "",
                            })
                        }
                    />
                </div>
                <div className="space-y-1">
                    <Label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        <Clock3 className="w-3.5 h-3.5 text-accent" />
                        {dict.reservations?.form?.check_out ||
                            "Salida"}
                    </Label>
                    <DateTimePicker
                        id="reservation-check-out"
                        aria-label={
                            dict.reservations?.form?.check_out ||
                            "Salida"
                        }
                        value={form.checkOut}
                        onValueChange={(nextCheckOut) => {
                            const resolvedCheckOut = nextCheckOut ?? "";
                            onFormChange({
                                ...form,
                                checkOut: resolvedCheckOut,
                                cleaningScheduledAt:
                                    !form.cleaningScheduledAt ||
                                    form.cleaningScheduledAt ===
                                        form.checkOut
                                        ? resolvedCheckOut
                                        : form.cleaningScheduledAt,
                            });
                        }}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.reservations?.form?.guests ||
                            "Huéspedes"}
                    </Label>
                    <Input
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
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.reservations?.form?.stay_type ||
                            "Tipo de estancia"}
                    </Label>
                    <Select
                        aria-label={
                            dict.reservations?.form?.stay_type ||
                            "Tipo de estancia"
                        }
                        value={form.stayType}
                        onValueChange={(stayType) =>
                            onFormChange({
                                ...form,
                                stayType,
                            })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="guest">
                            {dict.reservations?.form
                                ?.stay_type_guest || "Huéspedes"}
                        </SelectItem>
                        <SelectItem value="owner">
                            {dict.reservations?.form
                                ?.stay_type_owner || "Propietario"}
                        </SelectItem>
                        <SelectItem value="block">
                            {dict.reservations?.form
                                ?.stay_type_block || "Bloqueo"}
                        </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </>
    );
}
