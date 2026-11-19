"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {CloudDownload} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {Button} from "@/components/ui/button";
import {useUser} from "@/lib/user-context";
import {TaskService} from "@/services/task.service";
import type {TaskItem} from "@/types/user";
import {cachedDay,cacheTasks,queueOfflineDraft,acknowledgeOfflineDraft,prepareOfflineShell,sendOfflineWork,type OfflineDraft} from "@/services/offline-work.service";
import {OfflineReportForm} from "@/components/operations/OfflineReportForm";

export default function OfflineDayPage() {
    const {user,loading} = useUser();
    const [tasks,setTasks] = useState<TaskItem[]>([]);
    const [queue,setQueue] = useState<OfflineDraft[]>([]);
    const [savedAt,setSavedAt] = useState("");
    const [message,setMessage] = useState("");
    const [busy,setBusy] = useState(false);
    useEffect(() => {
        if(!user?.company_id) return;
        void cachedDay(user.id,user.company_id).then(day=>{setTasks(day.tasks);setQueue(day.queue);setSavedAt(day.savedAt);}).catch(e=>setMessage(e.message));
        if("serviceWorker" in navigator) navigator.serviceWorker.register("/workhive-offline.js",{scope:"/dashboard/mi-jornada"}).catch(() => setMessage("No se pudo preparar la apertura sin conexión."));
    },[user?.id,user?.company_id,user]);
    async function downloadDay() {
        if(!user) return;
        setBusy(true);setMessage("");
        try {
            const work = await TaskService.getAllTaskItems({userId:user.id});
            await prepareOfflineShell();
            if(!user.company_id)return;
            const day=await cacheTasks(user.id,user.company_id,work);
            localStorage.setItem("workhive_offline_identity:v1",JSON.stringify(user));
            setTasks(day.tasks);setQueue(day.queue);setSavedAt(day.savedAt);
            setMessage("Jornada guardada. Puedes abrir esta pantalla y preparar partes sin conexión.");
        } catch(e) {setMessage(e instanceof Error ? e.message : "No se pudo descargar.");}
        finally {setBusy(false);}
    }
    async function synchronize() {
        const companyId = user?.company_id;
        if(!user || !companyId) return;
        setBusy(true);setMessage("");
        try {
            const results = await Promise.allSettled(queue.map(async draft => {
                await sendOfflineWork(draft);
                return acknowledgeOfflineDraft(user.id, companyId, draft.event_id);
            }));
            const latestDay = await cachedDay(user.id, companyId);
            setQueue(latestDay.queue);
            const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
            if (failed) throw failed.reason;
            setMessage("Partes sincronizados y pendientes de aprobación del responsable.");
        } catch(e) {setMessage(e instanceof Error ? e.message : "La sincronización quedó pendiente.");}
        finally {setBusy(false);}
    }
    if(loading) return <p>Cargando…</p>;
    if(!user) return <p>Inicia sesión para preparar tu jornada.</p>;
    return <div className="dashboard-page-content space-y-3">
        <PageHeader icon={CloudDownload} title="Mi jornada sin conexión" subtitle="Guarda tus trabajos antes de salir. Los partes se conservan en este dispositivo hasta su sincronización." />
        <div className="flex flex-wrap items-center gap-2"><Button disabled={busy} onClick={() => void downloadDay()}>Guardar mi jornada</Button><Button variant="outline" disabled={busy || !queue.length} onClick={() => void synchronize()}>Sincronizar {queue.length} partes</Button>
            <Link className="text-sm underline" href="/dashboard/offline-review">Consultar partes enviados</Link></div>
        <p className="text-sm text-muted-foreground">{savedAt ? "Última descarga " + new Date(savedAt).toLocaleString() : "Prepara la jornada mientras tengas conexión."}</p>
        {message && <p role="status" className="text-orange-700">{message}</p>}
        {queue.length>0 && <p className="text-orange-700">{queue.length} partes guardados pendientes de enviar.</p>}
        {tasks.flatMap(task => !task.is_invoiced ? [<OfflineReportForm key={task.id} task={task} save={async draft => {
            if(!user.company_id)return;
            const day=await queueOfflineDraft(user.id,user.company_id,draft);setQueue(day.queue);setMessage("Parte guardado en el dispositivo. Sincronízalo cuando recuperes la conexión.");
        }} />] : [])}
    </div>;
}
