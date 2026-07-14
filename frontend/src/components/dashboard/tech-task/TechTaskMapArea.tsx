"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { ArrowLeft, Camera, Compass } from "lucide-react";
import { Location } from "@/types/location";
import type { Dictionary } from "@/lib/dictionary-context";
import { resolveApiMediaUrl } from "@/lib/api";
import { buildGoogleMapsEmbedUrl } from "@/lib/google-maps-embed";

interface TechTaskMapAreaProps {
    location: Location | null;
    locationName: string;
    viewMode: "map" | "photo";
    setViewMode: (mode: "map" | "photo") => void;
    onBack: () => void;
    dict: Dictionary;
}

export function TechTaskMapArea({
    location,
    locationName,
    viewMode,
    setViewMode,
    onBack,
    dict,
}: TechTaskMapAreaProps) {
    const addressQuery = useMemo(() => {
        if (!location) return locationName;
        if (location.latitude && location.longitude) {
            return `${location.latitude},${location.longitude}`;
        }
        return `${location.address || ""}, ${location.city || ""}`.trim() || location.name;
    }, [location, locationName]);
    const mapEmbedUrl = buildGoogleMapsEmbedUrl(addressQuery);

    return (
        <div className="h-64 w-full relative border-b border-[var(--border-soft)] bg-zinc-100 dark:bg-zinc-950">
            {viewMode === "map" ? (
                <iframe
                    src={mapEmbedUrl}
                    className="w-full h-full border-none"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={locationName}
                />
            ) : location?.photo_url ? (
                <Image
                    src={resolveApiMediaUrl(location.photo_url) || ""}
                    className="object-cover"
                    alt={locationName}
                    fill
                    sizes="(max-width: 1024px) 100vw, 48rem"
                    unoptimized
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] gap-2">
                    <Camera className="w-8 h-8" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                        {dict.tech?.no_property_photo || "No property photo"}
                    </span>
                </div>
            )}

            {/* Back button */}
            <button
                type="button"
                onClick={onBack}
                className="absolute top-4 left-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 hover:text-zinc-950 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-white dark:border-zinc-700/80 p-2 rounded-full transition-all shadow-md cursor-pointer z-50"
                title={dict.tech.btn_back_to_tasks}
                aria-label={dict.tech.btn_back_to_tasks}
            >
                <ArrowLeft className="w-5 h-5" />
            </button>

            {/* GPS Navigation */}
            <a
                href={location?.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-4 right-4 bg-accent hover:bg-accent-light text-white p-2.5 rounded-full shadow-lg transition-all flex items-center justify-center cursor-pointer border-none scale-100 hover:scale-105"
                title={dict.tech?.navigate_gps || "Navigate with GPS"}
                aria-label={dict.tech?.navigate_gps || "Navigate with GPS"}
            >
                <Compass className="w-5 h-5" />
            </a>

            {/* View Mode Toggle */}
            {location?.photo_url && (
                <div className="absolute bottom-4 right-4 flex bg-white/95 dark:bg-zinc-900/95 p-1 rounded-xl shadow-md border border-[var(--border-soft)]">
                    <button
                        type="button"
                        onClick={() => setViewMode("map")}
                        aria-label={dict.tech?.tab_map || "Map"}
                        className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-colors cursor-pointer border-none ${
                            viewMode === "map"
                                ? "bg-accent text-white"
                                : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        }`}
                    >
                        {dict.tech?.tab_map || "Map"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("photo")}
                        aria-label={dict.tech?.tab_photo || "Photo"}
                        className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-colors cursor-pointer border-none ${
                            viewMode === "photo"
                                ? "bg-accent text-white"
                                : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        }`}
                    >
                        {dict.tech?.tab_photo || "Photo"}
                    </button>
                </div>
            )}
        </div>
    );
}
