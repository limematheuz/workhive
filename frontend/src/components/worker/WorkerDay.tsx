"use client";
import {useMemo,useState} from "react";
import {CalendarDays,ClipboardCheck,MapPin} from "lucide-react";
import {SummaryMetricCard,SummaryMetricGrid} from "@/components/ui/summary-metric-card";
import {toTaskPlanningDateInput} from "@/domain/tasks/task-schedule";
import {workerTaskOnDay} from "@/domain/tasks/worker-day";
import {useWorkerWorkspace} from "./WorkerWorkspace";
import {sortWorkerTasks} from "@/domain/tasks/worker-day";
import {WorkerNextService} from "./WorkerNextService";
import {WorkerTaskCard} from "./WorkerTaskCard";
import {WorkerOfflinePanel} from "./WorkerOfflinePanel";
import {useUser} from "@/lib/user-context";
import {getUserTaskStatus} from "@/lib/format";
import {WorkerInstall} from "./WorkerInstall";
export function WorkerDay(){
 const {tasks,taskError,locationError,context}=useWorkerWorkspace(),{user}=useUser();
 const [today]=useState(()=>{const now=new Date();return now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");});
 const rows=useMemo(()=>sortWorkerTasks(tasks.filter(task=>workerTaskOnDay(task,today)||getUserTaskStatus(task,user?.id??0)==="progress")),[tasks,today,user?.id]);
 const pending=rows.filter(task=>!["completed","cancelled","rejected"].includes(getUserTaskStatus(task,user?.id??0)));
 const next=pending.find(task=>getUserTaskStatus(task,user?.id??0)==="progress")??pending[0]??null;
 const upcoming=sortWorkerTasks(tasks.filter(task=>!rows.some(row=>row.id===task.id)&&!["completed","cancelled","rejected"].includes(getUserTaskStatus(task,user?.id??0))&&Boolean(task.scheduled_start_at||task.due_at)&&toTaskPlanningDateInput(task.scheduled_start_at||task.due_at)>today));
 const done=rows.filter(task=>getUserTaskStatus(task,user?.id??0)==="completed").length,sites=new Set(rows.map(task=>task.location_id)).size;
 return <main className="space-y-4"><div><h1 className="text-2xl font-semibold tracking-tight">Mi jornada</h1><p className="mt-1 text-sm text-muted-foreground">Tus ubicaciones, trabajos y tareas para hoy.</p></div>
  {!context.features.includes("features.work_orders")?<p role="status" className="rounded-xl border border-orange-400/40 p-4 text-sm text-orange-700">El módulo de trabajos no está habilitado en tu empresa.</p>:taskError?<p role="alert" className="rounded-xl border border-orange-400/40 p-4 text-sm text-orange-700">{taskError}</p>:<><WorkerNextService task={next} userId={user?.id??0}/><SummaryMetricGrid><SummaryMetricCard icon={CalendarDays} label="Trabajos de hoy" value={String(rows.length)}/><SummaryMetricCard icon={MapPin} label="Ubicaciones" value={String(sites)}/><SummaryMetricCard icon={ClipboardCheck} label="Trabajos completados" value={done+"/"+rows.length}/></SummaryMetricGrid>{locationError&&<p role="status" className="text-xs text-orange-700">{locationError}</p>}<div className="grid gap-3 sm:grid-cols-2">{rows.length?rows.filter(task=>task.id!==next?.id).map(task=><WorkerTaskCard key={task.id} task={task}/>):<p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground sm:col-span-2">No tienes trabajos programados para hoy. Los próximos aparecen en Mis trabajos.</p>}</div>{upcoming.length>0&&<section className="space-y-3"><h2 className="text-lg font-semibold">Próximos días</h2><div className="grid gap-3 sm:grid-cols-2">{upcoming.slice(0,4).map(task=><WorkerTaskCard key={task.id} task={task}/>)}</div></section>}</>}
  <WorkerInstall/><WorkerOfflinePanel/>
 </main>;
}
