"use client";
import {useMemo,useState} from "react";
import {Input} from "@/components/ui/input";
import {SelectField} from "@/components/ui/select-field";
import {useWorkerWorkspace} from "./WorkerWorkspace";
import {WorkerTaskCard} from "./WorkerTaskCard";
import {useUser} from "@/lib/user-context";
import {getUserTaskStatus} from "@/lib/format";
const statuses=[{value:"all",label:"Todos los estados"},{value:"pending",label:"Pendientes"},{value:"accepted",label:"Programados"},{value:"progress",label:"En curso"},{value:"completed",label:"Completados"},{value:"review",label:"En revisión"}];
export function WorkerJobs(){
 const {tasks,taskError,locationName,context}=useWorkerWorkspace(),{user}=useUser();const [search,setSearch]=useState(""),[status,setStatus]=useState("all");
 const rows=useMemo(()=>{const query=search.trim().toLocaleLowerCase("es");return tasks.filter(task=>(status==="all"||getUserTaskStatus(task,user?.id??0)===status)&&(!query||(task.title+" "+locationName(task.location_id)+" "+(task.spaces?.map(space=>space.name).join(" ")??"")).toLocaleLowerCase("es").includes(query)));},[tasks,status,search,locationName,user?.id]);
 return <main className="space-y-4"><div><h1 className="text-2xl font-semibold tracking-tight">Mis trabajos</h1><p className="mt-1 text-sm text-muted-foreground">Trabajos asignados a tu cuenta, con sus horarios y tareas.</p></div><div className="grid gap-2 sm:grid-cols-[1fr_14rem]"><Input aria-label="Buscar mis trabajos" type="search" placeholder="Buscar trabajo, ubicación o espacio…" value={search} onChange={event=>setSearch(event.target.value)}/><SelectField aria-label="Estado de mis trabajos" value={status} options={statuses} onValueChange={setStatus}/></div>
  {!context.features.includes("features.work_orders")?<p role="status" className="text-sm text-orange-700">Tu empresa no tiene habilitado el módulo de trabajos.</p>:taskError?<p role="alert" className="text-sm text-orange-700">{taskError}</p>:<><p className="text-xs text-muted-foreground">{rows.length} trabajos</p><div className="grid gap-3 sm:grid-cols-2">{rows.length?rows.map(task=><WorkerTaskCard key={task.id} task={task}/>):<p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground sm:col-span-2">{search||status!=="all"?"No hay trabajos con esos filtros.":"Todavía no tienes trabajos asignados a esta cuenta."}</p>}</div></>}
 </main>;
}
