"use client";
import { useMemo, useState } from "react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { TaskItem } from "@/types/user";
import type { OfflineDraft } from "@/services/offline-work.service";
export function OfflineReportForm({ task, save, allowPhotos=false, userId }: {
    task: TaskItem;
    save: (draft: OfflineDraft, photos?:File[]) => Promise<void>;
    allowPhotos?:boolean;
    userId?:number;
}) {
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [pause, setPause] = useState("0");
    const [description, setDescription] = useState("");
    const [completed, setCompleted] = useState<number[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [photos,setPhotos]=useState<Array<{id:string;file:File}>>([]);
    const completedIds=useMemo(()=>new Set(completed),[completed]);
    const visibleChecklist=useMemo(()=>(task.checklist_items??[]).filter(item=>!item.completed&&(!userId||!item.assignments?.length||item.assignments.some(row=>row.user_id===userId))),[task.checklist_items,userId]);
    return <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            if (busy)
                return;
            setBusy(true);
            setError("");
            try {
                const elapsed = new Date(end).getTime() - new Date(start).getTime();
                if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed > 86400000 || Number(pause) * 60000 >= elapsed) {
                    throw new Error("Indica entrada, salida y pausas válidas. El parte admite un máximo de 24 horas.");
                }
                await save({ event_id: crypto.randomUUID(), task_id: task.id, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(),
                    paused_seconds: Number(pause) * 60, checklist_ids: completed, description },photos.map(photo=>photo.file));
                setDescription("");
                setCompleted([]);
                setPhotos([]);
            }
            catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo guardar en el dispositivo.");
            }
            finally {
                setBusy(false);
            }
        }}>
        <h2 className="font-semibold sm:col-span-2">{task.title}</h2>
        <label>Entrada<DateTimePicker aria-label="Entrada del parte" id={"offline-start-" + task.id} value={start || null} onValueChange={v => setStart(v ?? "")}/></label>
        <label>Salida<DateTimePicker aria-label="Salida del parte" id={"offline-end-" + task.id} min={start || null} value={end || null} onValueChange={v => setEnd(v ?? "")}/></label>
        <label>Pausas en minutos<Input required type="number" min="0" max="1440" value={pause} onChange={e => setPause(e.target.value)}/></label>
        <label>Parte de trabajo<Input required maxLength={10000} value={description} onChange={e => setDescription(e.target.value)}/></label>
        <fieldset className="space-y-2 sm:col-span-2"><legend>Tareas realizadas</legend>{visibleChecklist.map(item => <label className="flex gap-2" key={item.id}><Checkbox checked={completedIds.has(item.id)} onCheckedChange={checked => setCompleted(current => checked===true ? [...current, item.id] : current.filter(id => id !== item.id))}/>{item.text}</label>)}</fieldset>
        {allowPhotos&&<div className="space-y-1 sm:col-span-2"><label htmlFor={"offline-photos-"+task.id}>Fotos del trabajo</label><Input id={"offline-photos-"+task.id} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple capture="environment" onChange={event=>{setPhotos(Array.from(event.target.files??[]).map(file=>({id:crypto.randomUUID(),file})));event.target.value="";}}/><span className="block text-xs text-muted-foreground">Hasta 8 fotos. Se comprimen y guardan como archivos en este dispositivo antes de sincronizar.</span>{photos.map(photo=><span key={photo.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate">{photo.file.name}</span><Button type="button" variant="ghost" size="sm" aria-label={"Quitar foto "+photo.file.name} onClick={()=>setPhotos(current=>current.filter(row=>row.id!==photo.id))}>Quitar</Button></span>)}</div>}
        <Button disabled={busy} className="justify-self-start">Guardar parte en el dispositivo</Button>
        {error && <p role="alert" className="text-orange-700">{error}</p>}
    </form>;
}
