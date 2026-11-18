"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {approvalRequest,type ClosureApproval} from "@/services/workflow-approval.service";
export function TaskCloseApproval({taskId,updated}:{taskId:number;updated:()=>void}){
 const [data,setData]=useState<ClosureApproval|null>(null),[note,setNote]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;approvalRequest<ClosureApproval>(`tasks/${taskId}`).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[taskId,revision]);
 async function act(decision?:"approved"|"rejected"){
  setBusy(true);setError("");try{setData(await approvalRequest<ClosureApproval>(`tasks/${taskId}/${decision?"decision":"request"}`,decision?{decision,note,fingerprint:data?.fingerprint}:{}));setNote("");setRevision(value=>value+1);updated();}catch(e){setError(e instanceof Error?e.message:"No se pudo revisar.");}finally{setBusy(false);}
 }
 if(!data?.required&&!error)return null;
 return <section className="space-y-3 rounded-2xl border bg-card p-4"><h3 className="font-semibold">Validación del cierre</h3><p className={data?.status==="approved"?"text-sm text-emerald-700":"text-sm text-orange-700"}>{({not_requested:"Completa los requisitos y finaliza los fichajes para solicitar el cierre.",pending:"Pendiente de revisión del responsable.",outdated:"El trabajo ha cambiado. Solicita una revisión actualizada.",approved:"Cierre aprobado.",rejected:"Se han solicitado correcciones."} as Record<string,string>)[data?.status??""]}</p>{data&&!data.available&&<p className="text-sm text-orange-700">El módulo de aprobaciones no está activo. Revisa el plan o la política de cierre en Organización.</p>}{data?.note&&<p className="text-sm">{data.note}</p>}{error&&<p role="alert" className="text-sm text-orange-700">{error}</p>}{data?.status!=="approved"&&<><Textarea aria-label="Observaciones de la revisión del cierre" value={note} maxLength={2000} placeholder="Observaciones o motivo de las correcciones" onChange={e=>setNote(e.target.value)}/><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy||!data?.can_request} onClick={()=>void act()}>Solicitar revisión actualizada</Button><Button size="sm" disabled={busy||!data?.can_decide} onClick={()=>void act("approved")}>Aprobar y cerrar trabajo</Button><Button size="sm" variant="outline" disabled={busy||!data?.can_decide||!note.trim()} onClick={()=>void act("rejected")}>Solicitar correcciones</Button></div></>}</section>;
}
