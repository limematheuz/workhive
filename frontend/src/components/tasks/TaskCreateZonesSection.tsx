"use client";

import { useMemo } from "react";
import { MapPinned } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
    getLocationZoneTypeLabel,
} from "@/domain/locations/location-zone";
import type { LocationZone } from "@/services/location.service";
import {
    taskFormSectionClass,
    taskFormSectionHeaderClass,
    taskFormSectionHintClass,
    taskFormSectionTitleClass,
} from "./taskFormLayout";


interface TaskCreateZonesSectionProps {
    zones: LocationZone[];
    loading: boolean;
    selectedZoneIds: number[];
    setSelectedZoneIds: (zoneIds: number[]) => void;
    selectedSpaceTaskTemplateIds: number[];
    setSelectedSpaceTaskTemplateIds: (taskIds: number[]) => void;
}

export function TaskCreateZonesSection({
    zones,
    loading,
    selectedZoneIds,
    setSelectedZoneIds,
    selectedSpaceTaskTemplateIds,
    setSelectedSpaceTaskTemplateIds,
}: TaskCreateZonesSectionProps) {
    const selectedZoneIdSet = useMemo(() => new Set(selectedZoneIds), [selectedZoneIds]);
    const selectedSpaceTaskTemplateIdSet = useMemo(
        () => new Set(selectedSpaceTaskTemplateIds),
        [selectedSpaceTaskTemplateIds],
    );
    const zonesById = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);

    if (!loading && zones.length === 0) return null;

    const toggleZone = (zoneId: number) => {
        const wasSelected = selectedZoneIdSet.has(zoneId);
        setSelectedZoneIds(
            wasSelected
                ? selectedZoneIds.filter((id) => id !== zoneId)
                : [...selectedZoneIds, zoneId],
        );
        if (wasSelected) {
            const taskIds = new Set((zonesById.get(zoneId)?.tasks || []).flatMap((task) => task.id ? [task.id] : []));
            setSelectedSpaceTaskTemplateIds(selectedSpaceTaskTemplateIds.filter((taskId) => !taskIds.has(taskId)));
        }
    };

    const toggleSuggestedTask = (zoneId: number, taskId: number) => {
        setSelectedZoneIds(
            selectedZoneIdSet.has(zoneId)
                ? selectedZoneIds
                : [...selectedZoneIds, zoneId],
        );
        setSelectedSpaceTaskTemplateIds(
            selectedSpaceTaskTemplateIdSet.has(taskId)
                ? selectedSpaceTaskTemplateIds.filter((id) => id !== taskId)
                : [...selectedSpaceTaskTemplateIds, taskId],
        );
    };

    return (
        <section className={taskFormSectionClass}>
            <div className={taskFormSectionHeaderClass}>
                <h3 className={`${taskFormSectionTitleClass} flex items-center gap-1.5`}>
                    <MapPinned className="h-4 w-4 text-accent" />
                    Espacios del trabajo
                </h3>
                <p className={taskFormSectionHintClass}>
                    Selecciona solo los espacios que se incluyen en este trabajo. Si no marcas ninguno, se aplica a toda la ubicación.
                </p>
            </div>

            {loading ? (
                <p className="py-2 text-xs text-[var(--text-muted)]">Cargando espacios...</p>
            ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {zones.map((zone) => {
                        const selected = selectedZoneIdSet.has(zone.id);
                        return (
                            <div
                                key={zone.id}
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                                    selected
                                        ? "border-accent/35 bg-accent/10"
                                        : "border-[var(--border-soft)] bg-[var(--bg-card)] hover:bg-[var(--bg-tertiary)]"
                                }`}
                            >
                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                                    <Checkbox
                                        checked={selected}
                                        onCheckedChange={() => toggleZone(zone.id)}
                                        className="h-4 w-4"
                                    />
                                <span className="min-w-0">
                                    <span className="block truncate text-xs font-bold text-[var(--text-main)]">{zone.name}</span>
                                    <span className="text-2xs text-[var(--text-muted)]">{getLocationZoneTypeLabel(zone.zone_type)}</span>
                                </span>
                                </label>
                                {selected && zone.tasks && zone.tasks.length > 0 && (
                                    <div className="ml-7 mt-2 w-full space-y-1 border-t border-[var(--border-soft)] pt-2">
                                        <p className="text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Tareas sugeridas</p>
                                        {zone.tasks.map((task) => task.id && (
                                            <label key={task.id} className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-main)]">
                                                <Checkbox
                                                    checked={selectedSpaceTaskTemplateIdSet.has(task.id)}
                                                    onCheckedChange={() => toggleSuggestedTask(zone.id, task.id as number)}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                                                {task.estimated_minutes && <span className="text-2xs text-[var(--text-muted)]">{task.estimated_minutes} min</span>}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
