"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export function EditLocationSheet({ location, clients, open, onOpenChange, onLocationUpdated }: EditLocationSheetProps) {
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
            <DialogContent className="wh-location-dialog flex flex-col gap-0 overflow-hidden p-0">
                {location && <div className="flex min-h-0 flex-1 flex-col">
                    <DialogHeader className="wh-location-dialog-header shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-primary)] pr-16 text-left">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><PencilLine className="h-5 w-5" /></div>
                            <div className="min-w-0 flex-1">
                                <DialogTitle>Editar ubicación</DialogTitle>
                                <DialogDescription>Empieza por los datos básicos o revisa cualquier paso; guarda cuando termines.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="h-full min-h-0 overflow-hidden">
                        <LocationWorkspaceForm key={location.id} clients={clients} location={location} submitting={submitting} submitLabel="Guardar cambios" onCancel={() => onOpenChange(false)} onSubmit={updateLocation} />
                    </div>
                </div>}
            </DialogContent>
        </Dialog>
    );
}
