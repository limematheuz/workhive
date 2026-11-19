"use client";
import {FormSelect} from "@/components/ui/form-select";
import {useCallback,useState} from "react";
import {ChartNoAxesCombined,RefreshCw} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {DatePicker} from "@/components/ui/date-picker";
import {canManageFinance} from "@/domain/access/roles";
import {PremiumTabs} from "@/components/ui/premium-tabs";
import {Button} from "@/components/ui/button";
import {ManagementFinance} from "@/components/operations/ManagementFinance";
import {ManagementActivity} from "@/components/operations/ManagementActivity";
import {useResourceEffect} from "@/hooks/useResourceEffect";
import {useUser} from "@/lib/user-context";
import {reportUtcDateTime} from "@/lib/business-report-format";
import {readManagementInsights,type ManagementInsights} from "@/services/management-insights.service";
export default function ManagementPage(){
 const {user,loading}=useUser(),[month,setMonth]=useState(""),[period,setPeriod]=useState<"month"|"year">("month"),[revision,setRevision]=useState(0),[error,setError]=useState(""),[view,setView]=useState<"finance"|"activity">("finance");
 const key=user?.company_id+":"+user?.id+":"+month+":"+period+":"+revision;
 const [result,setResult]=useState<{key:string;data:ManagementInsights}|null>(null);
 const request=useCallback(()=>readManagementInsights(month,period),[month,period]);
 useResourceEffect(Boolean(user),key,request,data=>{setResult({key,data});setError("");},e=>setError(e instanceof Error?e.message:"No se pudo cargar el análisis."));
 const data=result?.key===key?result.data:null;
 if(loading)return <p>Cargando…</p>;
 return <div className="dashboard-page-content space-y-5"><PageHeader icon={ChartNoAxesCombined} title="Análisis de empresa" subtitle="Ingresos, cobros, trabajo y horas conectados con los registros de la empresa." actions={<Button variant="outline" onClick={()=>{setError("");setRevision(n=>n+1);}}><RefreshCw size={15}/>Actualizar</Button>}/>
 <section className="flex flex-wrap items-end gap-3 rounded-2xl border bg-[var(--bg-card)] p-3"><label className="text-sm">Mes de referencia<DatePicker aria-label="Mes de referencia" value={(month||data?.month)?(month||data?.month)+"-01":""} onValueChange={value=>{if(value)setMonth(value.slice(0,7));setError("");}}/></label><label className="text-sm">Periodo<FormSelect aria-label={"Periodo"}  value={period} onValueChange={selectedOptionValue=>{setPeriod(selectedOptionValue as "month"|"year");setError("");}}><option value="month">Mes</option><option value="year">Año</option></FormSelect></label><p className="max-w-xl pb-1 text-xs text-muted-foreground">Periodo contable UTC. Los cobros pertenecen a su fecha de recepción; las facturas, a su fecha contable. Los indicadores señalados como actuales no se limitan al periodo.</p></section>
 {error&&<p role="alert" className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">{error}</p>}{!data&&!error&&<p role="status">Consultando registros…</p>}
 {data&&<><PremiumTabs activeTab={view} onChange={setView} tabs={[{id:"finance",label:"Finanzas y clientes"},{id:"activity",label:"Operación y seguimiento"}]}/>{view==="finance"?<ManagementFinance data={data.finance}/>:<ManagementActivity data={data} canInvoice={canManageFinance(user)}/>}<p className="text-xs text-muted-foreground">Consulta actualizada: {reportUtcDateTime(data.as_of)} UTC. Una cifra cero indica ausencia de registros para ese indicador; no sustituye los datos todavía pendientes de registrar.</p></>}
 </div>;
}
