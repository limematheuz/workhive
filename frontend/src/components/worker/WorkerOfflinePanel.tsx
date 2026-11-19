"use client";
import {useCallback,useMemo,useState} from "react";
import {CloudDownload,CloudUpload,Camera} from "lucide-react";
import {Button} from "@/components/ui/button";
import {OfflineReportForm} from "@/components/operations/OfflineReportForm";
import {useUser} from "@/lib/user-context";
import {useResourceEffect} from "@/hooks/useResourceEffect";
import {cachedDay,type OfflineDraft} from "@/services/offline-work.service";
import {readWorkerPhotos} from "@/services/worker-offline-storage";
import {saveWorkerDay,saveWorkerPart,synchronizeWorkerDay} from "@/services/worker-offline.service";
import {useWorkerWorkspace} from "./WorkerWorkspace";
import {WorkerPartHistory} from "./WorkerPartHistory";

export function WorkerOfflinePanel(){
 const {user}=useUser(),workspace=useWorkerWorkspace();
 const [queue,setQueue]=useState<OfflineDraft[]>([]),[photoCount,setPhotoCount]=useState(0),[savedAt,setSavedAt]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[revision,setRevision]=useState(0);
 const request=useCallback(async()=>{if(!user?.company_id)return null;return Promise.all([cachedDay(user.id,user.company_id),readWorkerPhotos(user.id,user.company_id)]);},[user]);
 const receive=useCallback((result:Awaited<ReturnType<typeof request>>)=>{if(result){setQueue(result[0].queue);setSavedAt(result[0].savedAt);setPhotoCount(result[1].length);}},[]);
 const failed=useCallback((error:unknown)=>setMessage(error instanceof Error?error.message:"No se pudo consultar el almacenamiento del dispositivo."),[]);
 useResourceEffect(Boolean(user),String(user?.id),request,receive,failed);
 const eligible=useMemo(()=>workspace.tasks.filter(task=>!task.is_invoiced&&!["cancelled","rejected"].includes(task.status)),[workspace.tasks]);
 async function prepare(){
  if(!user?.company_id)return;
  setBusy(true);setMessage("");
  try {
   await saveWorkerDay(user.id,user.company_id,workspace.tasks,{context:workspace.context,locations:workspace.locations.map(({id,name,address,city})=>({id,name,address,city}))});
   localStorage.setItem("workhive_offline_identity:v1",JSON.stringify(user));
   receive(await request());
   setMessage("App y trabajos preparados. Puedes volver a abrir /worker sin conexión en este dispositivo.");
  }catch(error){failed(error);}finally{setBusy(false);}
 }
 async function synchronize(){
  if(!user?.company_id)return;
  setBusy(true);setMessage("");
  try {
   await synchronizeWorkerDay(user.id,user.company_id);
   receive(await request());
   setMessage("Partes y fotos enviados. Consulta el estado de revisión en Mis partes enviados.");
   setRevision(value=>value+1);
   workspace.reload();
  }catch(error){failed(error);}finally{setBusy(false);}
 }
 if(!user?.company_id)return null;
 const identity=user,company=user.company_id;
 const canRecord=workspace.context.can_track_time&&workspace.context.features.includes("features.time_tracking");
 return <section className="space-y-3 rounded-2xl border bg-card p-4"><div><h2 className="font-semibold">Jornada sin conexión</h2><p className="mt-1 text-xs text-muted-foreground">Prepara la app antes de salir. Guarda partes, tareas realizadas y fotos; los horarios enviados quedan pendientes de revisión del responsable.</p></div>
  <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy||!workspace.online||Boolean(workspace.taskError)} onClick={()=>void prepare()}><CloudDownload className="size-4"/>Preparar mi jornada</Button><Button type="button" disabled={busy||!canRecord||!workspace.online||!queue.length} onClick={()=>void synchronize()}><CloudUpload className="size-4"/>Sincronizar {queue.length||""}</Button></div>
  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Camera className="size-3.5"/>{queue.length} partes y {photoCount} fotos pendientes · {savedAt?"Preparada el "+new Date(savedAt).toLocaleString("es-ES"):"Aún sin preparar"}</p>
  {message&&<p role="status" className="break-words text-sm text-orange-700 dark:text-orange-300">{message}</p>}
  {!canRecord?<p className="rounded-xl border border-orange-500/30 p-3 text-sm text-orange-700">Puedes consultar los trabajos preparados. Para registrar y enviar partes, la empresa debe habilitar tu permiso de fichaje.</p>:<details><summary className="cursor-pointer py-1 text-sm font-medium">Registrar un parte y fotos en este dispositivo</summary><div className="mt-3 space-y-3">{eligible.length===0?<p className="text-sm text-muted-foreground">No hay trabajos propios disponibles para un parte.</p>:eligible.map(task=><OfflineReportForm key={task.id} task={task} userId={identity.id} allowPhotos save={async(draft,photos)=>{await saveWorkerPart(identity.id,company,draft,photos);receive(await request());setMessage("Parte y fotos guardados en este dispositivo. Sincronízalos cuando tengas conexión.");}}/>)}</div></details>}
  {workspace.online&&<WorkerPartHistory key={revision}/>}
 </section>;
}
