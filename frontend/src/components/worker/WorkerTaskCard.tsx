"use client";
import {MapPin,Clock3,ArrowUpRight} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {useUser} from "@/lib/user-context";
import {getUserTaskStatus} from "@/lib/format";
import {workerChecklistProgress} from "@/domain/tasks/worker-day";
import {getTaskScheduleDate,isTaskDateOnlyValue} from "@/domain/tasks/task-schedule";
import type {TaskItem} from "@/types/user";
import {useWorkerWorkspace} from "./WorkerWorkspace";
const dateFormat=new Intl.DateTimeFormat("es-ES",{weekday:"short",day:"numeric",month:"short"});
const timeFormat=new Intl.DateTimeFormat("es-ES",{hour:"2-digit",minute:"2-digit"});
const labels:Record<string,string>={pending:"Pendiente",accepted:"Programado",progress:"En curso",completed:"Completado",review:"En revisión",rejected:"Rechazado",cancelled:"Cancelado"};
export function WorkerTaskCard({task}:{task:TaskItem}){
 const {user}=useUser(),{locationName,openTask,online}=useWorkerWorkspace();
 const progress=workerChecklistProgress(task,user?.id??0),date=task.scheduled_start_at||task.due_at?getTaskScheduleDate(task):null,state=getUserTaskStatus(task,user?.id??0);
 const time=task.scheduled_start_at&&!isTaskDateOnlyValue(task.scheduled_start_at)?timeFormat.format(new Date(task.scheduled_start_at)):null;
 return <article className="min-w-0 space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold leading-snug">{task.title}</h2><p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0"/><span className="break-words">{locationName(task.location_id)}</span></p></div><Badge variant="secondary" className={state==="progress"?"shrink-0 bg-accent/10 text-accent":"shrink-0"}>{labels[state]??"Pendiente"}</Badge></div>
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="flex items-center gap-1.5 text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5"/>{date?dateFormat.format(date):"Fecha pendiente"}{time?" · "+time:" · Horario pendiente"}</span><span className={progress.total&&progress.done<progress.total?"font-semibold text-orange-700 dark:text-orange-300":"font-semibold"}>{progress.total?progress.done+"/"+progress.total+" tareas propias":"Checklist pendiente"}</span></div>
  {progress.total>0&&<progress aria-label="Tareas propias completadas" className="h-1.5 w-full accent-[var(--accent)]" max={progress.total} value={progress.done}/>}
  {task.spaces?.length? <p className="text-xs text-muted-foreground">{task.spaces.map(space=>space.name).join(" · ")}</p>:null}
  <Button type="button" variant="outline" className="w-full" disabled={!online} onClick={()=>openTask(task)}>Abrir trabajo<ArrowUpRight aria-hidden="true" className="size-4"/></Button>
 </article>;
}
