"use client";

import React from "react";
import { MapPin, ChevronUp, ChevronDown, X, Bed, Bath, ChefHat, Sun, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
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
                        <div data-tech-features-editor className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-4 space-y-4 shadow-sm text-xs">
                            <div className="flex justify-between items-center border-b border-[var(--border-soft)] pb-2">
                                <h4 className="font-black uppercase text-[var(--text-main)] text-2xs">
                                    {dict.tech.property_edit}
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setIsEditingFeatures(false)}
                                    aria-label={dict.tech.btn_cancel}
                                    className="surface-control-btn p-1 rounded-full cursor-pointer flex items-center justify-center ui-motion"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label htmlFor="tech-rooms" className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider">
                                        {dict.tech.property_rooms}
                                    </label>
                                    <input
                                        id="tech-rooms"
                                        type="number"
                                        name="rooms"
                                        aria-label={dict.tech.property_rooms}
                                        defaultValue={features.rooms}
                                        min={0}
                                        disabled
                                        className="w-full cursor-not-allowed bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-xl px-3 py-2 text-xs opacity-70"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="tech-bathrooms" className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider">
                                        {dict.tech.property_bathrooms}
                                    </label>
                                    <input
                                        id="tech-bathrooms"
                                        type="number"
                                        name="bathrooms"
                                        aria-label={dict.tech.property_bathrooms}
                                        defaultValue={features.bathrooms}
                                        min={0}
                                        required
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="tech-kitchens" className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider">
                                        {dict.tech.property_kitchens}
                                    </label>
                                    <input
                                        id="tech-kitchens"
                                        type="number"
                                        name="kitchens"
                                        aria-label={dict.tech.property_kitchens}
                                        defaultValue={features.kitchens}
                                        min={0}
                                        required
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label htmlFor="tech-terrace" className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider block">
                                        {dict.tech.property_terrace}
                                    </label>
                                    <select
                                        id="tech-terrace"
                                        name="hasTerrace"
                                        aria-label={dict.tech.property_terrace}
                                        defaultValue={features.hasTerrace ? "true" : "false"}
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent"
                                    >
                                        <option value="true">{dict.tech.yes_label}</option>
                                        <option value="false">{dict.tech.no_label}</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="tech-garage" className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider block">
                                        {dict.tech.property_garage}
                                    </label>
                                    <select
                                        id="tech-garage"
                                        name="hasGarage"
                                        aria-label={dict.tech.property_garage}
                                        defaultValue={features.hasGarage ? "true" : "false"}
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent"
                                    >
                                        <option value="true">{dict.tech.yes_label}</option>
                                        <option value="false">{dict.tech.no_label}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-soft)]">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsEditingFeatures(false)}
                                    className="text-xs h-9 rounded-xl px-4 border border-[var(--border-color)]"
                                >
                                    {dict.tech.btn_cancel}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={(e) => {
                                        const root = (e.currentTarget as HTMLElement).closest("[data-tech-features-editor]");
                                        if (!root) return;
                                        const get = (name: string) =>
                                            (root.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null)?.value;
                                        void onSaveFeatures({
                                            rooms: Number(get("rooms")),
                                            bathrooms: Number(get("bathrooms")),
                                            kitchens: Number(get("kitchens")),
                                            hasTerrace: get("hasTerrace") === "true",
                                            hasGarage: get("hasGarage") === "true",
                                        });
                                    }}
                                    className="bg-accent hover:bg-accent-light text-white font-bold text-xs h-9 rounded-xl px-4 border-none cursor-pointer"
                                >
                                    {dict.tech.btn_save}
                                </Button>
                            </div>
                        </div>
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
