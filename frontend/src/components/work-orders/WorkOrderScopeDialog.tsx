"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SpaceWorkforceEditor } from "@/components/operations/SpaceWorkforceEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { LocationWorkspaceService } from "@/services/location-workspace.service";
import { planningRequest, workforceChoices, type SpaceAllocation, type WorkforceChoices } from "@/services/service-planning.service";
import type { LocationSpace } from "@/types/location";
import type { WorkOrder } from "@/types/work-order";

type ScopeDialogProps = { order: WorkOrder; open: boolean; onOpenChange: (open: boolean) => void; updated: () => void };
type ScopeData = { spaces: LocationSpace[]; choices: WorkforceChoices; selection: SpaceAllocation[] };

function ScopeEditor({ order, onOpenChange, updated }: Omit<ScopeDialogProps, "open">) {
    const [data, setData] = useState<ScopeData | null>(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let cancelled = false;
        void Promise.all([
            planningRequest<SpaceAllocation[]>(`service-planning/${order.id}`),
            LocationWorkspaceService.getSpaces(order.location_id),
            workforceChoices(order.location_id),
        ]).then(([selection, spaces, choices]) => {
            if (!cancelled) setData({ selection, spaces, choices });
        }).catch(cause => {
            if (!cancelled) setError(getErrorMessage(cause, "No se pudo cargar el alcance de este trabajo."));
        });
        return () => { cancelled = true; };
    }, [order.id, order.location_id, attempt]);
    const closed = order.status === "completed" || order.status === "cancelled";
    const missingTasks = data?.selection.some(row => !row.task_ids.length);
    const save = async () => {
        if (!data || closed || !data.selection.length || missingTasks) return;
        setSaving(true); setError("");
        try {
            await planningRequest<SpaceAllocation[]>(`service-planning/${order.id}`, { spaces: data.selection }, "PUT");
            toast.success("Alcance guardado para las próximas ejecuciones.");
            updated(); onOpenChange(false);
        } catch (cause) {
            setError(getErrorMessage(cause, "No se pudo guardar el alcance del trabajo."));
        } finally {
            setSaving(false);
        }
    };
    return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
        <div className="rounded-xl border border-[var(--border-soft)] bg-muted/40 p-3 text-sm"><p className="font-medium">Solo para próximas ejecuciones</p><p className="mt-1 text-xs text-muted-foreground">Los cambios de espacios, tareas y personas se aplicarán al generar nuevas ejecuciones. Las tareas ya creadas, iniciadas o finalizadas conservan su alcance y su historial.</p></div>
        {!data && !error && <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="size-4 animate-spin" />Cargando espacios y asignaciones…</p>}
        {data && <SpaceWorkforceEditor spaces={data.spaces} choices={data.choices} value={data.selection} onChange={selection => setData({ ...data, selection })} disabled={saving || closed} />}
        {closed && <p className="text-sm text-orange-700 dark:text-orange-300">Este trabajo está cerrado. Crea un nuevo trabajo para ampliar su alcance.</p>}
        {missingTasks && <p className="text-sm text-orange-700 dark:text-orange-300">Cada espacio incluido debe tener al menos una tarea seleccionada.</p>}
        {error && <div role="alert" className="space-y-2 rounded-xl border border-orange-300/50 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300"><p>{error}</p>{!data && <Button type="button" size="sm" variant="outline" onClick={() => { setError(""); setAttempt(current => current + 1); }}>Volver a cargar</Button>}</div>}
        <DialogFooter><Button type="button" variant="cancel" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving || !data?.selection.length || missingTasks || closed}>{saving && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}Guardar para próximas ejecuciones</Button></DialogFooter>
    </form>;
}

export function WorkOrderScopeDialog({ order, open, onOpenChange, updated }: ScopeDialogProps) {
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent confirmDiscard className="max-h-[92dvh] overflow-y-auto sm:max-w-6xl"><DialogHeader><DialogTitle>Espacios y personas del servicio</DialogTitle><DialogDescription>{order.title} · Ajusta el alcance de las futuras ejecuciones.</DialogDescription></DialogHeader><ScopeEditor key={`${order.id}:${order.location_id}`} order={order} onOpenChange={onOpenChange} updated={updated} /></DialogContent></Dialog>;
}
