"use client";

import { useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import type { Client } from "@/services/client.service";
import { Location, LocationService } from "@/services/location.service";
import { LocationWorkspaceForm, type LocationWorkspacePayload } from "./LocationWorkspaceForm";

interface EditLocationSheetProps {
    location: Location | null;
    clients: Client[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLocationUpdated?: () => void;
}

export function EditLocationSheet({
    location,
    clients,
    open,
    onOpenChange,
    onLocationUpdated,
}: EditLocationSheetProps) {
    const [submitting, setSubmitting] = useState(false);

    const updateLocation = async (payload: LocationWorkspacePayload) => {
        if (!location) return;
        try {
            setSubmitting(true);
            await LocationService.updateLocation(location.id, payload);
            toast.success("Ubicación actualizada.");
            onOpenChange(false);
            onLocationUpdated?.();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo actualizar la ubicación."));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
                {location && (
                    <>
                        <DialogHeader className="border-b border-[var(--border-soft)] p-6">
                            <DialogTitle>Editar ubicación</DialogTitle>
                            <DialogDescription>
                                Actualiza lo esencial. La estructura de espacios se gestiona en su pestaña para no recargar este formulario.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="p-6">
                            <LocationWorkspaceForm
                                key={location.id}
                                clients={clients}
                                location={location}
                                submitting={submitting}
                                submitLabel="Guardar cambios"
                                onCancel={() => onOpenChange(false)}
                                onSubmit={updateLocation}
                            />
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
