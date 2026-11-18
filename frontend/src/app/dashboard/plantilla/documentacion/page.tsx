"use client";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useCallback, useState } from "react";
import Link from "next/link";
import { FileCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-context";
import { canViewLaborCosts } from "@/domain/access/roles";
import { readStaffDocumentation, acknowledgeStaffDocument, type StaffDocument } from "@/services/staff-documentation.service";
export default function StaffDocumentationPage() {
    const { user, loading } = useUser();
    const [own, setOwn] = useState(true);
    const [rows, setRows] = useState<StaffDocument[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const request = useCallback(() => readStaffDocumentation(own), [own]);
    const receive = useCallback((rows: Awaited<ReturnType<typeof request>>) => { setRows(rows); setError(""); }, []);
    const failed = useCallback((error: unknown) => setError(error instanceof Error ? error.message : "No se pudieron cargar los documentos."), []);
    async function reload() { try {
        receive(await request());
    }
    catch (error) {
        failed(error);
    } }
    useResourceEffect(Boolean(user), `${user?.company_id}:${user?.id}`, request, receive, failed);
    async function acknowledge(stamp: string) {
        setBusy(true);
        try {
            await acknowledgeStaffDocument(stamp);
            await reload();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar.");
        }
        finally {
            setBusy(false);
        }
    }
    if (loading)
        return <p>Cargando…</p>;
    return <div className="dashboard-page-content space-y-3">
        <PageHeader icon={FileCheck} title="Documentación y formación" subtitle="Documentos, EPIs, versiones y caducidades." actions={<Button variant="outline" onClick={() => void reload()}>Actualizar</Button>}/>
        {canViewLaborCosts(user) && <div className="flex flex-wrap items-center gap-3"><label className="flex gap-2"><Checkbox checked={!own} onCheckedChange={value => setOwn(value !== true)}/>Ver toda la plantilla</label><Link className="text-sm underline" href="/dashboard/plantilla/trabajadores">Gestionar documentos y accesos vinculados</Link></div>}
        {error && <p role="alert" className="text-orange-700">{error}</p>}
        {!rows.length && !error && <p>Sin documentos vinculados en esta vista.</p>}
        {rows.map(row => <article key={row.employee_id + row.digest} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
            <div><strong>{row.name}</strong><p className="text-sm">{row.employee} · Versión {row.version ?? "1"}</p><p className={row.expired || (!row.expires_on && row.document_type !== "payroll") ? "text-orange-700" : ""}>{row.expired ? "Caducado" : row.expires_on ? "Caduca el " + row.expires_on : row.document_type === "payroll" ? "Sin caducidad" : "Caducidad pendiente de indicar"}</p><p className={!row.acknowledged_at ? "text-orange-700" : ""}>{row.acknowledged_at ? "Recepción confirmada el " + new Date(row.acknowledged_at).toLocaleDateString() : "Recepción pendiente"}</p></div>
            <a className="text-sm underline" href={row.url} target="_blank" rel="noopener noreferrer">Abrir documento</a>
            {own && !row.acknowledged_at && <Button disabled={busy} onClick={() => void acknowledge(row.digest)}>Confirmar recepción</Button>}
        </article>)}
    </div>;
}
