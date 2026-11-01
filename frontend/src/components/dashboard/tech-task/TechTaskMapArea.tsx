"use client";

import { ExternalLink } from "lucide-react";
import { Location } from "@/types/location";
import type { Dictionary } from "@/lib/dictionary-context";
import { getLocationNavigationHref } from "@/lib/location-map-url";
import { Button } from "@/components/ui/button";
import { getLocationHeroFallbackGradient } from "./utils";

interface TechTaskMapAreaProps {
    location: Location | null;
    locationName: string;
    dict: Dictionary;
}

export function TechTaskMapArea({
    location,
    locationName,
    dict,
}: TechTaskMapAreaProps) {
    const mapsHref = getLocationNavigationHref(location);

    const addressLine = [location?.address, location?.city].filter(Boolean).join(", ");
    const fallbackGradient = getLocationHeroFallbackGradient(locationName);

    return (
        <div className="tech-task-map-area relative h-52 w-full shrink-0 overflow-hidden sm:h-56">
            {/* Layer 1: location fallback background */}
            <div className="tech-task-hero-media absolute inset-0 z-0 overflow-hidden" aria-hidden>
                <div className="tech-task-hero-fallback" style={{ background: fallbackGradient }} />
            </div>

            {/* Layer 2: dark scrim between background and copy */}
            <div className="tech-task-hero-scrim absolute inset-0 z-[1]" aria-hidden />

            {/* Layer 3: high-contrast copy + GPS CTA */}
            <div className="relative z-[2] flex h-full flex-col items-center justify-center px-5 pb-4 pt-10 text-center sm:px-8">
                <p className="max-w-[20rem] text-base font-semibold tracking-tight text-white drop-shadow-sm sm:text-lg">
                    {locationName}
                </p>
                {addressLine ? (
                    <p className="mt-1 max-w-[22rem] text-xs font-medium leading-snug text-white/90">
                        {addressLine}
                    </p>
                ) : null}
                {mapsHref && <Button
                    asChild
                    size="sm"
                    className="mt-4 h-9 rounded-xl border-white/15 bg-accent px-3.5 text-xs font-semibold text-white shadow-md shadow-black/25 hover:bg-accent-light"
                >
                    <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                        {dict.tech?.navigate_gps || "Abrir en Maps"}
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </Button>}
            </div>
        </div>
    );
}
