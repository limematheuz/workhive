"use client";
import Link from "next/link";
import { createContext,use,useCallback,useEffect,useMemo,useState,useSyncExternalStore,type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays,ClipboardList,Clock3,ShieldAlert,FileText,MessageSquare,WifiOff,RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TechTaskDetails } from "@/components/dashboard/TechTaskDetails";
import { useUser } from "@/lib/user-context";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { TaskService,type TaskItem } from "@/services/task.service";
import { LocationService,type Location } from "@/services/location.service";
import { readWorkerContext,type WorkerContext } from "@/services/worker-workspace.service";
import { cachedDay } from "@/services/offline-work.service";
import { readWorkerSnapshot,type WorkerLocation } from "@/services/worker-offline-storage";
import { sortWorkerTasks,workerTaskProjection } from "@/domain/tasks/worker-day";
import {CompanySwitcher} from "@/components/dashboard/CompanySwitcher";
import {readTaskLocationDetails,taskLocationIds} from "@/lib/task-locations";

type WorkspaceData={context:WorkerContext;tasks:TaskItem[];locations:WorkerLocation[];liveLocations:Location[];taskError:string;locationError:string};
type WorkerWorkspaceValue=WorkspaceData&{online:boolean;reload:()=>void;openTask:(task:TaskItem)=>void;locationName:(id:number)=>string};
const WorkerWorkspaceContext=createContext<WorkerWorkspaceValue|null>(null);
const WORKER_TABS=[{href:"/worker",label:"Jornada",icon:CalendarDays},{href:"/worker/jobs",label:"Mis trabajos",icon:ClipboardList},{href:"/worker/clock",label:"Fichaje",icon:Clock3},{href:"/worker/issues",label:"Incidencias",icon:ShieldAlert}];
const subscribe=(changed:()=>void)=>{window.addEventListener("online",changed);window.addEventListener("offline",changed);return()=>{window.removeEventListener("online",changed);window.removeEventListener("offline",changed);};};
export const useWorkerOnline=()=>useSyncExternalStore(subscribe,()=>navigator.onLine,()=>true);
export function useWorkerWorkspace(){const value=use(WorkerWorkspaceContext);if(!value)throw new Error("La app necesita su espacio de trabajador.");return value;}
export function WorkerWorkspace({children}:{children:ReactNode}) {
    const {user}=useUser();
    return user?.company_id?<WorkerSession key={user.company_id+":"+user.id} userId={user.id} companyId={user.company_id}>{children}</WorkerSession>:null;
}
function WorkerSession({userId,companyId,children}:{userId:number;companyId:number;children:ReactNode}) {
    const {user}=useUser();const online=useWorkerOnline(),pathname=usePathname();
    const [revision,setRevision]=useState(0),[data,setData]=useState<WorkspaceData|null>(null),[error,setError]=useState("");
    const [selected,setSelected]=useState<number|null>(null);
    const request=useCallback(async():Promise<WorkspaceData>=>{
        if(!online){const [day,snapshot]=await Promise.all([cachedDay(userId,companyId),readWorkerSnapshot(userId,companyId)]);if(!snapshot)throw new Error("Esta cuenta todavía no ha preparado su jornada en este dispositivo. Conéctate para descargarla.");return{context:snapshot.context,tasks:day.tasks,locations:snapshot.locations,liveLocations:[],taskError:"",locationError:""};}
        const context=await readWorkerContext();
        const [tasks,locations]=await Promise.allSettled([context.features.includes("features.work_orders")?TaskService.getAllTaskItems({userId}):Promise.resolve<TaskItem[]>([]),LocationService.getLocations()]);
        const ownTasks=tasks.status==="fulfilled"?sortWorkerTasks(tasks.value.map(workerTaskProjection)):[];
        const master=locations.status==="fulfilled"?locations.value:[];
        const ids=taskLocationIds(ownTasks);
        const details=await readTaskLocationDetails(ids,master,id=>LocationService.getLocation(id));
        const liveLocations=[...master,...details];
        const known=new Set(liveLocations.map(location=>location.id));
        return {context,tasks:ownTasks,liveLocations,locations:liveLocations,taskError:tasks.status==="rejected"?(tasks.reason instanceof Error?tasks.reason.message:"No se pudieron consultar tus trabajos."):"",locationError:locations.status==="rejected"||ids.some(id=>!known.has(id))?"No se pueden consultar todos los detalles de las ubicaciones con este acceso.":""};
    },[online,userId,companyId]);
    const receive=useCallback((value:WorkspaceData)=>{setData(value);setError("");},[]);
    const failed=useCallback((cause:unknown)=>{setData(null);setError(cause instanceof Error?cause.message:"No se pudo cargar tu espacio de trabajador.");},[]);
    useResourceEffect(true,String(revision),request,receive,failed);
    const reload=useCallback(()=>setRevision(value=>value+1),[]);
    useEffect(()=>{window.addEventListener("workhive:tasks-changed",reload);window.addEventListener("workhive:session-changed",reload);return()=>{window.removeEventListener("workhive:tasks-changed",reload);window.removeEventListener("workhive:session-changed",reload);};},[reload]);
    const names=useMemo(()=>new Map(data?.locations.map(location=>[location.id,location.name])??[]),[data?.locations]);
    const locationName=useCallback((id:number)=>names.get(id)??"Ubicación #"+id,[names]);
    const openTask=useCallback((task:TaskItem)=>{if(online)setSelected(task.id);},[online]);
    const value=useMemo(()=>data?{...data,online,reload,openTask,locationName}:null,[data,online,reload,openTask,locationName]);
    const task=data?.tasks.find(task=>task.id===selected);
    return <div className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="min-w-0 space-y-1"><p className="text-sm font-medium">{data?.context.employee?.position??"Espacio del trabajador"}</p>{online?<CompanySwitcher className="w-full sm:w-64"/>:<p className="text-xs text-muted-foreground">Empresa #{companyId} · Datos preparados</p>}</div><div className="flex flex-wrap gap-1">{online?<><Button asChild variant="ghost" size="sm"><Link href="/worker/documents"><FileText className="size-4"/>Mis documentos</Link></Button><Button asChild variant="ghost" size="sm"><Link href="/worker/requests"><MessageSquare className="size-4"/>Mis solicitudes</Link></Button></>:<span className="max-w-56 text-xs text-muted-foreground">Documentos y solicitudes requieren conexión.</span>}<Button variant="ghost" size="icon" aria-label="Actualizar mi jornada" onClick={reload}><RefreshCw className="size-4"/></Button></div></div>
        {!online&&<p role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-orange-400/40 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300"><WifiOff className="size-4 shrink-0"/>Sin conexión. Los partes y fotos se guardan en este dispositivo hasta sincronizarlos.</p>}
        {error?<div role="alert" className="space-y-3 rounded-xl border border-orange-400/40 p-4"><p>{error}</p><Button variant="outline" onClick={reload}>Volver a intentar</Button></div>:!value?<p role="status" className="rounded-xl border p-6 text-sm text-muted-foreground">Cargando tus trabajos y tu acceso…</p>:<WorkerWorkspaceContext.Provider value={value}>{!value.context.employee&&<p className="mb-4 rounded-xl border border-orange-400/40 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">Tu cuenta aún no está vinculada a una ficha de trabajador. Podrás trabajar en las tareas asignadas a tu acceso; la empresa debe vincular tu ficha para documentos y solicitudes personales.</p>}{children}</WorkerWorkspaceContext.Provider>}
        <nav aria-label="App del trabajador" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"><div className="mx-auto grid max-w-3xl grid-cols-4">{WORKER_TABS.map(item=>{const active=pathname===item.href;const Icon=item.icon;const content=<><Icon aria-hidden="true" className="size-5"/><span className="text-[11px] font-medium">{item.label}</span></>;const className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 "+(active?"bg-accent/10 text-accent":"text-muted-foreground hover:bg-muted");return online?<Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={className}>{content}</Link>:<a key={item.href} href={item.href} aria-current={active?"page":undefined} className={className}>{content}</a>;})}</div></nav>
        {task&&user&&online&&<TechTaskDetails key={task.id} task={task} location={data?.liveLocations.find(location=>location.id===task.location_id)??null} locationName={locationName(task.location_id)} currentUser={user} workerMode workerEmployeeId={data?.context.employee?.id} onBack={()=>setSelected(null)} onStatusUpdate={reload}/>}
    </div>;
}
