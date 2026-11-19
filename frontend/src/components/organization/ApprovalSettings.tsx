"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {approvalSettings,saveApprovalSettings,type ApprovalPolicy} from "@/services/workflow-approval.service";
export function ApprovalSettings(){
 const [data,setData]=useState<ApprovalPolicy|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;approvalSettings().then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 if(!data&&!error)return <p className="text-sm text-muted-foreground">Cargando reglas de aprobación…</p>;
 return <section className="space-y-3 rounded-2xl border bg-card p-4"><div><h3 className="font-semibold">Reglas de aprobación</h3><p className="text-xs text-muted-foreground">Activa las revisiones que necesita esta empresa. Se aplican a compras nuevas y a los siguientes cierres de trabajos.</p></div>{error&&<p role="alert" className="text-sm text-orange-700">{error}</p>}{data&&<><label className="flex items-center justify-between gap-3 text-sm"><span>Revisar la compra antes de registrar gasto y existencias</span><Switch disabled={busy||!data.can_manage||(!data.available&&!data.purchases_required)} checked={data.purchases_required} onCheckedChange={value=>setData({...data,purchases_required:value})}/></label><label className="flex items-center justify-between gap-3 text-sm"><span>Validación del responsable antes de cerrar un trabajo</span><Switch disabled={busy||!data.can_manage||(!data.available&&!data.task_close_required)} checked={data.task_close_required} onCheckedChange={value=>setData({...data,task_close_required:value})}/></label>{!data.available&&<p className="text-sm text-orange-700">El módulo de aprobaciones no está activo en este plan.</p>}{data.can_manage&&<Button size="sm" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{setData(await saveApprovalSettings(data));}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");}finally{setBusy(false);}}}>{busy?"Guardando…":"Guardar reglas"}</Button>}</>}</section>;
}
