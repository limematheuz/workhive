"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecordLinkNotice } from "@/components/ui/record-link-notice";
import { useLinkedRecord } from "@/hooks/useLinkedRecord";
import { linkedRecordTarget, recordLinkUrl } from "@/lib/record-deep-link";
import { useUser } from "@/lib/user-context";
import { WorkSessionService } from "@/services/work-session.service";
import { useWorkerWorkspace } from "./WorkerWorkspace";

const dateTime = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
const dateLabel = (value: string) => Number.isNaN(new Date(value).getTime()) ? "Fecha pendiente" : dateTime.format(new Date(value));

export function WorkerClockRecord() {
    const { user } = useUser();
    const userId = user?.id;
    const workspace = useWorkerWorkspace();
    const params = useSearchParams(), pathname = usePathname(), router = useRouter();
    const target = linkedRecordTarget(params, "sessionId");
    const read = useCallback(async (id: number, signal?: AbortSignal) => {
        const row = await WorkSessionService.getWorkSession(id, signal);
        if (!userId || row.user_id !== userId) throw new Error("Este enlace no corresponde a uno de tus fichajes.");
        return row;
    }, [userId]);
    const linked = useLinkedRecord(Boolean(user?.company_id) && workspace.online,
        `${user?.company_id}:${user?.id}`, target, read, "No se pudo consultar este fichaje.");
    const close = () => router.replace(recordLinkUrl(pathname, params, { sessionId: null }), { scroll: false });
    const row = linked.record;
    const minutes = row?.end_time ? Math.max(0, Math.round(((new Date(row.end_time).getTime() - new Date(row.start_time).getTime()) / 1000 - (row.paused_seconds ?? 0)) / 60)) : null;
    return <><RecordLinkNotice phase={linked.phase} error={linked.error} label="tu fichaje" retry={linked.retry} clear={close}/>
        <Dialog open={Boolean(row)} onOpenChange={open => { if (!open) close(); }}><DialogContent compact className="max-w-lg">
            <DialogHeader><DialogTitle>Fichaje #{row?.id}</DialogTitle><DialogDescription>Registro propio de tu jornada.</DialogDescription></DialogHeader>
            {row && <div className="space-y-4 text-sm"><div className="flex items-start justify-between gap-3"><p className="break-words font-medium">{row.location_name || workspace.locationName(row.location_id)}</p>
                <Badge variant="secondary">{row.end_time ? "Finalizado" : row.paused_at ? "Pausado" : "En curso"}</Badge></div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3"><dt className="text-muted-foreground">Inicio</dt><dd>{dateLabel(row.start_time)}</dd>
                    <dt className="text-muted-foreground">Fin</dt><dd>{row.end_time ? dateLabel(row.end_time) : "Fichaje abierto"}</dd>
                    <dt className="text-muted-foreground">Pausas registradas</dt><dd>{Math.round((row.paused_seconds ?? 0) / 60)} min</dd>
                    <dt className="text-muted-foreground">Tiempo trabajado</dt><dd>{minutes === null ? "En curso" : `${minutes} min`}</dd></dl>
                {row.notes && <div className="rounded-lg border p-3"><p className="mb-1 font-medium">Notas</p><p className="whitespace-pre-wrap break-words text-muted-foreground">{row.notes}</p></div>}
            </div>}<DialogFooter><Button variant="outline" onClick={close}>Volver a mis fichajes</Button></DialogFooter>
        </DialogContent></Dialog></>;
}
