"use client";

import { useState } from "react";
import { MapPinned, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    getLocationZoneTypeLabel,
    LOCATION_ZONE_TYPE_OPTIONS,
} from "@/domain/locations/location-zone";
import { useLocationZones } from "@/hooks/useLocationZones";
import { toast } from "@/lib/toast";
import { LocationService } from "@/services/location.service";


interface LocationZonesTabProps {
    locationId: number;
    open: boolean;
    canManage: boolean;
}

export function LocationZonesTab({ locationId, open, canManage }: LocationZonesTabProps) {
    const { zones, loading, reload } = useLocationZones(locationId, open);
    const [name, setName] = useState("");
    const [zoneType, setZoneType] = useState("other");
    const [saving, setSaving] = useState(false);

    const addZone = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        try {
            setSaving(true);
            await LocationService.createZone(locationId, {
                name: trimmedName,
                zone_type: zoneType,
            });
            setName("");
            setZoneType("other");
            await reload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo crear la zona");
        } finally {
            setSaving(false);
        }
    };

    const archiveZone = async (zoneId: number) => {
        try {
            await LocationService.archiveZone(locationId, zoneId);
            await reload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo eliminar la zona");
        }
    };

    return (
        <div className="space-y-5">
            <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                <p className="text-sm font-semibold text-[var(--text-main)]">Zonas de trabajo</p>
                <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
                    Opcional. Úsalas para planificar solo partes concretas de esta ubicación.
                </p>
            </div>

            {canManage && (
                <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        Añadir zona
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_auto]">
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void addZone();
                                }
                            }}
                            placeholder="Ej.: Baño 1"
                            maxLength={100}
                            className="h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-accent"
                        />
                        <select
                            value={zoneType}
                            onChange={(event) => setZoneType(event.target.value)}
                            aria-label="Tipo de zona"
                            className="h-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2 text-xs text-[var(--text-main)] outline-none focus:border-accent"
                        >
                            {LOCATION_ZONE_TYPE_OPTIONS.map((type) => (
                                <option key={type} value={type}>{getLocationZoneTypeLabel(type)}</option>
                            ))}
                        </select>
                        <Button
                            type="button"
                            onClick={() => void addZone()}
                            disabled={saving || !name.trim()}
                            className="h-9 rounded-lg bg-[var(--btn-primary-bg)] px-4 text-xs font-semibold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]"
                        >
                            Añadir
                        </Button>
                    </div>
                </div>
            )}

            {loading ? (
                <p className="py-4 text-center text-xs text-[var(--text-muted)]">Cargando zonas...</p>
            ) : zones.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-soft)] px-4 py-5 text-center text-xs text-[var(--text-muted)]">
                    Esta ubicación funciona como siempre. Añade zonas solo si necesitas dividir los trabajos.
                </div>
            ) : (
                <div className="space-y-2">
                    {zones.map((zone) => (
                        <div
                            key={zone.id}
                            className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-3"
                        >
                            <MapPinned className="h-4 w-4 shrink-0 text-accent" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-[var(--text-main)]">{zone.name}</p>
                                <p className="text-xs text-[var(--text-muted)]">{getLocationZoneTypeLabel(zone.zone_type)}</p>
                            </div>
                            {canManage && (
                                <button
                                    type="button"
                                    aria-label={`Eliminar ${zone.name}`}
                                    onClick={() => void archiveZone(zone.id)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
