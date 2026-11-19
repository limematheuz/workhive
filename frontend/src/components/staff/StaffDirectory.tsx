"use client";
import { CalendarClock, Clock3, Download, FileText, Plus, UsersRound, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-context";
import { canManageLaborCosts, canViewLaborCosts } from "@/domain/access/roles";
import { blankEmployee,hourly,monthly,StaffService,type Employee } from "@/services/staff.service";
import { StaffForm } from "./StaffForm";
import { FormSelect } from "@/components/ui/form-select";
import { RecordLinkNotice } from "@/components/ui/record-link-notice";
import { CompanyViewSession } from "@/components/company/CompanyViewSession";
import { useLinkedRecord } from "@/hooks/useLinkedRecord";
import { linkedRecordTarget, recordLinkUrl } from "@/lib/record-deep-link";
import { useStaffConsultationLayout } from "@/hooks/useStaffConsultationLayout";
import { StaffEmployeesList } from "./StaffEmployeesList";
import { StaffEmployeeDetail, type StaffDetailTab } from "./StaffEmployeeDetail";
import { StaffDetailSurface } from "./StaffDetailSurface";

const money=(n:number)=>n.toLocaleString("es-ES",{style:"currency",currency:"EUR"});
const hours=(n:number)=>n.toLocaleString("es-ES")+" h";
const total=(items:Employee[])=>items.reduce((n,e)=>n+monthly(e),0);
const duration=(items:Employee[])=>items.reduce((n,e)=>n+Number(e.monthly_hours),0);
function StaffFilter({label,value,options,change}:{label:string;value:string;options:string[];change:(value:string)=>void}){
    return <label className="grid gap-1 text-sm font-medium">{label}<FormSelect aria-label={label} value={value} onValueChange={change} searchable={label==="Equipo"}><option value="">Todos</option>{options.map(option=><option key={option}>{option}</option>)}</FormSelect></label>;
}
function exportStaff(rows:Employee[]){
    const cells=[["Trabajador","Cargo","Equipo","Contrato","Horas/mes","Coste/h","Coste mensual","Estado"],...rows.map(e=>[e.name,e.position,e.team,e.profile.contract,e.monthly_hours,hourly(e).toFixed(2),monthly(e).toFixed(2),e.profile.state])];
    const csv=cells.map(row=>row.map(cell=>'"'+String(cell).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="plantilla-costes.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function StaffDirectory({teams}:{teams:boolean}){
    return <CompanyViewSession><StaffDirectoryWorkspace teams={teams}/></CompanyViewSession>;
}
function StaffDirectoryWorkspace({teams}:{teams:boolean}){
    const {containerRef,split}=useStaffConsultationLayout();
    const {user,loading}=useUser();
    const params=useSearchParams(),pathname=usePathname(),router=useRouter();
    const [rows,setRows]=useState<Employee[]>([]);
    const [error,setError]=useState("");
    const [loadedScope,setLoadedScope]=useState(""),[revision,setRevision]=useState(0);
    const [query,setQuery]=useState(""),[team,setTeam]=useState(""),[contract,setContract]=useState(""),[status,setStatus]=useState("");
    const [selected,setSelected]=useState<number|null>(null),[tab,setTab]=useState<StaffDetailTab>("Costes"),[editing,setEditing]=useState<Employee|null>(null);
    const allowed=canViewLaborCosts(user),manage=canManageLaborCosts(user);
    const scope=`${user?.company_id}:${user?.id}`;
    const target=linkedRecordTarget(params,"employeeId");
    const linked=useLinkedRecord(allowed&&!loading,scope,target,StaffService.get,"No se pudo consultar la ficha del trabajador.");
    const select=(id:number|null)=>{setSelected(id??-1);router.replace(recordLinkUrl(pathname,params,{employeeId:id}),{scroll:false});};
    useEffect(()=>{let active=true;if(allowed)StaffService.list().then(value=>{if(active){setRows(value);setError("");setLoadedScope(scope);}}).catch(cause=>{if(active){setError(cause instanceof Error?cause.message:"No se pudo consultar la plantilla.");setLoadedScope(scope);}});return()=>{active=false;};},[allowed,scope,revision]);
    if(loading||(allowed&&loadedScope!==scope))return <p role="status" className="p-6 text-sm text-muted-foreground">Cargando plantilla y costes registrados…</p>;
    if(!allowed)return <p>Acceso restringido a los datos laborales.</p>;
    if(error)return <main className="dashboard-page-content space-y-4"><PageHeader icon={UsersRound} title="Trabajadores" subtitle="Plantilla y costes laborales de la empresa"/><div role="alert" className="space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4"><p className="text-sm text-orange-700 dark:text-orange-300">{error}</p><Button variant="outline" onClick={()=>{setLoadedScope("");setRevision(value=>value+1);}}>Volver a consultar la plantilla</Button></div></main>;
    const groups=[...new Set(rows.flatMap(e=>e.team?[e.team]:[]))].sort();
    const visible=rows.filter(e=>(!team||e.team===team)&&(!status||e.profile.state===status)&&(!contract||e.profile.contract===contract)&&[e.name,e.position,e.team].join(" ").toLowerCase().includes(query.toLowerCase()));
    const worker=target.present?linked.record??undefined:split&&selected!==-1?(visible.find(e=>e.id===selected)??visible[0]):undefined;
    return <main className="dashboard-page-content space-y-5"><PageHeader icon={UsersRound} title={teams?"Equipos de trabajo":"Trabajadores"} subtitle="Plantilla y costes laborales de la empresa" actions={<><Button asChild variant="outline"><Link href={teams?"/dashboard/plantilla/trabajadores":"/dashboard/plantilla/equipos"}>{teams?"Trabajadores":"Equipos"}</Link></Button><Button variant="outline" onClick={()=>exportStaff(visible)}><Download/>Exportar</Button><Button variant="outline" onClick={()=>window.print()}><FileText/>Informe de costes</Button>{manage&&<Button onClick={()=>setEditing(blankEmployee())}><Plus/>Nuevo trabajador</Button>}</>}/>
    {error&&<p role="alert">{error}</p>}
    <SummaryMetricGrid aria-label="Resumen de plantilla">
        <SummaryMetricCard icon={UsersRound} label={teams?"Equipos":"Trabajadores activos"} value={String(teams?groups.length:rows.filter(e=>e.profile.state!=="Baja").length)} />
        <SummaryMetricCard icon={Wallet} label="Coste mensual de referencia" value={money(total(rows))} />
        <SummaryMetricCard icon={Clock3} label="Coste medio por hora" value={duration(rows)?money(total(rows)/duration(rows)):"—"} />
        <SummaryMetricCard icon={CalendarClock} label="Horas contratadas / mes" value={hours(duration(rows))} />
    </SummaryMetricGrid>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="grid gap-1 text-sm font-medium">Buscar<Input placeholder="Nombre, cargo o equipo" value={query} onChange={e=>setQuery(e.target.value)}/></label><StaffFilter label="Estado" value={status} options={[...new Set(rows.map(e=>e.profile.state))]} change={setStatus}/><StaffFilter label="Equipo" value={team} options={groups} change={setTeam}/><StaffFilter label="Contrato" value={contract} options={[...new Set(rows.flatMap(e=>e.profile.contract?[e.profile.contract]:[]))]} change={setContract}/></div>
    {teams&&<div className="mb-3 grid gap-2 sm:grid-cols-2">{groups.map(g=>{const members=rows.filter(e=>e.team===g);return <Button key={g} variant={team===g?"default":"outline"} onClick={()=>setTeam(team===g?"":g)}>{g} · {members.length} · {money(total(members))}</Button>;})}</div>}
    <RecordLinkNotice phase={linked.phase} error={linked.error} label="la ficha del trabajador" retry={linked.retry} clear={()=>select(null)}/>
    <div ref={containerRef} data-staff-consultation={split?"split":"dialog"} className="grid min-w-0 items-start gap-4" style={{gridTemplateColumns:split&&worker?"minmax(560px,1fr) 360px":"minmax(0,1fr)"}}>
        <StaffEmployeesList people={visible} selected={worker?.id} select={select}/>
        {worker&&<StaffDetailSurface split={split} title="Ficha del trabajador" close={()=>select(null)}>
            <StaffEmployeeDetail key={worker.id} worker={worker} tab={tab} setTab={setTab} compactTabs={!split} close={()=>select(null)} edit={manage?()=>setEditing(worker):undefined} filterTeam={()=>setTeam(worker.team)}/>
        </StaffDetailSurface>}
    </div>
    {editing&&<StaffForm worker={editing} close={()=>setEditing(null)} saved={e=>{setRows([...rows.filter(v=>v.id!==e.id),e].sort((a,b)=>a.name.localeCompare(b.name)));linked.setRecord(e);select(e.id);setEditing(null);}}/>}</main>;
}
