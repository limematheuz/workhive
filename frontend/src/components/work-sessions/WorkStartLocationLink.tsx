"use client";

import { MapPinned } from "lucide-react";
import { buildWorkStartMapUrl } from "@/lib/work-start-location";

interface WorkStartLocationLinkProps {
    latitude: number;
    longitude: number;
    label: string;
    accuracyMeters?: number | null;
    className?: string;
}

export function WorkStartLocationLink({
    latitude,
    longitude,
    label,
    accuracyMeters,
    className = "",
}: WorkStartLocationLinkProps) {
    return (
        <a
            href={buildWorkStartMapUrl(latitude, longitude)}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1.5 font-bold text-accent hover:text-accent hover:underline dark:text-accent ${className}`}
        >
            <MapPinned className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
            {accuracyMeters !== null && accuracyMeters !== undefined && (
                <span className="font-medium text-[var(--text-muted)]">
                    ±{Math.round(accuracyMeters)} m
                </span>
            )}
        </a>
    );
}
