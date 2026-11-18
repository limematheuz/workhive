"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SpaceWorkforceEditor } from "./SpaceWorkforceEditor";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { readTaskSpaceScope, saveTaskSpaceScope, type TaskSpaceScope } from "@/services/task-space-scope.service";
import type { SpaceAllocation } from "@/services/service-planning.service";

type Props = {
    taskId: number;
    locationId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    updated: () => void;
};

function ScopeForm({ taskId, locationId, close, updated }: Omit<Props, "open" | "onOpenChange"> & { close: () => void }) {
    const [data, setData] = useState<TaskSpaceScope | null>(null);
    const [spaces, setSpaces] = useState<SpaceAllocation[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [revision, setRevision] = useState(0);
    const request = useCallback(() => readTaskSpaceScope(taskId), [taskId]);
    const receive = useCallback((result: TaskSpaceScope) => {
        if (result.location_id !== locationId) throw new Error("La ubicación de este trabajo ha cambiado. Actualiza el listado antes de editar su reparto.");
        setData(result); setSpaces(result.spaces); setError("");
    }, [locationId]);
    const failed = useCallback((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo consultar el reparto."), []);
    useResourceEffect(true, `${taskId}:${locationId}:${revision}`, request, receive, failed);
    const available = new Map(data?.available_spaces.map(space => [space.id, space]));
    const stale = spaces.some(selection => !available.has(selection.space_id) || selection.task_ids.some(id => !available.get(selection.space_id)?.tasks?.some(task => task.id === id)));
    const dirty = data && JSON.stringify(spaces) !== JSON.stringify(data.spaces);
    const tooManyTasks = spaces.reduce((sum, space) => sum + space.task_ids.length, 0) > 200;

    return <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError("");
        try {
            await saveTaskSpaceScope(taskId, spaces);
            toast.success("Reparto actualizado."); updated(); close();
        } catch (reason) { failed(reason); } finally { setBusy(false); }
    }}>
        {!data && !error && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Cargando el reparto actual…</p>}
        {error && <div role="alert" className="space-y-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200"><p>{error}</p>{!data && <Button type="button" size="sm" variant="outline" onClick={() => { setError(""); setRevision(value => value + 1); }}>Reintentar</Button>}</div>}
        {data?.blocked_reason && <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">{data.blocked_reason}</p>}
        {data && <>
            {data.scheduled_start_at && <p className="text-sm text-muted-foreground">Inicio previsto: {new Date(data.scheduled_start_at).toLocaleString("es-ES")}</p>}
            {stale && <div className="space-y-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200"><p>El reparto incluye espacios o tareas que se han archivado. Retíralos para seleccionar el alcance vigente.</p><Button type="button" size="sm" variant="outline" disabled={busy || !data.can_edit} onClick={() => setSpaces(rows => rows.filter(row => available.has(row.space_id)).map(row => ({ ...row, task_ids: row.task_ids.filter(id => available.get(row.space_id)?.tasks?.some(task => task.id === id)) })))}>Retirar elementos archivados</Button></div>}
            <SpaceWorkforceEditor spaces={data.available_spaces} value={spaces} onChange={setSpaces} choices={data.choices} disabled={busy || !data.can_edit} />
            {tooManyTasks && <p className="text-sm text-orange-700 dark:text-orange-300">Cada ejecución admite hasta 200 tareas de espacios. Divide el servicio en varios trabajos.</p>}
            <p className="text-xs text-muted-foreground">Este reparto corresponde a esta ejecución. Las próximas visitas siguen el alcance configurado en su programación. Los cambios conservan las notas y tareas añadidas manualmente.</p>
        </>}
        <div className="flex justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" disabled={busy} onClick={close}>Cerrar</Button><Button disabled={busy || !data?.can_edit || !dirty || !spaces.length || stale || tooManyTasks}>{busy ? "Guardando…" : "Guardar reparto"}</Button></div>
    </form>;
}

export function TaskSpaceScopeDialog({ taskId, locationId, open, onOpenChange, updated }: Props) {
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Editar reparto por espacios</DialogTitle><DialogDescription>Selecciona las zonas, tareas y trabajadores de este trabajo antes de que comience.</DialogDescription></DialogHeader>{open && <ScopeForm key={`${taskId}:${locationId}`} taskId={taskId} locationId={locationId} close={() => onOpenChange(false)} updated={updated} />}</DialogContent></Dialog>;
}
