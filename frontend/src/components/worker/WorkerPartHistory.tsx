"use client";

import {useCallback,useState} from "react";
import {useResourceEffect} from "@/hooks/useResourceEffect";
import {readOfflineWork,type OfflineReceipt} from "@/services/offline-work.service";
import {useWorkerWorkspace} from "./WorkerWorkspace";

const date=new Intl.DateTimeFormat("es-ES",{dateStyle:"short",timeStyle:"short"});
const labels:Record<string,string>={pending:"Pendiente de revisión",approved:"Aprobado",rejected:"Rechazado"};
export function WorkerPartHistory(){
 const workspace=useWorkerWorkspace();
 const [rows,setRows]=useState<OfflineReceipt[]|null>(null),[error,setError]=useState("");
 const request=useCallback(()=>readOfflineWork(false),[]);
 useResourceEffect(true,"own",request,result=>{setRows(result);setError("");},cause=>setError(cause instanceof Error?cause.message:"No se pudieron consultar tus partes enviados."));
 const titles=new Map(workspace.tasks.map(task=>[task.id,task.title]));
 return <details className="border-t pt-3"><summary className="cursor-pointer py-1 text-sm font-medium">Mis partes enviados</summary><div className="mt-3 space-y-2">{error?<p role="alert" className="text-sm text-orange-700">{error}</p>:rows===null?<p role="status" className="text-xs text-muted-foreground">Consultando el estado real de revisión…</p>:!rows.length?<p className="text-xs text-muted-foreground">Todavía no has enviado partes desde este espacio.</p>:rows.map(row=><article key={row.id} className="rounded-xl border p-3 text-xs"><div className="flex flex-wrap items-start justify-between gap-2"><span className="min-w-0 break-words font-medium">{titles.get(row.task_id)??"Trabajo #"+row.task_id}</span><span className={row.status==="approved"?"text-emerald-700":"text-orange-700"}>{labels[row.status]??row.status}</span></div><p className="mt-1 text-muted-foreground">{date.format(new Date(row.starts_at))}{" → "}{date.format(new Date(row.ends_at))}</p><p className="mt-1 break-words text-muted-foreground">{row.description}</p></article>)}</div></details>;
}
