import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cleanChecklistDescription } from "@/lib/format";
import { taskMoment } from "@/domain/tasks/task-moment";
import { taskWorkers } from "@/domain/tasks/operations-overview";
import type { TaskItem } from "@/types/user";
import type { useTaskReview } from "@/hooks/useTaskReview";

export function TaskConsultationCard({ review, items, locationName, workerName, canEdit, onFullDetail }: {
    review: ReturnType<typeof useTaskReview>; items: TaskItem[]; locationName: (id: number) => string;
    workerName: (id: number | null) => string; canEdit: boolean; onFullDetail: (task: TaskItem) => void;
}) {
    const task = review.record;
    if (!task) return null;
    const index = items.findIndex(item => item.id === task.id);
    const labels: Record<string,string> = {pending:"Pendiente",accepted:"Aceptado",progress:"En curso",in_progress:"En curso",review:"En revisión",in_review:"En revisión",completed:"Completado"};
    return <section aria-label={`Resumen de ${task.title}`} className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{index >= 0 ? `${index + 1} de ${items.length} resultados` : "Fuera de los filtros actuales"}</p><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Trabajo anterior" disabled={index <= 0 || review.saving} onClick={() => review.select(items[index - 1])}><ArrowLeft className="size-4" /></Button><Button size="icon" variant="ghost" aria-label="Trabajo siguiente" disabled={index < 0 || index >= items.length - 1 || review.saving} onClick={() => review.select(items[index + 1])}><ArrowRight className="size-4" /></Button><Button size="icon" variant="ghost" aria-label="Cerrar resumen y volver a resultados" disabled={review.saving} onClick={() => review.select(null)}><X className="size-4" /></Button></div></div>
        <div><h2 className="break-words text-xl font-semibold">{task.title}</h2><Badge className="mt-2" variant="secondary">{labels[task.status] || task.status}</Badge></div>
        {review.editing ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void review.save(); }}><div><Label htmlFor="review-task-title">Nombre del trabajo</Label><Input id="review-task-title" value={review.title} onChange={event => review.setTitle(event.target.value)} required /></div><div><Label htmlFor="review-task-notes">Notas operativas</Label><Textarea id="review-task-notes" value={review.notes} onChange={event => review.setNotes(event.target.value)} /></div><p className="text-xs text-muted-foreground">Los responsables, espacios y checklist se editan en la ficha completa para conservar su reparto.</p><div className="flex gap-2"><Button disabled={review.saving}>{review.saving ? "Guardando…" : "Guardar cambios"}</Button><Button type="button" variant="outline" disabled={review.saving} onClick={() => review.select(task)}>Cancelar</Button></div></form> : <><dl className="space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Ubicación</dt><dd className="mt-1">{locationName(task.location_id)}</dd></div><div><dt className="text-xs text-muted-foreground">Responsables</dt><dd className="mt-1">{taskWorkers(task).map(worker => worker.name || workerName(worker.id)).join(", ") || "Pendiente de asignar"}</dd></div><div><dt className="text-xs text-muted-foreground">Fecha límite</dt><dd className="mt-1">{taskMoment(task.due_at)}</dd></div></dl><p className="whitespace-pre-line text-sm">{cleanChecklistDescription(task.description || "") || "Sin descripción adicional."}</p>{task.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{task.notes}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onFullDetail(task)}>Abrir ficha completa</Button>{canEdit && <Button variant="ghost" onClick={() => review.setEditing(true)}>Editar tarea</Button>}</div></>}
        {review.error && <div role="alert" className="space-y-2 rounded-lg border border-orange-400/40 p-3 text-sm"><p>{review.error}</p>{review.conflict && <><p className="font-medium">Versión actual: {review.conflict.title}</p><p className="whitespace-pre-line text-muted-foreground">{review.conflict.notes || "Sin notas"}</p><Button variant="outline" size="sm" onClick={review.reviewConflict}>He revisado los cambios</Button></>}</div>}
        <Dialog open={review.pending !== undefined} onOpenChange={open => { if (!open) review.continueEditing(); }}><DialogContent><DialogHeader><DialogTitle>Tienes cambios sin guardar</DialogTitle><DialogDescription>Elige cómo continuar antes de cambiar de trabajo o cerrar el detalle.</DialogDescription></DialogHeader><div className="flex flex-col gap-2"><Button disabled={review.saving} onClick={() => void review.saveAndContinue()}>Guardar y continuar</Button><Button variant="outline" disabled={review.saving} onClick={review.discard}>Descartar cambios</Button><Button variant="ghost" disabled={review.saving} onClick={review.continueEditing}>Seguir editando</Button></div>{review.error && <p role="alert" className="text-sm text-orange-700 dark:text-orange-300">{review.error}</p>}</DialogContent></Dialog>
    </section>;
}
