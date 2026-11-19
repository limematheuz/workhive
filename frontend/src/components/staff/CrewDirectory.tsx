"use client";
import {CompanyViewSession} from "@/components/company/CompanyViewSession";
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
import {StaffService,monthly,type Employee} from "@/services/staff.service";
import {planningRequest,type WorkCrew} from "@/services/service-planning.service";
import {formatCurrency} from "@/lib/format";
import {useStaffConsultationLayout} from "@/hooks/useStaffConsultationLayout";
import {StaffDetailSurface} from "./StaffDetailSurface";
import {CrewList} from "./CrewList";
import {CrewDetail} from "./CrewDetail";
function crewSnapshot(crews:WorkCrew[],people:Employee[]){
 const peopleById=new Map(people.map(person=>[person.id,person])),members=new Set<number>();
 let active=0,total=0,hours=0;
 for(const crew of crews)if(crew.is_active){active++;for(const id of crew.employee_ids)members.add(id);}
 for(const id of members){const person=peopleById.get(id);if(person){total+=monthly(person);hours+=Number(person.monthly_hours);}}
 return {peopleById,members,active,total,hours};
}
export function CrewDirectory(){return <CompanyViewSession><CrewWorkspace/></CompanyViewSession>;}
function CrewWorkspace(){
 const {containerRef,split}=useStaffConsultationLayout();
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
 const current=selected===-1?undefined:selected!==null?crews.find(crew=>crew.id===selected):split?visible[0]:undefined;const team=current?current.employee_ids.flatMap(id=>{const person=snapshot.peopleById.get(id);return person?[person]:[]}):[];
 return <div className="dashboard-page-content space-y-4"><PageHeader icon={UsersRound} title="Equipos de trabajo" subtitle="Equipos de la plantilla para asignar espacios, controlar su composición y consultar costes." actions={<><Button asChild variant="outline"><Link href="/dashboard/plantilla/trabajadores">Ver trabajadores</Link></Button>{manage&&<Button onClick={()=>setEdit(null)}><Plus size={16}/>Nuevo equipo</Button>}</>}/>
 <SummaryMetricGrid><SummaryMetricCard icon={UsersRound} label="Equipos disponibles" value={String(snapshot.active)}/><SummaryMetricCard icon={UserRound} label="Trabajadores en equipos" value={String(snapshot.members.size)}/><SummaryMetricCard icon={Wallet} label="Coste mensual de referencia" value={formatCurrency(snapshot.total)} description="Personas únicas de equipos disponibles"/><SummaryMetricCard icon={Clock3} label="Horas contratadas / mes" value={snapshot.hours+" h"}/></SummaryMetricGrid>
 {error&&<p role="alert" className="text-orange-700">{error}</p>}<Input aria-label="Buscar equipo" placeholder="Buscar equipo" value={query} onChange={e=>setQuery(e.target.value)}/>
 <div ref={containerRef} data-staff-consultation={split?"split":"dialog"} className="grid min-w-0 items-start gap-4" style={{gridTemplateColumns:split&&current?"minmax(560px,1fr) 360px":"minmax(0,1fr)"}}>
    <CrewList crews={visible} people={snapshot.peopleById} selected={current?.id} select={setSelected}/>
    {current&&<StaffDetailSurface split={split} title="Ficha del equipo de trabajo" close={()=>setSelected(-1)}><CrewDetail key={current.id} crew={current} people={team} close={()=>setSelected(-1)} edit={manage?()=>setEdit(current):undefined}/></StaffDetailSurface>}
 </div>
 {edit!==undefined&&<CrewForm crew={edit} people={people} close={()=>setEdit(undefined)} saved={()=>{setEdit(undefined);void reload();}}/>}</div>;
}
