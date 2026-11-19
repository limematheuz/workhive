import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-context";
import { canManageCompanyTasks, canViewLaborCosts } from "@/domain/access/roles";
import { StaffService } from "@/services/staff.service";
import { TaskService } from "@/services/task.service";
import { LocationDocumentService, type LocationDocumentLibraryItem } from "@/services/location-document.service";

type Entry = { title:string; owner:string; category:string; href:string };
export function DocumentSearch({documents}:{documents:LocationDocumentLibraryItem[]}) {
    const {user}=useUser();
    const [query,setQuery]=useState("");
    const [extras,setExtras]=useState<Entry[]>([]);
    const [warning,setWarning]=useState("");
    const search=query.trim().toLocaleLowerCase();
    const enabled=Boolean(search);
    const personnel=canViewLaborCosts(user),operations=canManageCompanyTasks(user);
    useEffect(()=>{
        let active=true;
        if(!enabled)return;
        const sources:Promise<Entry[]>[]=[];
        if(personnel)sources.push(StaffService.list().then(rows=>rows.flatMap(e=>e.profile.documents.flatMap(d=>(d.url.startsWith("https://")||/^\/api\/v1\/staff-files\/\d+\/download$/.test(d.url))?[{title:d.name,owner:e.name,category:"Personal",href:d.url}]:[]))));
        if(operations)sources.push(TaskService.getAllTaskItems().then(rows=>rows.flatMap(t=>(t.attachments||[]).map(d=>({title:d.name || "Adjunto del trabajo",owner:t.title,category:"Trabajo",href:"/dashboard?taskId="+t.id})))));
        Promise.allSettled(sources).then(results=>{
            if(!active)return;
            setExtras(results.flatMap(r=>r.status==="fulfilled"?r.value:[]));
            setWarning(results.some(r=>r.status==="rejected")?"Algunas fuentes no están disponibles.":"");
        });
        return ()=>{active=false;};
    },[enabled,personnel,operations,user?.id,user?.company_id]);
    const results=[...documents.map(d=>({title:d.name,owner:d.location_name,category:"Ubicación",href:LocationDocumentService.documentDownloadUrl(d.location_id,d.id)})),...extras].filter(r=>(r.title+" "+r.owner+" "+r.category).toLocaleLowerCase().includes(search));
    return <section className="mb-4 space-y-2 rounded-lg border p-3"><label className="text-sm font-semibold">Buscar documentación<Input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Documento, ubicación, trabajador o trabajo"/></label>
        {enabled&&<><small>{results.length} resultados</small>{warning&&<p role="status">{warning}</p>}<ul className="max-h-80 divide-y overflow-y-auto">{results.map(r=><li key={r.category+":"+r.owner+":"+r.href+":"+r.title}><a className="flex flex-wrap justify-between gap-2 py-2 text-sm hover:underline" href={r.href}><strong>{r.title}</strong><span>{r.category} · {r.owner}</span></a></li>)}</ul></>}
    </section>;
}
