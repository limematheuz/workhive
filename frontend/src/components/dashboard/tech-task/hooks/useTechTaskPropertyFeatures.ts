"use client";

import { useState, useMemo } from "react";
import { toast } from "@/lib/toast";
import { LocationService } from "@/services/location.service";
import type { Location } from "@/types/location";
import type { User } from "@/types/user";
import { canManageCompanyTasks } from "@/domain/access/roles";

interface UseTechTaskPropertyFeaturesParams {
    location: Location | null;
    currentUser: User;
    locale: string;
    onStatusUpdate: () => void;
}

export function useTechTaskPropertyFeatures({
    location,
    currentUser,
    locale,
    onStatusUpdate,
}: UseTechTaskPropertyFeaturesParams) {
    const features = useMemo(() => ({
        rooms: location?.rooms?.length || 0,
        bathrooms: location?.num_bathrooms || 0,
        kitchens: location?.has_kitchen ? 1 : 0,
        hasTerrace: Boolean(location?.has_terrace),
        hasGarage: Boolean(location?.has_garage),
    }), [location]);

    const [isEditingFeatures, setIsEditingFeatures] = useState<boolean>(false);

    const canEditLocationDetails = useMemo(() => Boolean(
        location
        && currentUser?.company_id
        && location.owner_company_id === currentUser.company_id
        && canManageCompanyTasks(currentUser)
    ), [location, currentUser]);

    const handleSaveFeatures = async (updated: typeof features) => {
        if (!location || !canEditLocationDetails) return;
        try {
            await LocationService.updateLocation(location.id, {
                num_bathrooms: updated.bathrooms,
                has_kitchen: updated.kitchens > 0,
                has_terrace: updated.hasTerrace,
                has_garage: updated.hasGarage,
            });
            setIsEditingFeatures(false);
            onStatusUpdate();
            toast.success(locale === "es" ? "Características actualizadas" : "Features updated");
        } catch {
            toast.error(locale === "es" ? "No se pudieron actualizar las características" : "Could not update features");
        }
    };

    return {
        features,
        isEditingFeatures,
        setIsEditingFeatures,
        canEditLocationDetails,
        handleSaveFeatures,
    };
}
