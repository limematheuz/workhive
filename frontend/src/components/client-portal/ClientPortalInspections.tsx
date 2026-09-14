"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientPortalService } from "@/services/client-portal.service";
import type { ClientPortalInspection } from "@/types/client-portal";

type ClientPortalInspectionsProps = {
    inspections: ClientPortalInspection[];
    workspaceId: number;
    defaultSignerName: string;
    onAccepted: (inspection: ClientPortalInspection) => void;
};

const dateTime = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
});

function formatDate(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed);
}

function statusLabel(status: ClientPortalInspection["items"][number]["status"]): string {
    if (status === "passed") return "Correcto";
    if (status === "failed") return "Con observaciones";
    return "Pendiente";
}

export function ClientPortalInspections({
    inspections,
    workspaceId,
    defaultSignerName,
    onAccepted,
}: ClientPortalInspectionsProps) {
    const [acknowledgedIds, setAcknowledgedIds] = useState<Set<number>>(new Set());
    const [signerNames, setSignerNames] = useState<Record<number, string>>({});
    const [signingId, setSigningId] = useState<number | null>(null);

    const toggleAcknowledgement = (inspectionId: number, checked: boolean) => {
        setAcknowledgedIds((current) => {
            const next = new Set(current);
            if (checked) next.add(inspectionId);
            else next.delete(inspectionId);
            return next;
        });
    };

    const accept = async (inspection: ClientPortalInspection) => {
        const signerName = (signerNames[inspection.id] ?? defaultSignerName).trim();
        if (!signerName || !acknowledgedIds.has(inspection.id) || signingId !== null) return;
        setSigningId(inspection.id);
        try {
            const accepted = await ClientPortalService.acceptInspection(
                workspaceId,
                inspection.id,
                { confirmed: true, signer_name: signerName },
            );
            onAccepted(accepted);
            toast.success("Aceptación del cliente registrada.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo registrar la aceptación.");
        } finally {
            setSigningId(null);
        }
    };

    if (inspections.length === 0) {
        return <Card><CardContent className="py-12 text-center"><ClipboardCheck className="mx-auto size-8 text-accent" aria-hidden="true" /><p className="mt-3 font-semibold text-[var(--text-main)]">No hay inspecciones para revisar</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-muted)]">Aquí aparecerán las inspecciones cerradas de tus ubicaciones cuando estén listas para su revisión.</p></CardContent></Card>;
    }

    return <div className="space-y-4">{inspections.map((inspection) => {
        const accepted = inspection.acceptance;
        const signerName = signerNames[inspection.id] ?? defaultSignerName;
        const acknowledged = acknowledgedIds.has(inspection.id);
        const signing = signingId === inspection.id;
        return <Card key={inspection.id}><CardContent className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xs text-[var(--text-muted)]">Inspección #{inspection.id}</p>{accepted && <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Aceptada</Badge>}</div><h2 className="mt-1 font-semibold text-[var(--text-main)]">{inspection.template_title}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{inspection.location_name} · Cerrada el {formatDate(inspection.completed_at)}</p></div><p className="shrink-0 font-mono text-lg font-bold text-[var(--text-main)]">{inspection.score} / {inspection.max_score}</p></div>
            <div className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">{inspection.items.map((item) => <div key={`${inspection.id}-${item.title}`} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-medium text-[var(--text-main)]">{item.title}</span><span className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-muted)]"><Badge variant="secondary" className="text-[10px] uppercase">{statusLabel(item.status)}</Badge>{item.points_awarded}/{item.max_points}</span></div>)}</div>
            {accepted ? <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" /><p className="leading-6 text-[var(--text-main)]">Aceptada por <strong>{accepted.signer_name}</strong> el {formatDate(accepted.signed_at)}. El registro queda ligado a esta revisión.</p></div> : <section className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" /><div><p className="text-sm font-semibold text-[var(--text-main)]">Aceptación del cliente</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">La cuenta autenticada, el nombre declarado y la fecha quedarán registrados para esta revisión. No es una firma electrónica cualificada.</p></div></div><div className="space-y-1.5"><Label htmlFor={`inspection-signer-${inspection.id}`}>Nombre del representante</Label><Input id={`inspection-signer-${inspection.id}`} value={signerName} maxLength={255} onChange={(event) => setSignerNames((current) => ({ ...current, [inspection.id]: event.target.value }))} placeholder="Nombre y apellidos" /></div><Label htmlFor={`inspection-acceptance-${inspection.id}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 text-sm font-medium leading-6 text-[var(--text-main)]"><Checkbox id={`inspection-acceptance-${inspection.id}`} checked={acknowledged} onCheckedChange={(checked) => toggleAcknowledgement(inspection.id, checked === true)} />He revisado este resumen y actúo como representante autorizado para registrar esta aceptación.</Label><Button type="button" size="sm" onClick={() => void accept(inspection)} disabled={!signerName.trim() || !acknowledged || signing}><>{signing ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}</>{signing ? "Registrando…" : "Registrar aceptación"}</Button></section>}
        </CardContent></Card>;
    })}</div>;
}
