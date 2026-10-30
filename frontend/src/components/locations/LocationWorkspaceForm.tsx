"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Compass, Layers3, MapPinned, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDialogDismiss } from "@/components/ui/dialog-form-guard";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PremiumTabsNavigation } from "@/components/ui/premium-tabs";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import type {
    Location,
    LocationCatalog,
    LocationContact,
    LocationProfileAttributeValue,
    LocationRisk,
    LocationServiceWindow,
    LocationSpace,
} from "@/types/location";
import type { Client } from "@/services/client.service";
import { LocationService } from "@/services/location.service";
import {
    OrganizationService,
    type OrganizationDepartment,
    type OrganizationTeam,
} from "@/services/organization.service";
import { useUser } from "@/lib/user-context";
import { LocationFeaturesStep } from "./LocationFeaturesStep";
import { LocationInfoAccessStep } from "./LocationInfoAccessStep";
import { LocationSpacesStep } from "./LocationSpacesStep";
import { LocationTypeStep } from "./LocationTypeStep";
import type {
    LocationAccessDraft,
    LocationProfileDraft,
    LocationWorkspacePayload,
} from "./location-workspace-types";

export type { LocationWorkspacePayload } from "./location-workspace-types";

type LocationWorkspaceStep = "information" | "type" | "operations" | "spaces";

const WORKSPACE_STEPS: Array<{
    id: LocationWorkspaceStep;
    label: string;
    description: string;
    icon: typeof MapPinned;
}> = [
    { id: "information", label: "Información", description: "Datos, cliente y acceso", icon: MapPinned },
    { id: "type", label: "Tipo", description: "Características del lugar", icon: Compass },
    { id: "operations", label: "Operación", description: "Contactos, riesgos y horario", icon: ClipboardList },
    { id: "spaces", label: "Espacios", description: "Zonas y tareas sugeridas", icon: Layers3 },
];

interface LocationWorkspaceFormProps {
    clients: Client[];
    defaultClientId?: number | "ALL";
    location?: Location | null;
    submitting: boolean;
    submitLabel: string;
    onCancel: () => void;
    onSubmit: (payload: LocationWorkspacePayload) => Promise<void>;
    /** Portal callers use the same complete wizard without tenant-only assignments. */
    portalMode?: boolean;
    loadCatalog?: () => Promise<LocationCatalog>;
    loadSpaceSuggestions?: (siteType: string, attributes: Record<string, LocationProfileAttributeValue>) => Promise<LocationSpace[]>;
    requirePostalCode?: boolean;
}

const EMPTY_PROFILE: LocationProfileDraft = {
    site_type: "other",
    internal_code: "",
    site_reference: "",
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
        service_notes: location.profile.service_notes,
        attributes: { ...location.profile.attributes },
    };
}

function initialContacts(location?: Location | null): LocationContact[] {
    if (location?.contacts?.length) return location.contacts.map((contact) => ({ ...contact }));
    const legacy = location?.profile;
    if (!legacy?.contact_name || (!legacy.contact_email && !legacy.contact_phone)) return [];
    return [{
        draft_id: "legacy-location-contact",
        full_name: legacy.contact_name,
        email: legacy.contact_email,
        phone: legacy.contact_phone,
        role: "general",
        is_primary: true,
        is_active: true,
    }];
}

function initialRisks(location?: Location | null): LocationRisk[] {
    return location?.risks?.map((risk) => ({ ...risk })) || [];
}

function initialServiceWindows(location?: Location | null): LocationServiceWindow[] {
    return location?.service_windows?.map((serviceWindow) => ({
        ...serviceWindow,
        days: [...serviceWindow.days],
    })) || [];
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

function cleanProfile(profile: LocationProfileDraft, existing = false) {
    const attributes = Object.fromEntries(Object.entries(profile.attributes).filter(([, value]) => value !== ""));
    const values = {
        ...profile,
        attributes,
        internal_code: profile.internal_code?.trim() || undefined,
        site_reference: profile.site_reference?.trim() || undefined,
        service_notes: profile.service_notes?.trim() || undefined,
    };
    const hasOptionalValues = Object.entries(values).some(([key, value]) => key !== "site_type" && key !== "attributes" && Boolean(value));
    return existing || profile.site_type !== "other" || Object.keys(attributes).length > 0 || hasOptionalValues ? values : undefined;
}

function cleanAccess(access: LocationAccessDraft, existing = false) {
    const values = {
        ...access,
        permitted_from: access.permitted_from?.trim() || null,
        permitted_until: access.permitted_until?.trim() || null,
        access_method: access.access_method?.trim() || null,
        keys_location: access.keys_location?.trim() || null,
        key_custodian: access.key_custodian?.trim() || null,
        instructions: access.instructions?.trim() || null,
        access_code: access.access_code.trim() || undefined,
    };
    const hasDetails = values.permitted_days.length > 0 || Object.entries(values).some(([key, value]) => !["permitted_days", "clear_access_code"].includes(key) && Boolean(value));
    return existing || hasDetails || access.keys_available === false || access.clear_access_code ? values : undefined;
}

export function LocationWorkspaceForm({
    clients,
    defaultClientId = "ALL",
    location,
    submitting,
    submitLabel,
    onCancel,
    onSubmit,
    requirePostalCode = false,
    portalMode = false,
    loadCatalog = LocationService.getLocationCatalog,
    loadSpaceSuggestions = LocationService.getSpaceSuggestions,
}: LocationWorkspaceFormProps) {
    const dismiss = useDialogDismiss(onCancel);
    const { user } = useUser();
    const [catalog, setCatalog] = useState<LocationCatalog | null>(null);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [activeStep, setActiveStep] = useState<LocationWorkspaceStep>("information");
    const [name, setName] = useState(location?.name || "");
    const [address, setAddress] = useState(location?.address || "");
    const [city, setCity] = useState(location?.city || "");
    const [postalCode, setPostalCode] = useState(location?.postal_code || "");
    const [clientId, setClientId] = useState(() => location?.client_id?.toString() || (defaultClientId === "ALL" ? "" : String(defaultClientId)));
    const [departments, setDepartments] = useState<OrganizationDepartment[]>([]);
    const [teams, setTeams] = useState<OrganizationTeam[]>([]);
    const [organizationAssignmentAvailable, setOrganizationAssignmentAvailable] = useState(false);
    const [departmentId, setDepartmentId] = useState(() => location?.department_id?.toString() || "");
    const [teamId, setTeamId] = useState(() => location?.team_id?.toString() || "");
    const [profile, setProfile] = useState(() => initialProfile(location));
    const [access, setAccess] = useState(() => initialAccess(location));
    const [contacts, setContacts] = useState(() => initialContacts(location));
    const [risks, setRisks] = useState(() => initialRisks(location));
    const [serviceWindows, setServiceWindows] = useState(() => initialServiceWindows(location));
    const [spaces, setSpaces] = useState<LocationSpace[]>([]);
    const [spaceName, setSpaceName] = useState("");
    const [spaceType, setSpaceType] = useState("other");
    const [suggesting, setSuggesting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void loadCatalog()
            .then((data) => { if (!cancelled) setCatalog(data); })
            .catch((error) => { if (!cancelled) toast.error(getErrorMessage(error, "No se pudieron cargar los tipos de ubicación.")); })
            .finally(() => { if (!cancelled) setCatalogLoading(false); });
        return () => { cancelled = true; };
    }, [loadCatalog]);

    const canConfigureOrganizationAssignment = !portalMode && (!location || location.owner_company_id == null || location.owner_company_id === user?.company_id);

    useEffect(() => {
        if (!canConfigureOrganizationAssignment) return;
        let cancelled = false;
        void Promise.all([
            OrganizationService.getDepartments(),
            OrganizationService.getTeams(),
        ])
            .then(([departmentData, teamData]) => {
                if (cancelled) return;
                setDepartments(departmentData);
                setTeams(teamData);
                setOrganizationAssignmentAvailable(true);
            })
            .catch(() => {
                if (!cancelled) setOrganizationAssignmentAvailable(false);
            });
        return () => { cancelled = true; };
    }, [canConfigureOrganizationAssignment]);

    const setAttribute = (id: string, value: LocationProfileAttributeValue) => {
        setProfile((current) => ({ ...current, attributes: { ...current.attributes, [id]: value } }));
    };

    const suggestSpaces = async () => {
        try {
            setSuggesting(true);
            const suggestions = await loadSpaceSuggestions(profile.site_type, profile.attributes);
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
        if (submitting) return;
        if (activeStep !== "spaces") { goNext(); return; }
        if (!name.trim() || !address.trim() || !city.trim() || (requirePostalCode && !postalCode.trim())) {
            setActiveStep("information");
            toast.error(requirePostalCode ? "Completa nombre, dirección, ciudad y código postal." : "Completa nombre, dirección y ciudad para continuar.");
            return;
        }
        if (contacts.some((contact) => !contact.full_name.trim() || (!contact.phone?.trim() && !contact.email?.trim()))) {
            setActiveStep("operations");
            toast.error("Cada contacto operativo necesita nombre y teléfono o email.");
            return;
        }
        if (contacts.filter((contact) => contact.is_primary).length > 1) {
            setActiveStep("operations");
            toast.error("Elige un único contacto principal para esta ubicación.");
            return;
        }
        if (risks.some((risk) => !risk.title.trim())) {
            setActiveStep("operations");
            toast.error("Cada riesgo operativo necesita un título.");
            return;
        }
        if (serviceWindows.some((serviceWindow) => !serviceWindow.days.length || serviceWindow.ends_at <= serviceWindow.starts_at)) {
            setActiveStep("operations");
            toast.error("Cada horario de servicio necesita días y una hora de fin posterior a la de inicio.");
            return;
        }
        await onSubmit({
            name: name.trim(),
            address: address.trim(),
            city: city.trim(),
            postal_code: postalCode.trim() || undefined,
            ...(portalMode ? {} : { client_id: clientId ? Number(clientId) : null }),
            ...(canConfigureOrganizationAssignment ? {
                department_id: departmentId ? Number(departmentId) : null,
                team_id: teamId ? Number(teamId) : null,
            } : {}),
            profile: cleanProfile(profile, Boolean(location?.profile)),
            access: cleanAccess(access, Boolean(location?.access)),
            contacts: contacts.map(({ draft_id, location_id, ...contact }) => {
                // These are local/server identifiers, never editable form data.
                void draft_id;
                void location_id;
                return {
                    ...contact,
                    full_name: contact.full_name.trim(),
                    email: contact.email?.trim() || undefined,
                    phone: contact.phone?.trim() || undefined,
                };
            }),
            risks: risks.map(({ draft_id, location_id, ...risk }) => {
                void draft_id;
                void location_id;
                return {
                    ...risk,
                    title: risk.title.trim(),
                    description: risk.description?.trim() || undefined,
                    mitigation_notes: risk.mitigation_notes?.trim() || undefined,
                };
            }),
            service_windows: serviceWindows.map(({ draft_id, location_id, ...serviceWindow }) => {
                void draft_id;
                void location_id;
                return {
                    ...serviceWindow,
                    label: serviceWindow.label?.trim() || undefined,
                    notes: serviceWindow.notes?.trim() || undefined,
                };
            }),
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

    const activeStepIndex = WORKSPACE_STEPS.findIndex((step) => step.id === activeStep);
    const isInformationComplete = Boolean(name.trim() && address.trim() && city.trim() && (!requirePostalCode || postalCode.trim()));

    const goToStep = (nextStep: LocationWorkspaceStep) => {
        setActiveStep(nextStep);
    };

    const goNext = () => {
        if (activeStep === "information" && !isInformationComplete) {
            toast.error(requirePostalCode ? "Completa nombre, dirección, ciudad y código postal para continuar." : "Completa nombre, dirección y ciudad para continuar.");
            return;
        }
        const nextStep = WORKSPACE_STEPS[activeStepIndex + 1];
        if (nextStep) setActiveStep(nextStep.id);
    };

    const goPrevious = () => {
        const previousStep = WORKSPACE_STEPS[activeStepIndex - 1];
        if (previousStep) setActiveStep(previousStep.id);
    };

    return (
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
            <Tabs value={activeStep} onValueChange={(value) => goToStep(value as LocationWorkspaceStep)} className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-primary)] px-4 py-3 sm:px-6 sm:py-4 lg:px-7">
                    <PremiumTabsNavigation
                        tabs={WORKSPACE_STEPS.map((step, index) => ({
                            id: step.id, icon: step.icon,
                            label: <span className="flex flex-col text-left"><span>{index + 1}. {step.label}</span><span className="text-[11px] font-normal normal-case">{step.description}</span></span>,
                            compactLabel: `${index + 1}. ${step.label}`,
                        }))}
                        activeTab={activeStep}
                        onChange={goToStep}
                        mobileLabel="Pasos de la ubicación"
                        className="mb-0"
                    />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-7">
                    <TabsContent value="information" aria-labelledby={undefined} aria-label="Información" className="m-0 mx-auto w-full max-w-5xl"><LocationInfoAccessStep clients={clients} showClientAssignment={!portalMode} requirePostalCode={requirePostalCode} name={name} address={address} city={city} postalCode={postalCode} clientId={clientId} departments={departments} teams={teams} organizationAssignmentAvailable={organizationAssignmentAvailable} departmentId={departmentId} teamId={teamId} access={access} hasStoredAccessCode={Boolean(location?.access?.has_access_code)} setName={setName} setAddress={setAddress} setCity={setCity} setPostalCode={setPostalCode} setClientId={setClientId} setDepartmentId={setDepartmentId} setTeamId={setTeamId} setAccess={setAccess} /></TabsContent>
                    <TabsContent value="type" aria-labelledby={undefined} aria-label="Tipo" className="m-0 mx-auto w-full max-w-5xl"><LocationTypeStep catalog={catalog} loading={catalogLoading} profile={profile} setProfile={setProfile} /></TabsContent>
                    <TabsContent value="operations" aria-labelledby={undefined} aria-label="Operación" className="m-0 mx-auto w-full max-w-5xl"><LocationFeaturesStep catalog={catalog} profile={profile} setProfile={setProfile} setAttribute={setAttribute} contacts={contacts} setContacts={setContacts} risks={risks} setRisks={setRisks} serviceWindows={serviceWindows} setServiceWindows={setServiceWindows} /></TabsContent>
                    <TabsContent value="spaces" aria-labelledby={undefined} aria-label="Espacios" className="m-0 mx-auto w-full max-w-5xl"><LocationSpacesStep editingExistingLocation={Boolean(location)} profile={profile} spaces={spaces} spaceName={spaceName} spaceType={spaceType} suggesting={suggesting} setSpaceName={setSpaceName} setSpaceType={setSpaceType} removeSpace={(index) => setSpaces((current) => current.filter((_, currentIndex) => currentIndex !== index))} addSpace={addSpace} suggestSpaces={() => void suggestSpaces()} /></TabsContent>
                </div>
            </Tabs>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-soft)] bg-[var(--bg-primary)] px-4 py-4 sm:px-6 lg:px-7">
                <div>{activeStepIndex > 0 && <Button type="button" variant="secondary" onClick={goPrevious}><ChevronLeft className="h-4 w-4" />Anterior</Button>}</div>
                <div className="flex gap-2"><Button type="button" variant="cancel" onClick={dismiss}>Cancelar</Button>{activeStep !== "spaces" ? <Button key="next" type="button" onClick={goNext}>Siguiente <ChevronRight className="h-4 w-4" /></Button> : <Button key="save" type="submit" disabled={submitting}>{submitting ? "Guardando..." : submitLabel}</Button>}</div>
            </div>
        </form>
    );
}
