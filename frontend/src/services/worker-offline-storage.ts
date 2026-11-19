import { openOfflineDatabase } from "./offline-work.service";
import type {OfflineDraft} from "./offline-work.service";
import type { WorkerContext } from "./worker-workspace.service";
export type WorkerLocation = { id:number; name:string; address:string; city:string };
export type WorkerSnapshot = { context:WorkerContext; locations:WorkerLocation[] };
export type WorkerPhoto = { id:string; owner:string; task_id:number; part_event_id:string; file:Blob; name:string; report_id?:number };
export const workerOwner=(user:number,company:number)=>company+":"+user;

async function transaction<T>(storeName:string,mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
    const db=await openOfflineDatabase();
    return new Promise((resolve,reject)=>{
        const tx=db.transaction(storeName,mode),request=run(tx.objectStore(storeName));let result:T;
        request.onsuccess=()=>{result=request.result;};
        tx.oncomplete=()=>{db.close();resolve(result);};
        tx.onerror=()=>{db.close();reject(tx.error??new Error("No se pudo guardar en el dispositivo."));};
        tx.onabort=()=>{db.close();reject(tx.error??new Error("El guardado en el dispositivo quedó incompleto."));};
    });
}
export const readWorkerSnapshot=(user:number,company:number)=>transaction<WorkerSnapshot|undefined>("worker_metadata","readonly",store=>store.get(workerOwner(user,company)));
export const saveWorkerSnapshot=(user:number,company:number,snapshot:WorkerSnapshot)=>transaction("worker_metadata","readwrite",store=>store.put(snapshot,workerOwner(user,company)));
export const readWorkerPhotos=(user:number,company:number)=>transaction<WorkerPhoto[]>("worker_photos","readonly",store=>store.index("owner").getAll(workerOwner(user,company)));
export const saveWorkerPhoto=(photo:WorkerPhoto)=>transaction("worker_photos","readwrite",store=>store.put(photo));
export async function saveWorkerPartBundle(user:number,company:number,draft:OfflineDraft,photos:WorkerPhoto[]){
    const db=await openOfflineDatabase();
    return new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(["days","worker_photos"],"readwrite"),days=tx.objectStore("days"),files=tx.objectStore("worker_photos");
        const request=days.get(workerOwner(user,company));
        request.onsuccess=()=>{
            const day=request.result??{tasks:[],savedAt:"",queue:[]};
            days.put({...day,queue:[...day.queue.filter((row:OfflineDraft)=>row.event_id!==draft.event_id),draft]},workerOwner(user,company));
            for(const photo of photos)files.put(photo);
        };
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onerror=()=>{db.close();reject(tx.error??new Error("No se pudo guardar el parte completo en el dispositivo."));};
        tx.onabort=()=>{db.close();reject(tx.error??new Error("El parte y sus fotos no se han guardado. Vuelve a intentarlo."));};
    });
}
export async function completeWorkerPart(user:number,company:number,eventId:string,photoIds:string[]) {
    const db=await openOfflineDatabase();
    return new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(["days","worker_photos"],"readwrite"),days=tx.objectStore("days"),request=days.get(workerOwner(user,company));
        request.onsuccess=()=>{const day=request.result;if(day)days.put({...day,queue:day.queue.filter((draft:{event_id:string})=>draft.event_id!==eventId)},workerOwner(user,company));for(const id of photoIds)tx.objectStore("worker_photos").delete(id);};
        tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};
    });
}
