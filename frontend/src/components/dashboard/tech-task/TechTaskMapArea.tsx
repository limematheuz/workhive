"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { Camera, Compass } from "lucide-react";
import { Location } from "@/types/location";
import type { Dictionary } from "@/lib/dictionary-context";
import { resolveApiMediaUrl } from "@/lib/api";
import { buildGoogleMapsEmbedUrl } from "@/lib/google-maps-embed";

interface TechTaskMapAreaProps {
    location: Location | null;
    locationName: string;
    viewMode: "map" | "photo";
    setViewMode: (mode: "map" | "photo") => void;
    dict: Dictionary;
}

export function TechTaskMapArea({
    location,
    locationName,
    viewMode,
    setViewMode,
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
    const mapsHref =
        location?.map_url
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`;

    return (
        <div className="relative h-56 w-full shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)] sm:h-60">
            {viewMode === "map" ? (
                <iframe
                    src={mapEmbedUrl}
                    className="h-full w-full border-none"
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
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                    <Camera className="h-8 w-8" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                        {dict.tech?.no_property_photo || "No property photo"}
                    </span>
                </div>
            )}

            <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-4 left-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-accent text-white shadow-md transition-all hover:scale-105 hover:bg-accent-light"
                title={dict.tech?.navigate_gps || "Navigate with GPS"}
                aria-label={dict.tech?.navigate_gps || "Navigate with GPS"}
            >
                <Compass className="h-5 w-5" />
            </a>

            {location?.photo_url && (
                <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 rounded-xl border border-[var(--border-soft)] bg-[var(--glass-chrome-bg)] p-1 shadow-md backdrop-blur-[var(--glass-blur)]">
                    <button
                        type="button"
                        onClick={() => setViewMode("map")}
                        aria-label={dict.tech?.tab_map || "Map"}
                        className={`cursor-pointer rounded-lg border-none px-3 py-1 text-[9px] font-black uppercase transition-colors ${
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
                        className={`cursor-pointer rounded-lg border-none px-3 py-1 text-[9px] font-black uppercase transition-colors ${
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
