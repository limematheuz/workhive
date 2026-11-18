"use client";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-context";
import { canApproveTime } from "@/domain/access/roles";
import { readOfflineWork, reviewOfflineWork, type OfflineReceipt } from "@/services/offline-work.service";
export default function OfflineReviewPage() {
    const { user, loading } = useUser();
    const manager = canApproveTime(user);
    const [rows, setRows] = useState<OfflineReceipt[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const request = useCallback(() => readOfflineWork(manager), [manager]);
    const receive = useCallback((rows: Awaited<ReturnType<typeof request>>) => { setRows(rows); setError(""); }, []);
    const failed = useCallback((error: unknown) => setError(error instanceof Error ? error.message : "No se pudieron cargar los partes."), []);
    async function reload() { try {
        receive(await request());
    }
    catch (error) {
        failed(error);
    } }
    useResourceEffect(Boolean(user), `${user?.company_id}:${user?.id}`, request, receive, failed);
    async function decide(id: number, decision: "approved" | "rejected") {
        setBusy(true);
        try {
            await reviewOfflineWork(id, decision);
            await reload();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo revisar.");
        }
        finally {
            setBusy(false);
        }
    }
    if (loading)
        return <p>Cargando…</p>;
    return <div className="dashboard-page-content space-y-3">
        <PageHeader icon={ClipboardCheck} title="Partes sin conexión" subtitle="La aprobación incorpora el fichaje y las tareas realizadas al control del servicio." actions={<Button variant="outline" onClick={() => void reload()}>Actualizar</Button>}/>
        {error && <p role="alert" className="text-orange-700">{error}</p>}
        {!rows.length && !error && <p>Sin partes enviados.</p>}
        {rows.map(row => <article key={row.id} className="space-y-2 rounded-xl border p-4">
            <Link className="font-semibold underline" href={"/dashboard?taskId=" + row.task_id}>Trabajo #{row.task_id}</Link>
            <p>{new Date(row.starts_at).toLocaleString()} — {new Date(row.ends_at).toLocaleString()} · {row.paused_seconds / 60} min de pausa</p>
            <p>{row.description}</p><p>{row.checklist_ids.length} tareas declaradas realizadas</p>
            <span className={row.status === "pending" ? "text-orange-700" : ""}>{({ pending: "Pendiente de aprobación", approved: "Aprobado", rejected: "Rechazado" } as Record<string, string>)[row.status]}</span>
            {manager && row.status === "pending" && <div className="flex gap-2"><Button disabled={busy} onClick={() => void decide(row.id, "approved")}>Aprobar parte</Button><Button variant="outline" disabled={busy} onClick={() => void decide(row.id, "rejected")}>Rechazar</Button></div>}
        </article>)}
    </div>;
}
