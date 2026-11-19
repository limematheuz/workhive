"use client";
import { CalendarClock, Clock3, Download, FileText, Plus, UsersRound, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-context";
import { canManageLaborCosts, canViewLaborCosts } from "@/domain/access/roles";
import { blankEmployee,costLabels,hourly,monthly,StaffService,type CostKey,type Employee } from "@/services/staff.service";
import {monthlyBreakdown} from "@/domain/staff/staff-costs";
import { StaffForm } from "./StaffForm";
import { RecordHistoryPanel } from "@/components/history/RecordHistoryPanel";
import { StaffAvailabilitySummary } from "./StaffAvailabilitySummary";
import { FormSelect } from "@/components/ui/form-select";

const money=(n:number)=>n.toLocaleString("es-ES",{style:"currency",currency:"EUR"});
const hours=(n:number)=>n.toLocaleString("es-ES")+" h";
const total=(items:Employee[])=>items.reduce((n,e)=>n+monthly(e),0);
const duration=(items:Employee[])=>items.reduce((n,e)=>n+Number(e.monthly_hours),0);
const STAFF_COLUMNS=["Trabajador","Cargo","Equipo","Contrato","Coste/h","Coste mensual","Horas/mes","Estado"];
function StaffFilter({label,value,options,change}:{label:string;value:string;options:string[];change:(value:string)=>void}){
    return <label>{label}<FormSelect aria-label={label} value={value} onValueChange={change} searchable={label==="Equipo"}><option value="">Todos</option>{options.map(option=><option key={option}>{option}</option>)}</FormSelect></label>;
}
function exportStaff(rows:Employee[]){
    const cells=[["Trabajador","Cargo","Equipo","Contrato","Horas/mes","Coste/h","Coste mensual","Estado"],...rows.map(e=>[e.name,e.position,e.team,e.profile.contract,e.monthly_hours,hourly(e).toFixed(2),monthly(e).toFixed(2),e.profile.state])];
    const csv=cells.map(row=>row.map(cell=>'"'+String(cell).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="plantilla-costes.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function CostHistory({worker}:{worker:Employee}){
    const [all,setAll]=useState(false);
    const entries=Object.entries(worker.history||{}).sort(([a],[b])=>a.localeCompare(b));
    const year=String(new Date().getFullYear());
    const annual=entries.filter(([month])=>month.startsWith(year));
    const recent=entries.slice(-6);
    const peak=Math.max(1,...recent.map(([,v])=>Number(v.cost)));
    return <><h3>Evolución del coste mensual</h3>{recent.length>0?<div className="flex h-24 items-end gap-2" aria-label="Últimos seis meses registrados">{recent.map(([month,v])=><div className="flex h-full flex-1 flex-col justify-end text-center" key={month} title={month+" · "+money(Number(v.cost))}><div className="rounded-t bg-primary" style={{height:Math.max(2,Number(v.cost)/peak*70)+"%"}}/><small>{month.slice(5)}</small></div>)}</div>:<p>Sin meses registrados</p>}
    <h3>Resumen anual · {year}</h3><p>Coste registrado <b>{money(annual.reduce((s,[,v])=>s+Number(v.cost),0))}</b></p><p>Horas contratadas <b>{hours(annual.reduce((s,[,v])=>s+Number(v.hours),0))}</b></p><Button size="sm" variant="outline" onClick={()=>setAll(!all)}>{all?"Cerrar histórico":"Ver histórico completo"}</Button>{all&&entries.map(([month,v])=><p key={month}>{month}<b>{money(Number(v.cost))}</b></p>)}</>;
}

export function StaffDirectory({teams}:{teams:boolean}){
    const {user,loading}=useUser();
    const [rows,setRows]=useState<Employee[]>([]);
    const [error,setError]=useState("");
    const [loadedScope,setLoadedScope]=useState(""),[revision,setRevision]=useState(0);
    const [query,setQuery]=useState(""),[team,setTeam]=useState(""),[contract,setContract]=useState(""),[status,setStatus]=useState("");
    const [selected,setSelected]=useState<number|null>(null),[tab,setTab]=useState("Costes"),[editing,setEditing]=useState<Employee|null>(null);
    const allowed=canViewLaborCosts(user),manage=canManageLaborCosts(user);
    const scope=`${user?.company_id}:${user?.id}`;
    useEffect(()=>{let active=true;if(allowed)StaffService.list().then(value=>{if(active){setRows(value);setError("");setLoadedScope(scope);}}).catch(cause=>{if(active){setError(cause instanceof Error?cause.message:"No se pudo consultar la plantilla.");setLoadedScope(scope);}});return()=>{active=false;};},[allowed,scope,revision]);
    if(loading||(allowed&&loadedScope!==scope))return <p role="status" className="p-6 text-sm text-muted-foreground">Cargando plantilla y costes registrados…</p>;
    if(!allowed)return <p>Acceso restringido a los datos laborales.</p>;
    if(error)return <main className="dashboard-page-content space-y-4"><PageHeader icon={UsersRound} title="Trabajadores" subtitle="Plantilla y costes laborales de la empresa"/><div role="alert" className="space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4"><p className="text-sm text-orange-700 dark:text-orange-300">{error}</p><Button variant="outline" onClick={()=>{setLoadedScope("");setRevision(value=>value+1);}}>Volver a consultar la plantilla</Button></div></main>;
    const groups=[...new Set(rows.flatMap(e=>e.team?[e.team]:[]))].sort();
    const visible=rows.filter(e=>(!team||e.team===team)&&(!status||e.profile.state===status)&&(!contract||e.profile.contract===contract)&&[e.name,e.position,e.team].join(" ").toLowerCase().includes(query.toLowerCase()));
    const worker=visible.find(e=>e.id===selected) ?? (selected===-1?undefined:visible[0]);
    return <main className="dashboard-page-content staff-page"><PageHeader icon={UsersRound} title={teams?"Equipos de trabajo":"Trabajadores"} subtitle="Plantilla y costes laborales de la empresa" actions={<><Button asChild variant="outline"><Link href={teams?"/dashboard/plantilla/trabajadores":"/dashboard/plantilla/equipos"}>{teams?"Trabajadores":"Equipos"}</Link></Button><Button variant="outline" onClick={()=>exportStaff(visible)}><Download/>Exportar</Button><Button variant="outline" onClick={()=>window.print()}><FileText/>Informe de costes</Button>{manage&&<Button onClick={()=>setEditing(blankEmployee())}><Plus/>Nuevo trabajador</Button>}</>}/>
    {error&&<p role="alert">{error}</p>}
    <SummaryMetricGrid aria-label="Resumen de plantilla">
        <SummaryMetricCard icon={UsersRound} label={teams?"Equipos":"Trabajadores activos"} value={String(teams?groups.length:rows.filter(e=>e.profile.state!=="Baja").length)} />
        <SummaryMetricCard icon={Wallet} label="Coste mensual de referencia" value={money(total(rows))} />
        <SummaryMetricCard icon={Clock3} label="Coste medio por hora" value={duration(rows)?money(total(rows)/duration(rows)):"—"} />
        <SummaryMetricCard icon={CalendarClock} label="Horas contratadas / mes" value={hours(duration(rows))} />
    </SummaryMetricGrid>
    <div className="staff-filters"><label>Buscar<Input placeholder="Nombre, cargo o equipo" value={query} onChange={e=>setQuery(e.target.value)}/></label><StaffFilter label="Estado" value={status} options={[...new Set(rows.map(e=>e.profile.state))]} change={setStatus}/><StaffFilter label="Equipo" value={team} options={groups} change={setTeam}/><StaffFilter label="Contrato" value={contract} options={[...new Set(rows.flatMap(e=>e.profile.contract?[e.profile.contract]:[]))]} change={setContract}/></div>
    {teams&&<div className="mb-3 grid gap-2 sm:grid-cols-2">{groups.map(g=>{const members=rows.filter(e=>e.team===g);return <Button key={g} variant={team===g?"default":"outline"} onClick={()=>setTeam(team===g?"":g)}>{g} · {members.length} · {money(total(members))}</Button>;})}</div>}
    <div className="staff-layout"><section className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)]"><div className="overflow-x-auto"><table><thead><tr>{STAFF_COLUMNS.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{visible.map(e=><tr key={e.id} data-selected={worker?.id===e.id} onClick={()=>setSelected(e.id)}><td><button onClick={()=>setSelected(e.id)}>{e.name}</button><small>{e.profile.identifier&&"ID ····"+e.profile.identifier}</small></td><td>{e.position}</td><td>{e.team||"Sin equipo"}</td><td>{e.profile.contract||"Pendiente"}</td><td>{money(hourly(e))}</td><td>{money(monthly(e))}</td><td>{hours(Number(e.monthly_hours))}</td><td><Badge variant="secondary">{e.profile.state}</Badge></td></tr>)}</tbody></table></div><small className="block px-3 py-2">{visible.length} trabajadores</small></section>
    {worker&&<aside className="staff-detail"><div className="flex items-start justify-between"><div><h2>{worker.name}</h2><small>{worker.position} · {worker.profile.state}</small></div><Button size="sm" variant="ghost" aria-label="Cerrar ficha" onClick={()=>setSelected(-1)}>×</Button></div><nav>{["Información","Costes","Disponibilidad","Documentos"].map(k=><button key={k} aria-pressed={tab===k} onClick={()=>setTab(k)}>{k}</button>)}</nav>
    {tab==="Costes"&&<><h3>Desglose de costes mensuales</h3>{monthlyBreakdown(worker)===0&&hourly(worker)>0&&<p className="text-orange-700">Desglose pendiente. La referencia mensual utiliza el coste por hora registrado y las horas contratadas.</p>}{Object.entries(costLabels).map(([k,label])=><p key={k}>{label}<b>{money(Number(worker.profile[k as CostKey]))}</b></p>)}<p className="border-t pt-2">Coste mensual de referencia<strong>{money(monthly(worker))}</strong></p><p>Coste por hora<b>{money(hourly(worker))}</b></p><p>Horas contratadas / mes<b>{hours(Number(worker.monthly_hours))}</b></p><CostHistory worker={worker}/></>}
    {tab==="Información"&&<><p>Cargo<b>{worker.position}</b></p><p>Equipo<Button size="sm" variant="ghost" onClick={()=>setTeam(worker.team)}>{worker.team||"Sin equipo"}</Button></p><p>Contrato<b>{worker.profile.contract||"Pendiente"}</b></p><p>Estado<b>{worker.profile.state}</b></p></>}
    {tab==="Disponibilidad"&&<StaffAvailabilitySummary worker={worker}/>}
    {tab==="Documentos"&&(worker.profile.documents.length?worker.profile.documents.map(d=><p key={d.url}><a href={d.url} target="_blank" rel="noreferrer">{d.name} ↗</a></p>):<p>Sin documentos vinculados</p>)}
    {manage&&<Button size="sm" variant="outline" onClick={()=>setEditing(worker)}>Editar ficha</Button>}<RecordHistoryPanel entityType="staff_employee" entityId={worker.id} /></aside>}</div>
    {editing&&<StaffForm worker={editing} close={()=>setEditing(null)} saved={e=>{setRows([...rows.filter(v=>v.id!==e.id),e].sort((a,b)=>a.name.localeCompare(b.name)));setQuery("");setTeam("");setStatus("");setContract("");setSelected(e.id);setEditing(null);}}/>}</main>;
}
