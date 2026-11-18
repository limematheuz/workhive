import {apiFetch, assertApiResponseOk} from "@/lib/api";
import type {TaskItem} from "@/types/user";
export type OfflineDraft = {
    expected_user_id?:number;
    expected_company_id?:number;
    event_id:string; task_id:number; starts_at:string; ends_at:string; paused_seconds:number;
    checklist_ids:number[]; description:string;
};
export type OfflineReceipt = OfflineDraft & {id:number; user_id:number; status:string};
type CachedDay = {tasks:TaskItem[]; savedAt:string; queue:OfflineDraft[]};
function key(user:number,company:number) {return company + ":" + user;}
export function openOfflineDatabase():Promise<IDBDatabase> {
    return new Promise((resolve,reject)=>{
        const request=indexedDB.open("workhive-offline",2);
        request.onupgradeneeded=()=>{
            const db=request.result;
            if(!db.objectStoreNames.contains("days"))db.createObjectStore("days");
            if(!db.objectStoreNames.contains("worker_metadata"))db.createObjectStore("worker_metadata");
            if(!db.objectStoreNames.contains("worker_photos")){const store=db.createObjectStore("worker_photos",{keyPath:"id"});store.createIndex("owner","owner");}
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
    });
}
async function dayTransaction(user:number,company:number,change?:(day:CachedDay)=>CachedDay):Promise<CachedDay> {
    const db=await openOfflineDatabase();
    return new Promise((resolve,reject)=>{
        const transaction=db.transaction("days",change?"readwrite":"readonly");
        const store=transaction.objectStore("days");
        const request=store.get(key(user,company));
        let result:CachedDay={tasks:[],savedAt:"",queue:[]};
        request.onsuccess=()=>{
            result=request.result??result;
            if(change){result=change(result);store.put(result,key(user,company));}
        };
        transaction.oncomplete=()=>{db.close();resolve(result);};
        transaction.onabort=()=>{db.close();reject(transaction.error??new Error("No se pudo guardar en el dispositivo."));};
        transaction.onerror=()=>{db.close();reject(transaction.error);};
    });
}
export function cachedDay(user:number,company:number) {return dayTransaction(user,company);}
export function cacheTasks(user:number,company:number,tasks:TaskItem[]) {
    return dayTransaction(user,company,day=>({...day,tasks,savedAt:new Date().toISOString()}));
}
export function queueOfflineDraft(user:number,company:number,draft:OfflineDraft) {
    return dayTransaction(user,company,day=>({...day,queue:[...day.queue.filter(d=>d.event_id!==draft.event_id),draft]}));
}
export function acknowledgeOfflineDraft(user:number,company:number,eventId:string) {
    return dayTransaction(user,company,day=>({...day,queue:day.queue.filter(d=>d.event_id!==eventId)}));
}
export async function sendOfflineWork(body:OfflineDraft):Promise<OfflineReceipt> {
    const response = await apiFetch("/api/v1/offline-work",{method:"POST",body:JSON.stringify(body)});
    await assertApiResponseOk(response,"No se pudo sincronizar el parte.");
    return response.json();
}
export async function readOfflineWork(review=false):Promise<OfflineReceipt[]> {
    const response = await apiFetch("/api/v1/offline-work?review="+review,{cache:"no-store"});
    await assertApiResponseOk(response,"No se pudieron cargar los partes.");
    return response.json();
}
export async function reviewOfflineWork(id:number,decision:"approved"|"rejected") {
    const response = await apiFetch("/api/v1/offline-work/"+id+"/review",{method:"POST",body:JSON.stringify({decision})});
    await assertApiResponseOk(response,"No se pudo revisar el parte.");
}

export async function prepareOfflineShell() {
    if (!("serviceWorker" in navigator)) throw new Error("Este navegador no admite la apertura sin conexión.");
    await navigator.serviceWorker.register("/workhive-offline.js",{scope:"/dashboard/mi-jornada"});
    await navigator.serviceWorker.ready;
    const cache = await caches.open("workhive-offline-v1");
    const assets = performance.getEntriesByType("resource").map(entry => entry.name)
        .filter(name => new URL(name).origin === location.origin && new URL(name).pathname.startsWith("/_next/static/"));
    await cache.addAll([...new Set(["/dashboard/mi-jornada", ...assets])]);
}
