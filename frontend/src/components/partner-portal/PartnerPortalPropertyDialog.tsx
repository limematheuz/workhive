"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LocationWorkspaceForm, type LocationWorkspacePayload } from "@/components/locations/LocationWorkspaceForm";
import { PartnerPortalService } from "@/services/partner-portal.service";
import type { Location } from "@/types/location";
import type { PartnerPortalLocationInput } from "@/types/partner-portal";

export function PropertyDialog({
    location,
    open,
    onOpenChange,
    onSaved,
}: {
    location?: Location | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (location: Location, isNew: boolean) => void;
}) {
    const [submitting, setSubmitting] = useState(false);

    const submit = async (payload: LocationWorkspacePayload) => {
        setSubmitting(true);
        try {
            const { name, address, city, postal_code, location_type, profile, access, spaces } = payload;
            const portalPayload: PartnerPortalLocationInput = { name, address, city, postal_code, location_type, profile, access };
            const saved = location
                ? await PartnerPortalService.updateLocation(location.id, portalPayload)
                : await PartnerPortalService.createLocation({ ...portalPayload, spaces });
            onSaved(saved, !location);
            onOpenChange(false);
            toast.success(location ? "Propiedad actualizada." : "Propiedad creada y compartida con tu empresa de limpieza.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo guardar la propiedad.");
        } finally {
            setSubmitting(false);
        }
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(92vh,980px)] w-[calc(100vw-1.5rem)] !max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-[24px] border border-[var(--border-soft)] p-0 sm:w-[calc(100vw-3rem)] sm:!max-w-[calc(100vw-3rem)] 2xl:!max-w-[1380px]">
            <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-4 sm:px-7 sm:py-5"><DialogTitle>{location ? "Editar propiedad" : "Nueva propiedad"}</DialogTitle><DialogDescription>La propiedad es de tu inmobiliaria y se comparte automáticamente con tu empresa de limpieza asignada.</DialogDescription></DialogHeader>
            {open && <div className="min-h-0 flex-1 overflow-hidden"><LocationWorkspaceForm key={location?.id ?? "new"} clients={[]} location={location} submitting={submitting} submitLabel={location ? "Guardar cambios" : "Crear y compartir"} onCancel={() => onOpenChange(false)} onSubmit={submit} portalMode loadCatalog={PartnerPortalService.getLocationCatalog} loadSpaceSuggestions={PartnerPortalService.getSpaceSuggestions} /></div>}
        </DialogContent>
    </Dialog>;
}
