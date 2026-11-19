"use client";

import { useEffect, useState } from "react";
import { LocationService, type Location } from "@/services/location.service";
import type { LocationCatalog, LocationSpace } from "@/types/location";
import { selectedLocationFeatureLabels } from "@/domain/locations/location-task-catalog";
import { LocationWizardSummary } from "./LocationWizardSummary";

export function LocationSavedSummary({ location, spaces, clientName }: { location:Location;spaces:LocationSpace[];clientName:string }) {
    const profile=location.profile||{site_type:"other",attributes:{}};
    const access=location.access;
    const [catalog, setCatalog] = useState<LocationCatalog | null>(null);
    useEffect(() => {
        let active = true;
        void LocationService.getLocationCatalog().then(value => { if (active) setCatalog(value); }).catch(() => {});
        return () => { active = false; };
    }, []);
    const featureLabels = selectedLocationFeatureLabels(catalog, profile.attributes);
    return <LocationWizardSummary
        hideIdentity
        name={location.name}
        clientName={clientName}
        typeLabel={catalog?.site_types.find(type => type.id === profile.site_type)?.label}
        featureLabels={featureLabels}
        address={location.address}
        city={location.city}
        profile={profile}
        spaces={spaces}
        contacts={(location.contacts||[]).filter(contact => contact.is_active !== false)}
        existing
        hasAccessCode={access?.has_access_code}
        access={{permitted_days:access?.permitted_days||[],permitted_from:access?.permitted_from,permitted_until:access?.permitted_until,access_method:access?.access_method,keys_available:access?.keys_available,keys_location:access?.keys_location,key_custodian:access?.key_custodian,instructions:access?.instructions,requires_outside_hours_authorization:access?.requires_outside_hours_authorization,access_code:"",clear_access_code:false}}
    />;
}
