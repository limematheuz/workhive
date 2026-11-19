"use client";
import { CompanyViewSession } from "@/components/company/CompanyViewSession";
import { FormSelect } from "@/components/ui/form-select";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ClipboardPenLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { useUser } from "@/lib/user-context";
import { readInternalRequests, readInternalRequestAccess, writeInternalRequest, requestKinds, type InternalRequest, type InternalRequestAccess } from "@/services/internal-request.service";
export default function InternalRequestsPage() {
    return <CompanyViewSession><InternalRequestsWorkspace/></CompanyViewSession>;
}
function InternalRequestsWorkspace() {
    const { user, loading } = useUser();
    const [people, setPeople] = useState<{
        id: number;
        name: string;
    }[]>([]);
    const [rows, setRows] = useState<InternalRequest[]>([]);
    const [review, setReview] = useState(false);
    const [access, setAccess] = useState<InternalRequestAccess | null>(null);
    const [draft, setDraft] = useState({ employee_id: "", kind: "vacation", description: "", starts_on: "", ends_on: "", amount: "0" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const request = useCallback(async () => { const permissions = await readInternalRequestAccess(); return Promise.all([readInternalRequests<InternalRequest[]>("?review=" + (review && permissions.can_review)), readInternalRequests<{
            id: number;
            name: string;
        }[]>("/choices"), Promise.resolve(permissions)]); }, [review]);
    const receive = useCallback(([requests, staff, permissions]: Awaited<ReturnType<typeof request>>) => { setRows(requests); setPeople(staff); setAccess(permissions); setError(""); }, []);
    const failed = useCallback((error: unknown) => setError(error instanceof Error ? error.message : "No se pudieron cargar las solicitudes."), []);
    async function reload() { try {
        receive(await request());
    }
    catch (error) {
        failed(error);
    } }
    useResourceEffect(Boolean(user), `${user?.company_id}:${user?.id}`, request, receive, failed);
    async function submit(path: string, body: object) {
        setBusy(true);
        try {
            await writeInternalRequest(path, body);
            await reload();
            setDraft(d => ({ ...d, description: "" }));
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
    const allowedKinds = (access?.kinds ?? []).filter(kind => kind in requestKinds);
    const selectedKind = allowedKinds.includes(draft.kind) ? draft.kind : allowedKinds[0] ?? "";
    return <div className="dashboard-page-content space-y-3">
        <PageHeader icon={ClipboardPenLine} title="Solicitudes internas" subtitle="Vacaciones, material, cambios de turno y variables laborales." actions={<Button variant="outline" onClick={() => void reload()}>Actualizar</Button>}/>
        {access && !allowedKinds.length && <p role="status" className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700">El plan actual no tiene tipos de solicitud habilitados. Revisa los módulos de Personal e Inventario con el administrador.</p>}
        <form className="rounded-xl border p-4" onSubmit={e => { e.preventDefault(); if (selectedKind) void submit("", { ...draft, kind: selectedKind, employee_id: Number(draft.employee_id) }); }}><fieldset disabled={busy || !selectedKind} className="grid gap-3 sm:grid-cols-3">
            <label>Trabajador<FormSelect aria-label="Trabajador" required className="staff-select" value={draft.employee_id} onValueChange={e => setDraft({ ...draft, employee_id: e })}><option value="">Seleccionar</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</FormSelect></label>
            <label>Solicitud<FormSelect aria-label="Tipo de solicitud" className="staff-select" value={selectedKind} onValueChange={e => setDraft({ ...draft, kind: e })}>{!selectedKind && <option value="">Sin tipos habilitados</option>}{allowedKinds.map(value => <option key={value} value={value}>{requestKinds[value as keyof typeof requestKinds]}</option>)}</FormSelect></label>
            <label>Detalle<Input required maxLength={2000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/></label>
            <label>Desde<DatePicker id="internal-request-starts-on" required value={draft.starts_on} onValueChange={v => setDraft({ ...draft, starts_on: v })}/></label>
            <label>Hasta<DatePicker id="internal-request-ends-on" required min={draft.starts_on} value={draft.ends_on} onValueChange={v => setDraft({ ...draft, ends_on: v })}/></label>
            {["advance", "purchase", "extra_hours"].includes(selectedKind) && <label>{selectedKind === "extra_hours" ? "Horas solicitadas" : "Importe solicitado (€)"}<Input required type="number" min="0" step=".01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })}/></label>}
            <Button disabled={busy || !people.length} className="self-end">Enviar solicitud</Button>
        </fieldset></form>
        {access?.can_review && <label className="flex gap-2"><Checkbox checked={review} onCheckedChange={checked => setReview(checked === true)}/>Solicitudes para revisar</label>}
        {error && <p role="alert" className="text-orange-700">{error}</p>}
        {!rows.length && !error && <p>Sin solicitudes en esta vista.</p>}
        {rows.map(row => <article key={row.id} className="space-y-2 rounded-xl border p-3">
            <strong>{requestKinds[row.kind as keyof typeof requestKinds]} · {people.find(p => p.id === row.employee_id)?.name ?? "Trabajador #" + row.employee_id}</strong>
            <p>{row.description} · {row.starts_on} — {row.ends_on}{Number(row.amount) > 0 ? " · " + row.amount + (row.kind === "extra_hours" ? " h" : " €") : ""}</p>
            <p className={row.status === "pending" ? "text-orange-700" : ""}>{({ pending: "Pendiente de aprobación", approved: "Aprobada", rejected: "Rechazada" } as Record<string, string>)[row.status]}</p>
            {row.absence_id && <Link className="text-sm underline" href="/dashboard/plantilla/ausencias">Revisar cobertura de vacaciones</Link>}
            {row.status === "approved" && row.kind === "shift" && <Link className="text-sm underline" href="/dashboard/plantilla/turnos">Programar el cambio de turno aprobado</Link>}
            {row.status === "approved" && row.kind === "material" && <Link className="text-sm underline" href="/dashboard/inventory">Registrar la entrega de material</Link>}
            {row.purchase_id && <Link className="block text-sm underline" href={`/dashboard/inventory?tab=purchases&purchase_id=${row.purchase_id}`}>Ver compra registrada #{row.purchase_id}</Link>}
            {row.purchase_approval_id && !row.purchase_id && <Link className="block text-sm text-orange-700 underline" href={`/dashboard/inventory?tab=purchases&approval_id=${row.purchase_approval_id}`}>Ver propuesta de compra #{row.purchase_approval_id}</Link>}
            {row.status === "approved" && row.kind === "purchase" && !row.purchase_approval_id && !row.purchase_id && <div><p className="text-xs text-muted-foreground">Máximo autorizado con impuestos: {row.amount} €. Elige después proveedor, material y almacén reales.</p><Link className="text-sm underline" href={`/dashboard/inventory?tab=purchases&request_id=${row.id}`}>Preparar compra con esta autorización</Link></div>}
            {review && access?.can_review && row.status === "pending" && <div className="flex gap-2"><Button disabled={busy} onClick={() => void submit("/" + row.id + "/review", { decision: "approved" })}>Aprobar</Button><Button variant="outline" disabled={busy} onClick={() => void submit("/" + row.id + "/review", { decision: "rejected" })}>Rechazar</Button></div>}
        </article>)}
    </div>;
}
