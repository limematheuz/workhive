"use client";

import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLocationTypeLabel, normalizeLocationType } from "@/domain/locations/location-type";
import { Location } from "@/services/location.service";

type ClientDetailLocationsTabProps = {
    locations: Location[];
    labels: {
        no_locations?: string;
        ver_tareas?: string;
        type_private?: string;
        type_real_estate?: string;
        type_business?: string;
        type_exterior?: string;
        type_other?: string;
    };
    onViewLocationTasks: (location: Location) => void;
    onClose: () => void;
};

export function ClientDetailLocationsTab({
    locations,
    labels,
    onViewLocationTasks,
    onClose,
}: ClientDetailLocationsTabProps) {
    if (locations.length === 0) {
        return (
            <div className="text-center py-8 text-xs font-semibold text-[var(--text-muted)] italic">
                {labels.no_locations || "This client has no assigned locations."}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {locations.map(loc => (
                <div
                    key={loc.id}
                    className="p-3 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-2xl hover:border-[var(--border-color)] transition-colors group space-y-2.5"
                >
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-[var(--text-main)]">
                            {loc.name}
                        </span>
                        {loc.location_type && (
                            <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 rounded-full font-bold uppercase shrink-0 ${
                                    normalizeLocationType(loc.location_type) === "real_estate"
                                        ? "bg-accent/10 text-accent border-accent/20"
                                        : "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                }`}
                            >
                                {getLocationTypeLabel(loc.location_type, {
                                    private: labels.type_private,
                                    real_estate: labels.type_real_estate,
                                    business: labels.type_business,
                                    exterior: labels.type_exterior,
                                    other: labels.type_other,
                                })}
                            </Badge>
                        )}
                    </div>
                    <span className="text-2xs text-[var(--text-muted)] font-semibold block">
                        {loc.address}, {loc.city}
                    </span>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border-soft)]/50">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                onClose();
                                onViewLocationTasks(loc);
                            }}
                            className="h-7 text-3xs font-black uppercase border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)] rounded-xl gap-1"
                        >
                            <span className="hidden sm:inline">{labels.ver_tareas || "View Tasks"}</span>
                            <span className="sm:hidden">View</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
