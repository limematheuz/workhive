"use client";

import { useState } from "react";
import { LayoutList, PencilLine } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import type { Client } from "@/services/client.service";
import { Location, LocationService } from "@/services/location.service";
import { LocationSpacesTab } from "./LocationSpacesTab";
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
    const [activeTab, setActiveTab] = useState("details");

    const updateLocation = async (payload: LocationWorkspacePayload) => {
        if (!location) return;
        try {
            setSubmitting(true);
            await LocationService.updateLocation(location.id, payload);
            toast.success("Ubicación actualizada.");
            setActiveTab("details");
            onOpenChange(false);
            onLocationUpdated?.();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo actualizar la ubicación."));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            if (!nextOpen) setActiveTab("details");
            onOpenChange(nextOpen);
        }}>
            <DialogContent className="flex h-[min(92vh,980px)] w-[calc(100vw-1.5rem)] !max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-[24px] border border-[var(--border-soft)] p-0 sm:w-[calc(100vw-3rem)] sm:!max-w-[calc(100vw-3rem)] 2xl:!max-w-[1380px]">
                {location && <div className="flex min-h-0 flex-1 flex-col">
                    <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-primary)] px-5 py-4 sm:px-7 sm:py-5">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><PencilLine className="h-5 w-5" /></div>
                            <div className="min-w-0 flex-1">
                                <DialogTitle>Editar ubicación</DialogTitle>
                                <DialogDescription>Actualiza los datos o abre directamente la estructura de espacios.</DialogDescription>
                            </div>
                        </div>
                        <PremiumTabs
                            className="mt-4"
                            tabs={[{ id: "details", label: "Información", icon: PencilLine }, { id: "spaces", label: "Espacios y tareas", icon: LayoutList }]}
                            activeTab={activeTab}
                            onChange={setActiveTab}
                        />
                    </DialogHeader>

                    {activeTab === "details" ? (
                        <div className="h-full min-h-0 overflow-hidden">
                            <LocationWorkspaceForm key={location.id} clients={clients} location={location} submitting={submitting} submitLabel="Guardar cambios" onCancel={() => { setActiveTab("details"); onOpenChange(false); }} onSubmit={updateLocation} />
                        </div>
                    ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
                        <LocationSpacesTab locationId={location.id} open={open && activeTab === "spaces"} canManage />
                    </div>
                    )}
                </div>}
            </DialogContent>
        </Dialog>
    );
}
