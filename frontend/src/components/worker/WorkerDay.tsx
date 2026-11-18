"use client";
import {useMemo,useState} from "react";
import {CalendarDays,ClipboardCheck,MapPin} from "lucide-react";
import {SummaryMetricCard,SummaryMetricGrid} from "@/components/ui/summary-metric-card";
import {workerTaskOnDay} from "@/domain/tasks/worker-day";
import {useWorkerWorkspace} from "./WorkerWorkspace";
import {WorkerTaskCard} from "./WorkerTaskCard";
import {WorkerOfflinePanel} from "./WorkerOfflinePanel";
import {useUser} from "@/lib/user-context";
import {getUserTaskStatus} from "@/lib/format";
import {WorkerInstall} from "./WorkerInstall";
export function WorkerDay(){
 const {tasks,taskError,locationError,context}=useWorkerWorkspace(),{user}=useUser();
 const [today]=useState(()=>{const now=new Date();return now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");});
 const rows=useMemo(()=>tasks.filter(task=>workerTaskOnDay(task,today)||task.status==="progress"),[tasks,today]);
 const done=rows.filter(task=>getUserTaskStatus(task,user?.id??0)==="completed").length,sites=new Set(rows.map(task=>task.location_id)).size;
 return <main className="space-y-4"><div><h1 className="text-2xl font-semibold tracking-tight">Mi jornada</h1><p className="mt-1 text-sm text-muted-foreground">Tus ubicaciones, trabajos y tareas para hoy.</p></div>
  {!context.features.includes("features.work_orders")?<p role="status" className="rounded-xl border border-orange-400/40 p-4 text-sm text-orange-700">El módulo de trabajos no está habilitado en tu empresa.</p>:taskError?<p role="alert" className="rounded-xl border border-orange-400/40 p-4 text-sm text-orange-700">{taskError}</p>:<><SummaryMetricGrid><SummaryMetricCard icon={CalendarDays} label="Trabajos de hoy" value={String(rows.length)}/><SummaryMetricCard icon={MapPin} label="Ubicaciones" value={String(sites)}/><SummaryMetricCard icon={ClipboardCheck} label="Trabajos completados" value={done+"/"+rows.length}/></SummaryMetricGrid>{locationError&&<p role="status" className="text-xs text-orange-700">{locationError}</p>}<div className="grid gap-3 sm:grid-cols-2">{rows.length?rows.map(task=><WorkerTaskCard key={task.id} task={task}/>):<p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground sm:col-span-2">No tienes trabajos programados para hoy. Los próximos aparecen en Mis trabajos.</p>}</div></>}
  <WorkerInstall/><WorkerOfflinePanel/>
 </main>;
}
