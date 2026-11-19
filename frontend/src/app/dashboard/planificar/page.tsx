"use client";
import {Suspense,useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {QuickWorkForm} from "@/components/operations/QuickWorkForm";
import {PremiumTabs} from "@/components/ui/premium-tabs";
import {CalendarClock} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {ServicePlanner} from "@/components/operations/ServicePlanner";
import {LocationService,type Location} from "@/services/location.service";
import {WorkOrderService} from "@/services/work-order.service";
import type {WorkOrderContractCandidate} from "@/types/work-order";
function PlanningWorkspace(){
 const params=useSearchParams();const [selectedMode,setSelectedMode]=useState<string|null>(null);const mode=selectedMode??(params.get("mode")==="quick"?"quick":"spaces");const serviceId=Number(params.get("service"))||undefined;
 const [locations,setLocations]=useState<Location[]>([]),[contracts,setContracts]=useState<WorkOrderContractCandidate[]>([]),[error,setError]=useState("");
 useEffect(()=>{let active=true;Promise.all([LocationService.getLocations(),WorkOrderService.getContractCandidates()]).then(([sites,contracts])=>{if(active){setLocations(sites);setContracts(contracts);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <div className="dashboard-page-content space-y-4"><PageHeader icon={CalendarClock} title="Planificar trabajo" subtitle="Ubicación, espacios, tareas y equipo. Una limpieza puede cubrir solo una parte del centro."/>{error&&<p role="alert" className="text-orange-700">{error}</p>}<PremiumTabs activeTab={mode} onChange={setSelectedMode} tabs={[{id:"spaces",label:"Por espacios y tareas"},{id:"quick",label:"Trabajo general o puntual"}]}/>{mode==="quick"?<QuickWorkForm initialServiceId={serviceId}/>:<ServicePlanner locations={locations} contracts={contracts}/>}</div>;
}

export default function PlanningPage(){return <Suspense fallback={<p role="status" className="p-6">Cargando planificación…</p>}><PlanningWorkspace/></Suspense>;}
