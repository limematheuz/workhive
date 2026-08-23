"use client";

import { useCallback, useEffect, useState } from "react";
import { ListChecks, MapPinned, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { LocationService } from "@/services/location.service";
import type { LocationSpace } from "@/types/location";

interface LocationSpacesTabProps {
    locationId: number;
    open: boolean;
    canManage: boolean;
}

export function LocationSpacesTab({ locationId, open, canManage }: LocationSpacesTabProps) {
    const [spaces, setSpaces] = useState<LocationSpace[]>([]);
    const [loading, setLoading] = useState(false);
    const [spaceName, setSpaceName] = useState("");
    const [spaceType, setSpaceType] = useState("other");
    const [parentSpaceId, setParentSpaceId] = useState("");
    const [taskTitles, setTaskTitles] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);

    const reload = useCallback(async () => {
        if (!open) return;
        try {
            setLoading(true);
            setSpaces(await LocationService.getSpaces(locationId));
        } catch (error) {
            setSpaces([]);
            toast.error(getErrorMessage(error, "No se pudieron cargar los espacios."));
        } finally {
            setLoading(false);
        }
    }, [locationId, open]);

    useEffect(() => {
        void Promise.resolve().then(reload);
    }, [reload]);

    const addSpace = async () => {
        if (!spaceName.trim()) return;
        try {
            setSaving(true);
            await LocationService.createSpace(locationId, {
                name: spaceName.trim(),
                space_type: spaceType,
                parent_id: parentSpaceId ? Number(parentSpaceId) : null,
                attributes: {},
                tasks: [],
            });
            setSpaceName("");
            setSpaceType("other");
            setParentSpaceId("");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo crear el espacio."));
        } finally {
            setSaving(false);
        }
    };

    const addTask = async (space: LocationSpace) => {
        const title = taskTitles[space.id || 0]?.trim();
        if (!space.id || !title) return;
        try {
            setSaving(true);
            await LocationService.createSpaceTask(locationId, space.id, {
                title,
                category: "cleaning",
            });
            setTaskTitles((current) => ({ ...current, [space.id as number]: "" }));
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo añadir la tarea."));
        } finally {
            setSaving(false);
        }
    };

    const archiveSpace = async (space: LocationSpace) => {
        if (!space.id) return;
        try {
            await LocationService.archiveSpace(locationId, space.id);
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo eliminar el espacio."));
        }
    };

    const archiveTask = async (space: LocationSpace, taskId?: number) => {
        if (!space.id || !taskId) return;
        try {
            await LocationService.archiveSpaceTask(locationId, space.id, taskId);
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo eliminar la tarea."));
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                <p className="text-sm font-semibold text-[var(--text-main)]">Espacios de trabajo</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Son opcionales. Permiten preparar trabajos con las tareas correctas para cada parte de la ubicación.</p>
            </div>

            {canManage && <div className="grid gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 sm:grid-cols-[1fr_10rem_11rem_auto]">
                <Input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addSpace(); } }} placeholder="Ej.: Baño 1" maxLength={100} />
                <select value={spaceType} onChange={(event) => setSpaceType(event.target.value)} className="h-10 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-main)]"><option value="other">Otro</option><option value="bathroom">Baño</option><option value="office">Despacho</option><option value="kitchen">Cocina</option><option value="common_area">Zona común</option></select>
                <select value={parentSpaceId} onChange={(event) => setParentSpaceId(event.target.value)} aria-label="Espacio padre" className="h-10 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-main)]"><option value="">Sin espacio padre</option>{spaces.map((space) => space.id && <option key={space.id} value={space.id}>{space.name}</option>)}</select>
                <Button type="button" onClick={() => void addSpace()} disabled={saving || !spaceName.trim()}><Plus className="h-3.5 w-3.5" /> Añadir</Button>
            </div>}

            {loading ? <p className="py-6 text-center text-xs text-[var(--text-muted)]">Cargando espacios...</p> : spaces.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--border-soft)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">Esta ubicación funciona sin espacios configurados. Añádelos solo cuando aporten claridad.</p> : <div className="space-y-3">{spaces.map((space) => <article key={space.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3"><div className="flex items-center gap-3"><MapPinned className="h-4 w-4 shrink-0 text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--text-main)]">{space.name}</p><p className="text-xs text-[var(--text-muted)]">{space.parent_id ? `Dentro de ${spaces.find((candidate) => candidate.id === space.parent_id)?.name || "otro espacio"} · ` : ""}{space.space_type}</p></div>{canManage && <button type="button" aria-label={`Eliminar ${space.name}`} onClick={() => void archiveSpace(space)} className="text-[var(--text-muted)] hover:text-red-500"><Trash2 className="h-4 w-4" /></button>}</div><div className="mt-3 border-t border-[var(--border-soft)] pt-3"><p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]"><ListChecks className="h-3.5 w-3.5" /> Tareas sugeridas</p>{space.tasks?.length ? <ul className="space-y-1.5">{space.tasks.map((task) => <li key={task.id || task.title} className="flex items-center gap-2 text-xs text-[var(--text-main)]"><span className="min-w-0 flex-1">{task.title}</span>{task.estimated_minutes && <span className="text-[var(--text-muted)]">{task.estimated_minutes} min</span>}{canManage && <button type="button" aria-label={`Eliminar ${task.title}`} onClick={() => void archiveTask(space, task.id)} className="text-[var(--text-muted)] hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}</li>)}</ul> : <p className="text-xs text-[var(--text-muted)]">Aún no hay tareas sugeridas.</p>}{canManage && <div className="mt-3 flex gap-2"><Input value={taskTitles[space.id || 0] || ""} onChange={(event) => setTaskTitles((current) => ({ ...current, [space.id || 0]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addTask(space); } }} placeholder="Añadir tarea" maxLength={160} /><Button type="button" variant="secondary" size="sm" onClick={() => void addTask(space)} disabled={saving || !taskTitles[space.id || 0]?.trim()}><Plus className="h-3.5 w-3.5" /></Button></div>}</div></article>)}</div>}
        </div>
    );
}
