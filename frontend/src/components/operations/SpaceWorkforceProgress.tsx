"use client";
import {useEffect,useState} from "react";
import {Pencil} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {spaceWorkforce,type SpaceWorker} from "@/services/workforce-execution.service";
import {TaskSpaceScopeDialog} from "./TaskSpaceScopeDialog";

export function SpaceWorkforceProgress({taskId,locationId,updated,active,canManage=false,workerMode=false,workerEmployeeId}:{taskId:number;locationId:number;updated:()=>void;active?:boolean;canManage?:boolean;workerMode?:boolean;workerEmployeeId?:number|null}){
 const [allRows,setRows]=useState<SpaceWorker[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const rows=workerMode?allRows.filter(row=>row.employee_id===workerEmployeeId):allRows;
 const [editing,setEditing]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let available=true;spaceWorkforce(taskId).then(rows=>{if(available){setRows(rows);setError("");}}).catch(e=>{if(available)setError(e.message);});return()=>{available=false;};},[taskId,active,revision]);
 async function mark(row:SpaceWorker,id:number,completed:boolean){
  if(workerMode&&(!active||row.employee_id!==workerEmployeeId))return;
  setBusy(true);setError("");
  try{setRows(await spaceWorkforce(taskId,row.id,id,completed));updated();}
  catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");}
  finally{setBusy(false);}
 }
 if(!rows.length&&!error&&!canManage)return null;
 const spaces=Array.from(new Map(rows.map(row=>[row.space_id,row.space_name])));
 return <section className="rounded-2xl border bg-card p-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Reparto por espacios</h3><p className="mb-3 text-xs text-muted-foreground">Tareas completadas / asignadas a cada trabajador.</p></div>
   {!workerMode&&(!rows.length||rows.some(row=>row.space_id!==null))&&(canManage||rows.some(row=>row.can_manage))&&<Button size="sm" type="button" variant="outline" onClick={()=>setEditing(true)}><Pencil aria-hidden="true" className="size-3.5"/>Editar reparto</Button>}
  </div>
  {error&&<p role="alert" className="text-sm text-orange-700">{error}</p>}
  {!rows.length&&!error&&<p className="text-sm text-orange-700">Este trabajo todavía no tiene trabajadores repartidos por espacios.</p>}
  {spaces.map(([id,name])=><details key={id??"general"} open className="border-t py-2"><summary className="cursor-pointer text-sm font-semibold">{name||"Trabajo general"}</summary>
   {rows.flatMap(row=>row.space_id===id?[<article key={row.id} className="my-2 rounded-lg bg-muted/30 p-3">
    <div className="flex justify-between gap-2 text-sm"><strong>{row.employee}</strong><span className={row.done<row.total?"font-medium text-orange-700":"font-medium"}>{row.done}/{row.total}</span></div>
    <p className="mt-1 text-xs text-muted-foreground">{row.planned_minutes} min previstos{!row.can_edit&&!row.can_manage?" · Inicia el trabajo para registrar las tareas":""}</p>
    <progress className="my-2 h-1 w-full accent-[var(--accent)]" aria-label={"Tareas de "+row.employee} max={row.total||1} value={row.done}/>
    <div className="space-y-2">{row.tasks.map(task=><label key={task.id} className="flex items-center gap-2 text-sm"><Checkbox aria-label={row.employee+" · "+task.title} disabled={busy||!row.can_edit||(workerMode&&!active)} checked={task.completed} onCheckedChange={checked=>void mark(row,task.id,checked===true)}/>{task.title}{task.answer==="no"&&<span className="text-xs text-orange-700">Requiere revisión</span>}</label>)}</div>
   </article>]:[])}
  </details>)}
  {editing&&<TaskSpaceScopeDialog taskId={taskId} locationId={locationId} open onOpenChange={setEditing} updated={()=>{setRevision(value=>value+1);updated();}}/>}
 </section>;
}
