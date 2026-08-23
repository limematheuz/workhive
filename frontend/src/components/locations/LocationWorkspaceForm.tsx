"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import type {
    Location,
    LocationCatalog,
    LocationProfileAttributeValue,
    LocationSpace,
} from "@/types/location";
import type { Client } from "@/services/client.service";
import { LocationService } from "@/services/location.service";
import { LocationFeaturesStep } from "./LocationFeaturesStep";
import { LocationInfoAccessStep } from "./LocationInfoAccessStep";
import { LocationSpacesStep } from "./LocationSpacesStep";
import { LocationTypeStep } from "./LocationTypeStep";
import { LocationWorkspaceSummary } from "./LocationWorkspaceSummary";
import { LocationWorkspaceWizardProgress } from "./LocationWorkspaceWizardProgress";
import type {
    LocationAccessDraft,
    LocationProfileDraft,
    LocationWorkspacePayload,
} from "./location-workspace-types";

export type { LocationWorkspacePayload } from "./location-workspace-types";

interface LocationWorkspaceFormProps {
    clients: Client[];
    defaultClientId?: number | "ALL";
    location?: Location | null;
    submitting: boolean;
    submitLabel: string;
    onCancel: () => void;
    onSubmit: (payload: LocationWorkspacePayload) => Promise<void>;
}

const EMPTY_PROFILE: LocationProfileDraft = {
    site_type: "other",
    internal_code: "",
    site_reference: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    service_notes: "",
    attributes: {},
};

const EMPTY_ACCESS: LocationAccessDraft = {
    permitted_days: [],
    permitted_from: "",
    permitted_until: "",
    requires_outside_hours_authorization: false,
    access_method: "",
    keys_available: null,
    keys_location: "",
    key_custodian: "",
    instructions: "",
    access_code: "",
    clear_access_code: false,
};

const LEGACY_LOCATION_TYPE_BY_SITE_TYPE: Record<string, string> = {
    tourist_apartment: "private",
    private_home: "private",
    house: "private",
    community: "real_estate",
    office: "business",
    commercial: "business",
    restaurant: "business",
    cafe: "business",
    clinic: "business",
    dental_clinic: "business",
    school: "business",
    nursery: "business",
    gym: "business",
    industrial: "business",
    warehouse: "business",
    parking: "business",
    public_building: "business",
    construction: "business",
};

function initialProfile(location?: Location | null): LocationProfileDraft {
    if (!location?.profile) return { ...EMPTY_PROFILE, attributes: {} };
    return {
        site_type: location.profile.site_type,
        internal_code: location.profile.internal_code,
        site_reference: location.profile.site_reference,
        contact_name: location.profile.contact_name,
        contact_phone: location.profile.contact_phone,
        contact_email: location.profile.contact_email,
        service_notes: location.profile.service_notes,
        attributes: { ...location.profile.attributes },
    };
}

function initialAccess(location?: Location | null): LocationAccessDraft {
    if (!location?.access) return { ...EMPTY_ACCESS, permitted_days: [] };
    return {
        permitted_days: [...location.access.permitted_days],
        permitted_from: location.access.permitted_from,
        permitted_until: location.access.permitted_until,
        requires_outside_hours_authorization: location.access.requires_outside_hours_authorization,
        access_method: location.access.access_method,
        keys_available: location.access.keys_available,
        keys_location: location.access.keys_location,
        key_custodian: location.access.key_custodian,
        instructions: location.access.instructions,
        access_code: "",
        clear_access_code: false,
    };
}

function cleanProfile(profile: LocationProfileDraft) {
    const attributes = Object.fromEntries(Object.entries(profile.attributes).filter(([, value]) => value !== ""));
    const values = {
        ...profile,
        attributes,
        internal_code: profile.internal_code?.trim() || undefined,
        site_reference: profile.site_reference?.trim() || undefined,
        contact_name: profile.contact_name?.trim() || undefined,
        contact_phone: profile.contact_phone?.trim() || undefined,
        contact_email: profile.contact_email?.trim() || undefined,
        service_notes: profile.service_notes?.trim() || undefined,
    };
    const hasOptionalValues = Object.entries(values).some(([key, value]) => key !== "site_type" && key !== "attributes" && Boolean(value));
    return profile.site_type !== "other" || Object.keys(attributes).length > 0 || hasOptionalValues ? values : undefined;
}

function cleanAccess(access: LocationAccessDraft) {
    const values = {
        ...access,
        permitted_from: access.permitted_from?.trim() || undefined,
        permitted_until: access.permitted_until?.trim() || undefined,
        access_method: access.access_method?.trim() || undefined,
        keys_location: access.keys_location?.trim() || undefined,
        key_custodian: access.key_custodian?.trim() || undefined,
        instructions: access.instructions?.trim() || undefined,
        access_code: access.access_code.trim() || undefined,
    };
    const hasDetails = values.permitted_days.length > 0 || Object.entries(values).some(([key, value]) => !["permitted_days", "clear_access_code"].includes(key) && Boolean(value));
    return hasDetails || access.clear_access_code ? values : undefined;
}

export function LocationWorkspaceForm({
    clients,
    defaultClientId = "ALL",
    location,
    submitting,
    submitLabel,
    onCancel,
    onSubmit,
}: LocationWorkspaceFormProps) {
    const [catalog, setCatalog] = useState<LocationCatalog | null>(null);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [name, setName] = useState(location?.name || "");
    const [address, setAddress] = useState(location?.address || "");
    const [city, setCity] = useState(location?.city || "");
    const [postalCode, setPostalCode] = useState(location?.postal_code || "");
    const [clientId, setClientId] = useState(location?.client_id?.toString() || (defaultClientId === "ALL" ? "" : String(defaultClientId)));
    const [profile, setProfile] = useState(() => initialProfile(location));
    const [access, setAccess] = useState(() => initialAccess(location));
    const [spaces, setSpaces] = useState<LocationSpace[]>([]);
    const [spaceName, setSpaceName] = useState("");
    const [spaceType, setSpaceType] = useState("other");
    const [suggesting, setSuggesting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void LocationService.getLocationCatalog()
            .then((data) => { if (!cancelled) setCatalog(data); })
            .catch((error) => { if (!cancelled) toast.error(getErrorMessage(error, "No se pudieron cargar los tipos de ubicación.")); })
            .finally(() => { if (!cancelled) setCatalogLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const selectedSiteType = useMemo(
        () => catalog?.site_types.find((siteType) => siteType.id === profile.site_type),
        [catalog, profile.site_type],
    );

    const setAttribute = (id: string, value: LocationProfileAttributeValue) => {
        setProfile((current) => ({ ...current, attributes: { ...current.attributes, [id]: value } }));
    };

    const suggestSpaces = async () => {
        try {
            setSuggesting(true);
            const suggestions = await LocationService.getSpaceSuggestions(profile.site_type, profile.attributes);
            setSpaces((current) => {
                const names = new Set(current.map((space) => space.name.trim().toLocaleLowerCase()));
                return [...current, ...suggestions.filter((space) => !names.has(space.name.trim().toLocaleLowerCase()))];
            });
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudieron sugerir los espacios."));
        } finally {
            setSuggesting(false);
        }
    };

    const addSpace = () => {
        const trimmedName = spaceName.trim();
        if (!trimmedName) return;
        if (spaces.some((space) => space.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
            toast.error("Ya existe un espacio con ese nombre.");
            return;
        }
        setSpaces((current) => [...current, { name: trimmedName, space_type: spaceType, tasks: [] }]);
        setSpaceName("");
        setSpaceType("other");
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!name.trim() || !address.trim() || !city.trim()) {
            setStep(1);
            toast.error("Completa nombre, dirección y ciudad para continuar.");
            return;
        }
        await onSubmit({
            name: name.trim(),
            address: address.trim(),
            city: city.trim(),
            postal_code: postalCode.trim() || undefined,
            client_id: clientId ? Number(clientId) : null,
            profile: cleanProfile(profile),
            access: cleanAccess(access),
            ...(location ? {} : {
                location_type: LEGACY_LOCATION_TYPE_BY_SITE_TYPE[profile.site_type] || "other",
                spaces: spaces.map(({ name, space_type, parent_id, attributes, tasks }) => ({
                    name,
                    space_type,
                    parent_id,
                    attributes,
                    tasks,
                })),
            }),
        });
    };

    const goNext = () => {
        if (step === 1 && (!name.trim() || !address.trim() || !city.trim())) {
            toast.error("Completa nombre, dirección y ciudad para continuar.");
            return;
        }
        setStep((current) => Math.min(4, current + 1));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <LocationWorkspaceWizardProgress step={step} />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
                <section className="space-y-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4 sm:p-5">
                    {step === 1 && <LocationInfoAccessStep clients={clients} name={name} address={address} city={city} postalCode={postalCode} clientId={clientId} access={access} hasStoredAccessCode={Boolean(location?.access?.has_access_code)} setName={setName} setAddress={setAddress} setCity={setCity} setPostalCode={setPostalCode} setClientId={setClientId} setAccess={setAccess} />}
                    {step === 2 && <LocationTypeStep catalog={catalog} loading={catalogLoading} profile={profile} setProfile={setProfile} />}
                    {step === 3 && <LocationFeaturesStep catalog={catalog} profile={profile} setProfile={setProfile} setAttribute={setAttribute} />}
                    {step === 4 && <LocationSpacesStep editingExistingLocation={Boolean(location)} profile={profile} spaces={spaces} spaceName={spaceName} spaceType={spaceType} suggesting={suggesting} setSpaceName={setSpaceName} setSpaceType={setSpaceType} removeSpace={(index) => setSpaces((current) => current.filter((_, currentIndex) => currentIndex !== index))} addSpace={addSpace} suggestSpaces={() => void suggestSpaces()} />}
                </section>
                <LocationWorkspaceSummary name={name} address={address} city={city} siteTypeLabel={selectedSiteType?.label} spacesCount={location ? "Gestionables tras guardar" : spaces.length} accessLabel={access.access_code || location?.access?.has_access_code ? "Código protegido" : access.access_method || "Sin configurar"} />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-4">
                <div>{step > 1 && <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)}>Anterior</Button>}</div>
                <div className="flex gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>{step < 4 ? <Button type="button" onClick={goNext}>Siguiente <ChevronRight className="h-4 w-4" /></Button> : <Button type="submit" disabled={submitting}>{submitting ? "Guardando..." : submitLabel}</Button>}</div>
            </div>
        </form>
    );
}
