"use client";

import type { FormEventHandler } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Company } from "@/types/company";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";

import { ReservationFormDialogActions } from "./ReservationFormDialogActions";
import { ReservationFormFields } from "./ReservationFormFields";
import type { ReservationFormState } from "./types";

interface ReservationFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing: Reservation | null;
    form: ReservationFormState;
    onFormChange: (form: ReservationFormState) => void;
    locations: Location[];
    serviceProviders: Company[];
    saving: boolean;
    dict: Dictionary;
    onSubmit: FormEventHandler<HTMLFormElement>;
}

export function ReservationFormDialog({
    open,
    onOpenChange,
    editing,
    form,
    onFormChange,
    locations,
    serviceProviders,
    saving,
    dict,
    onSubmit,
}: ReservationFormDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] flex flex-col p-0 overflow-hidden sm:max-w-xl bg-[var(--bg-card)] border-[var(--border-soft)] rounded-3xl">
                <form
                    onSubmit={onSubmit}
                    className="flex flex-col flex-1 overflow-hidden"
                >
                    <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                        <DialogTitle className="text-base font-black uppercase tracking-wider text-[var(--text-main)]">
                            {editing
                                ? dict.reservations?.edit_reservation ||
                                  "Editar reserva"
                                : dict.reservations?.new_reservation ||
                                  "Nueva reserva"}
                        </DialogTitle>
                        <DialogDescription className="text-2xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            {dict.reservations?.create_reservation_desc ||
                                "Registra la estancia de la propiedad."}
                        </DialogDescription>
                    </DialogHeader>

                    <ReservationFormFields
                        form={form}
                        onFormChange={onFormChange}
                        locations={locations}
                        serviceProviders={serviceProviders}
                        dict={dict}
                    />

                    <ReservationFormDialogActions
                        saving={saving}
                        onClose={() => onOpenChange(false)}
                        dict={dict}
                    />
                </form>
            </DialogContent>
        </Dialog>
    );
}
