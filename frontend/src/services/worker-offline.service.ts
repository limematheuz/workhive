import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { compressImageForUpload } from "@/lib/image";
import { cachedDay,cacheTasks,sendOfflineWork,type OfflineDraft } from "./offline-work.service";
import { readWorkerPhotos,saveWorkerPhoto,saveWorkerPartBundle,saveWorkerSnapshot,completeWorkerPart,workerOwner,type WorkerSnapshot,type WorkerPhoto } from "./worker-offline-storage";
import type { TaskItem } from "@/types/user";

export async function saveWorkerDay(user:number,company:number,tasks:TaskItem[],snapshot:WorkerSnapshot) {
    await prepareWorkerShell();
    await saveWorkerSnapshot(user,company,snapshot);
    return cacheTasks(user,company,tasks);
}
export async function saveWorkerPart(user:number,company:number,draft:OfflineDraft,files:File[]=[]) {
    const photos=await readWorkerPhotos(user,company);
    if(files.length>8||photos.length+files.length>50)throw new Error("Guarda hasta 8 fotos por parte y sincroniza antes de superar 50 fotos pendientes.");
    const prepared:WorkerPhoto[]=[];
    for(const file of files){const compressed=await compressImageForUpload(file);prepared.push({id:crypto.randomUUID(),owner:workerOwner(user,company),task_id:draft.task_id,part_event_id:draft.event_id,file:compressed,name:compressed.name});}
    try {
        return await saveWorkerPartBundle(user,company,{...draft,expected_user_id:user,expected_company_id:company},prepared);
    } catch(error) {
        if(error instanceof DOMException&&error.name==="QuotaExceededError")throw new Error("El dispositivo no tiene espacio suficiente. Sincroniza los pendientes o guarda menos fotos antes de continuar.");
        throw error;
    }
}
export async function synchronizeWorkerDay(user:number,company:number) {
    const day=await cachedDay(user,company),photos=await readWorkerPhotos(user,company);
    for(const draft of day.queue){
        await sendOfflineWork({...draft,expected_user_id:user,expected_company_id:company});
        for(const photo of photos.filter(row=>row.part_event_id===draft.event_id)){
            if(photo.owner!==workerOwner(user,company))throw new Error("La foto pertenece a otra cuenta.");
            if(!photo.report_id){
                const body=new FormData();body.set("task_id",String(photo.task_id));body.set("expected_user_id",String(user));body.set("expected_company_id",String(company));body.set("client_event_id",photo.id);body.set("file",photo.file,photo.name);
                const response=await apiFetch("/api/v1/worker-workspace/photos",{method:"POST",body});
                await assertApiResponseOk(response,"La foto sigue pendiente de sincronizar.");
                const report:{id:number}=await response.json();await saveWorkerPhoto({...photo,report_id:report.id});
            }
        }
        await completeWorkerPart(user,company,draft.event_id,photos.filter(row=>row.part_event_id===draft.event_id).map(row=>row.id));
    }
    return cachedDay(user,company);
}
export async function prepareWorkerShell() {
    if(!("serviceWorker" in navigator))throw new Error("El navegador no admite preparación sin conexión.");
    await navigator.serviceWorker.register("/worker-sw.js",{scope:"/worker"});
    const cache=await caches.open("workhive-worker-shell-v1");
    const assets=new Set<string>();
    for(const path of ["/worker","/worker/jobs","/worker/clock","/worker/issues"]){
        const response=await fetch(path,{credentials:"same-origin"});
        if(!response.ok||response.redirected)throw new Error("Vuelve a iniciar sesión antes de preparar la app sin conexión.");
        const html=await response.clone().text();await cache.put(path,response);
        const document=new DOMParser().parseFromString(html,"text/html");
        for(const element of document.querySelectorAll("script[src],link[rel=stylesheet]")){const raw=element.getAttribute("src")??element.getAttribute("href");if(raw){const url=new URL(raw,location.origin);if(url.origin===location.origin&&url.pathname.startsWith("/_next/static/"))assets.add(url.href);}}
    }
    for(const entry of performance.getEntriesByType("resource")){const url=new URL(entry.name);if(url.origin===location.origin&&url.pathname.startsWith("/_next/static/"))assets.add(url.href);}
    await cache.addAll([...assets]);
}
