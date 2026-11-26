"use client";
import {useCallback,useMemo,useState} from "react";
import Link from "next/link";
import {UsersRound,Plus,Wallet,Clock3,UserRound} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {SummaryMetricGrid,SummaryMetricCard} from "@/components/ui/summary-metric-card";
import {CrewForm} from "./CrewForm";
import {useUser} from "@/lib/user-context";
import {useResourceEffect} from "@/hooks/useResourceEffect";
import {canManageLaborCosts,canViewLaborCosts} from "@/domain/access/roles";
import {StaffService,monthly,hourly,type Employee} from "@/services/staff.service";
import {planningRequest,type WorkCrew} from "@/services/service-planning.service";
import {formatCurrency} from "@/lib/format";
function crewSnapshot(crews:WorkCrew[],people:Employee[]){
 const peopleById=new Map(people.map(person=>[person.id,person])),members=new Set<number>();
 let active=0,total=0,hours=0;
 for(const crew of crews)if(crew.is_active){active++;for(const id of crew.employee_ids)members.add(id);}
 for(const id of members){const person=peopleById.get(id);if(person){total+=monthly(person);hours+=Number(person.monthly_hours);}}
 return {peopleById,members,active,total,hours};
}
export function CrewDirectory(){
 const {user,loading}=useUser();const allowed=canViewLaborCosts(user),manage=canManageLaborCosts(user);
 const [crews,setCrews]=useState<WorkCrew[]>([]),[people,setPeople]=useState<Employee[]>([]),[query,setQuery]=useState(""),[selected,setSelected]=useState<number|null>(null),[edit,setEdit]=useState<WorkCrew|null|undefined>(undefined),[error,setError]=useState("");
 const [loadedScope,setLoadedScope]=useState(""),[revision,setRevision]=useState(0);
 const scope=`${user?.company_id}:${user?.id}`;
 const request=useCallback(()=>Promise.all([planningRequest<WorkCrew[]>("work-crews"),StaffService.list()]),[]);
 const receive=useCallback(([crews,people]:Awaited<ReturnType<typeof request>>)=>{setCrews(crews);setPeople(people);setError("");setLoadedScope(scope);},[scope]);
 const failed=useCallback((cause:unknown)=>{setError(cause instanceof Error?cause.message:"No se pudieron consultar los equipos y su plantilla.");setLoadedScope(scope);},[scope]);
 useResourceEffect(allowed,scope+":"+revision,request,receive,failed);
 const snapshot=useMemo(()=>crewSnapshot(crews,people),[crews,people]);
 async function reload(){try{receive(await request());}catch(e){failed(e);}}
 if(loading||(allowed&&loadedScope!==scope))return <p role="status" className="p-6 text-sm text-muted-foreground">Cargando equipos y trabajadores registrados…</p>;if(!allowed)return <p>Acceso restringido.</p>;
 if(error)return <div className="dashboard-page-content space-y-4"><PageHeader icon={UsersRound} title="Equipos de trabajo" subtitle="Composición y costes de los equipos de la plantilla"/><div role="alert" className="space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4"><p className="text-sm text-orange-700 dark:text-orange-300">{error}</p><Button variant="outline" onClick={()=>{setLoadedScope("");setRevision(value=>value+1);}}>Volver a consultar los equipos</Button></div></div>;
 const visible=crews.filter(crew=>(crew.name+" "+crew.description).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const current=visible.find(crew=>crew.id===selected)??visible[0];const team=current?current.employee_ids.flatMap(id=>{const person=snapshot.peopleById.get(id);return person?[person]:[]}):[];
 return <div className="dashboard-page-content space-y-4"><PageHeader icon={UsersRound} title="Equipos de trabajo" subtitle="Equipos de la plantilla para asignar espacios, controlar su composición y consultar costes." actions={<><Button asChild variant="outline"><Link href="/dashboard/plantilla/trabajadores">Ver trabajadores</Link></Button>{manage&&<Button onClick={()=>setEdit(null)}><Plus size={16}/>Nuevo equipo</Button>}</>}/>
 <SummaryMetricGrid><SummaryMetricCard icon={UsersRound} label="Equipos disponibles" value={String(snapshot.active)}/><SummaryMetricCard icon={UserRound} label="Trabajadores en equipos" value={String(snapshot.members.size)}/><SummaryMetricCard icon={Wallet} label="Coste mensual de referencia" value={formatCurrency(snapshot.total)} description="Personas únicas de equipos disponibles"/><SummaryMetricCard icon={Clock3} label="Horas contratadas / mes" value={snapshot.hours+" h"}/></SummaryMetricGrid>
 {error&&<p role="alert" className="text-orange-700">{error}</p>}<Input aria-label="Buscar equipo" placeholder="Buscar equipo" value={query} onChange={e=>setQuery(e.target.value)}/>
 <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)]"><section className="overflow-x-auto rounded-2xl border bg-card"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Equipo","Responsable","Personas","Estado"].map(label=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{visible.map(crew=><tr key={crew.id} className={"border-t "+(crew.id===current?.id?"bg-accent/5":"")}><td className="px-4 py-3"><Button unstyled className="text-left font-medium hover:underline" onClick={()=>setSelected(crew.id)}>{crew.name}</Button><p className="text-xs text-muted-foreground">{crew.description}</p></td><td className="px-4 py-3"><span className={crew.leader_employee_id?"":"text-orange-700"}>{snapshot.peopleById.get(crew.leader_employee_id??-1)?.name??"Pendiente"}</span></td><td className="px-4 py-3">{crew.employee_ids.length}</td><td className="px-4 py-3">{crew.is_active?"Disponible":"Archivado"}</td></tr>)}</tbody></table>{!visible.length&&<p className="p-4 text-sm text-muted-foreground">Sin equipos en esta búsqueda.</p>}</section>
 {current&&<aside className="space-y-4 rounded-2xl border bg-card p-4"><div className="flex justify-between gap-2"><div><h2 className="font-semibold">{current.name}</h2><p className="text-xs text-muted-foreground">{team.length} miembros</p></div>{manage&&<Button size="sm" variant="outline" onClick={()=>setEdit(current)}>Editar equipo</Button>}</div><div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-3"><div><p className="text-xs text-muted-foreground">Coste mensual de referencia</p><strong>{formatCurrency(team.reduce((sum,person)=>sum+monthly(person),0))}</strong></div><div><p className="text-xs text-muted-foreground">Horas contratadas</p><strong>{team.reduce((sum,person)=>sum+Number(person.monthly_hours),0)} h</strong></div></div><ul className="divide-y">{team.map(person=><li key={person.id} className="flex justify-between gap-2 py-2 text-sm"><span className="font-medium">{person.name}<small className="block font-normal text-muted-foreground">{person.position}</small></span><span>{formatCurrency(hourly(person))}/h</span></li>)}</ul><Button asChild variant="outline"><Link href="/dashboard/planificar">Asignar este equipo a un trabajo</Link></Button></aside>}</div>
 {edit!==undefined&&<CrewForm crew={edit} people={people} close={()=>setEdit(undefined)} saved={()=>{setEdit(undefined);void reload();}}/>}</div>;
}
