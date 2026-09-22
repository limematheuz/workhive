"use client";

import React from "react";
import { MapPin, ChevronUp, ChevronDown, X, Bed, Bath, ChefHat, Sun, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Location } from "@/types/location";
import { PropertyFeatures } from "./utils";
import { useDictionary } from "@/lib/dictionary-context";

interface TechTaskPropertySectionProps {
    expanded: boolean;
    onToggle: () => void;
    location: Location | null;
    locationName: string;
    features: PropertyFeatures;
    isEditingFeatures: boolean;
    setIsEditingFeatures: (editing: boolean) => void;
    canEditLocationDetails: boolean;
    onSaveFeatures: (features: PropertyFeatures) => Promise<void>;
}

type PropertyFeaturesDraft = {
    rooms: string;
    bathrooms: string;
    kitchens: string;
    hasTerrace: "true" | "false";
    hasGarage: "true" | "false";
};

function TechTaskPropertyFeaturesEditor({
    dict,
    features,
    onCancel,
    onSaveFeatures,
}: {
    dict: ReturnType<typeof useDictionary>["dict"];
    features: PropertyFeatures;
    onCancel: () => void;
    onSaveFeatures: (features: PropertyFeatures) => Promise<void>;
}) {
    const [draft, setDraft] = React.useState<PropertyFeaturesDraft>(() => ({
        rooms: String(features.rooms),
        bathrooms: String(features.bathrooms),
        kitchens: String(features.kitchens),
        hasTerrace: String(features.hasTerrace) as "true" | "false",
        hasGarage: String(features.hasGarage) as "true" | "false",
    }));

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await onSaveFeatures({
            rooms: Math.max(0, Number(draft.rooms) || 0),
            bathrooms: Math.max(0, Number(draft.bathrooms) || 0),
            kitchens: Math.max(0, Number(draft.kitchens) || 0),
            hasTerrace: draft.hasTerrace === "true",
            hasGarage: draft.hasGarage === "true",
        });
    };

    return (
        <form data-tech-features-editor onSubmit={save} className="space-y-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-xs shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-2">
                <h4 className="text-2xs font-black uppercase text-[var(--text-main)]">
                    {dict.tech.property_edit}
                </h4>
                <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label={dict.tech.btn_cancel}>
                    <X className="size-4" />
                </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <PropertyNumberInput id="tech-rooms" label={dict.tech.property_rooms} value={draft.rooms} onValueChange={(rooms) => setDraft((current) => ({ ...current, rooms }))} disabled />
                <PropertyNumberInput id="tech-bathrooms" label={dict.tech.property_bathrooms} value={draft.bathrooms} onValueChange={(bathrooms) => setDraft((current) => ({ ...current, bathrooms }))} required />
                <PropertyNumberInput id="tech-kitchens" label={dict.tech.property_kitchens} value={draft.kitchens} onValueChange={(kitchens) => setDraft((current) => ({ ...current, kitchens }))} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <PropertyBooleanSelect id="tech-terrace" label={dict.tech.property_terrace} value={draft.hasTerrace} onValueChange={(hasTerrace) => setDraft((current) => ({ ...current, hasTerrace }))} yesLabel={dict.tech.yes_label} noLabel={dict.tech.no_label} />
                <PropertyBooleanSelect id="tech-garage" label={dict.tech.property_garage} value={draft.hasGarage} onValueChange={(hasGarage) => setDraft((current) => ({ ...current, hasGarage }))} yesLabel={dict.tech.yes_label} noLabel={dict.tech.no_label} />
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-2">
                <Button type="button" variant="outline" onClick={onCancel} className="h-9 px-4 text-xs">
                    {dict.tech.btn_cancel}
                </Button>
                <Button type="submit" className="h-9 px-4 text-xs">
                    {dict.tech.btn_save}
                </Button>
            </div>
        </form>
    );
}

function PropertyNumberInput({
    id,
    label,
    value,
    onValueChange,
    disabled = false,
    required = false,
}: {
    id: string;
    label: string;
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    required?: boolean;
}) {
    return <div className="space-y-1"><Label htmlFor={id} className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">{label}</Label><Input id={id} type="number" min={0} inputMode="numeric" value={value} onChange={(event) => onValueChange(event.target.value)} disabled={disabled} required={required} className="h-9 text-xs" /></div>;
}

function PropertyBooleanSelect({
    id,
    label,
    value,
    onValueChange,
    yesLabel,
    noLabel,
}: {
    id: string;
    label: string;
    value: "true" | "false";
    onValueChange: (value: "true" | "false") => void;
    yesLabel: string;
    noLabel: string;
}) {
    return <div className="space-y-1"><Label htmlFor={id} className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">{label}</Label><Select value={value} onValueChange={(next) => onValueChange(next as "true" | "false")}><SelectTrigger id={id} className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">{yesLabel}</SelectItem><SelectItem value="false">{noLabel}</SelectItem></SelectContent></Select></div>;
}

export function TechTaskPropertySection({
    expanded,
    onToggle,
    location,
    locationName,
    features,
    isEditingFeatures,
    setIsEditingFeatures,
    canEditLocationDetails,
    onSaveFeatures,
}: TechTaskPropertySectionProps) {
    const { dict } = useDictionary();

    return (
        <div className="billing-block overflow-hidden rounded-2xl">
            <button type="button"
                onClick={onToggle}
                className="flex w-full cursor-pointer items-center justify-between border-none px-3.5 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--accent-color)_6%,transparent)]"
            >
                <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <MapPin className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold text-[var(--text-main)]">
                        {dict.tech.property_title}
                    </span>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
            </button>
            {expanded && (
                <div className="space-y-4 border-t border-[var(--border-soft)] px-3.5 py-3.5">
                    {isEditingFeatures ? (
                        <TechTaskPropertyFeaturesEditor
                            key={JSON.stringify(features)}
                            dict={dict}
                            features={features}
                            onCancel={() => setIsEditingFeatures(false)}
                            onSaveFeatures={onSaveFeatures}
                        />
                    ) : (
                        <div className="space-y-4">
                            {/* Features grid */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-4 shadow-2xs">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                                        {dict.tech.property_distribution}
                                    </span>
                                    {canEditLocationDetails && (
                                        <button type="button"
                                            onClick={() => setIsEditingFeatures(true)}
                                            className="flex items-center gap-1 text-[10px] font-black text-accent hover:text-accent transition-colors uppercase tracking-wider bg-transparent border-none cursor-pointer"
                                        >
                                            {dict.tech.property_edit_btn}
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                                    <div className="flex flex-col items-center justify-center p-2 bg-[var(--bg-primary)]/45 border border-[var(--border-soft)] rounded-xl">
                                        <Bed className="w-4 h-4 text-accent mb-1" />
                                        <span className="text-xs font-black text-[var(--text-main)]">{features.rooms}</span>
                                        <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">
                                            {dict.tech.property_rooms_short}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-2 bg-[var(--bg-primary)]/45 border border-[var(--border-soft)] rounded-xl">
                                        <Bath className="w-4 h-4 text-accent mb-1" />
                                        <span className="text-xs font-black text-[var(--text-main)]">{features.bathrooms}</span>
                                        <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">
                                            {dict.tech.property_bathrooms_short}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-2 bg-[var(--bg-primary)]/45 border border-[var(--border-soft)] rounded-xl">
                                        <ChefHat className="w-4 h-4 text-accent mb-1" />
                                        <span className="text-xs font-black text-[var(--text-main)]">{features.kitchens}</span>
                                        <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">
                                            {dict.tech.property_kitchens_short}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-2 bg-[var(--bg-primary)]/45 border border-[var(--border-soft)] rounded-xl">
                                        <Sun className="w-4 h-4 text-accent mb-1" />
                                        <span className="text-xs font-black text-[var(--text-main)]">
                                            {features.hasTerrace ? dict.tech.yes_label : dict.tech.no_label}
                                        </span>
                                        <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">
                                            {dict.tech.property_terrace}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-2 bg-[var(--bg-primary)]/45 border border-[var(--border-soft)] rounded-xl">
                                        <Car className="w-4 h-4 text-accent mb-1" />
                                        <span className="text-xs font-black text-[var(--text-main)]">
                                            {features.hasGarage ? dict.tech.yes_label : dict.tech.no_label}
                                        </span>
                                        <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">
                                            {dict.tech.property_garage}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider">{dict.tech.property_address}</span>
                                    <p className="font-semibold text-[var(--text-main)] mt-0.5">{location?.address || locationName}</p>
                                </div>
                                <div>
                                    <span className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider">{dict.tech.property_city}</span>
                                    <p className="font-semibold text-[var(--text-main)] mt-0.5">{location?.city || "—"}</p>
                                </div>
                                {location?.postal_code && (
                                    <div>
                                        <span className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider">{dict.tech.property_postal_code}</span>
                                        <p className="font-semibold text-[var(--text-main)] mt-0.5">{location.postal_code}</p>
                                    </div>
                                )}
                                <div>
                                    <span className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider">{dict.tech.property_gps}</span>
                                    <p className="font-semibold text-[var(--text-main)] mt-0.5">
                                        {location?.latitude && location?.longitude ? `${location.latitude}, ${location.longitude}` : "—"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
