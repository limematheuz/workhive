"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { ApiAccessKeyService } from "@/services/api-access-key.service";
import type { ApiAccessKey, CreatedApiAccessKey } from "@/types/api-access-key";

const dateTime = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });

function formatDate(value: string | null): string {
    return value ? dateTime.format(new Date(value)) : "Aún no se ha usado";
}

export function ApiAccessWorkspace() {
    const [keys, setKeys] = useState<ApiAccessKey[]>([]);
    const [name, setName] = useState("");
    const [created, setCreated] = useState<CreatedApiAccessKey | null>(null);
    const [pendingRevocation, setPendingRevocation] = useState<ApiAccessKey | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setKeys(await ApiAccessKeyService.list());
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudieron cargar las claves API.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const create = async () => {
        const normalizedName = name.trim();
        if (!normalizedName || submitting) return;
        try {
            setSubmitting(true);
            const next = await ApiAccessKeyService.create(normalizedName);
            setCreated(next);
            setName("");
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo crear la clave API.");
        } finally {
            setSubmitting(false);
        }
    };

    const copyCreatedKey = async () => {
        if (!created) return;
        try {
            await navigator.clipboard.writeText(created.api_key);
            toast.success("Clave copiada. Guárdala ahora: no volverá a mostrarse.");
        } catch {
            toast.error("No se pudo copiar la clave. Selecciónala y guárdala manualmente.");
        }
    };

    const revoke = async () => {
        if (!pendingRevocation) return;
        try {
            const revoked = await ApiAccessKeyService.revoke(pendingRevocation.id);
            setKeys((current) => current.map((key) => key.id === revoked.id ? revoked : key));
            toast.success("Clave API revocada.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo revocar la clave API.");
        } finally {
            setPendingRevocation(null);
        }
    };

    return <div className="mx-auto w-full max-w-6xl space-y-6 px-[3%] py-6 pb-12 md:p-8">
        <PageHeader icon={KeyRound} title="Acceso API" subtitle="Crea credenciales revocables para la API pública de solo lectura. Cada uso queda auditado." />

        <Card className="billing-surface billing-surface-accent-pad"><CardContent className="space-y-5">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" /><div><h2 className="font-semibold">Primer alcance disponible</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">La clave permite consultar órdenes de trabajo mediante <code className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-xs">GET /api/v1/public/work-orders</code>. No expone clientes, personal, costes ni notas internas.</p></div></div>
            <div className="flex flex-col gap-2 sm:flex-row"><div className="min-w-0 flex-1"><Label htmlFor="api-key-name" className="sr-only">Nombre de la integración</Label><Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: sincronización de calendario" maxLength={100} /></div><Button type="button" onClick={() => void create()} disabled={!name.trim() || submitting}><Plus className="size-4" />{submitting ? "Creando…" : "Crear clave"}</Button></div>
        </CardContent></Card>

        {created && <Card className="border-accent/30 bg-accent/5"><CardContent className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Guárdala ahora</p><h2 className="mt-1 font-semibold">Esta clave solo se muestra una vez</h2><p className="mt-1 text-sm text-[var(--text-muted)]">WorkHive guarda únicamente su hash. Si la pierdes, revócala y crea otra.</p></div><div className="flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/70 px-3 py-2.5 text-xs font-semibold text-[var(--text-main)]">{created.api_key}</code><Button type="button" variant="outline" onClick={() => void copyCreatedKey()}><Copy className="size-4" />Copiar</Button></div><div className="flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={() => setCreated(null)}>He guardado la clave</Button></div></CardContent></Card>}

        <section className="space-y-3"><div><h2 className="font-semibold">Claves emitidas</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Revocar bloquea el acceso de inmediato y conserva el historial de auditoría.</p></div>{loading ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-accent" /><span className="sr-only">Cargando claves API</span></div> : keys.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-[var(--text-muted)]">Aún no hay claves API emitidas.</CardContent></Card> : <div className="grid gap-3">{keys.map((key) => <Card key={key.id}><CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{key.name}</p><Badge className={key.status === "active" ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}>{key.status === "active" ? "Activa" : "Revocada"}</Badge></div><p className="mt-1 font-mono text-xs text-[var(--text-muted)]">{key.key_prefix}…</p><p className="mt-2 text-xs text-[var(--text-muted)]">Alcance: órdenes de trabajo de lectura · Último uso: {formatDate(key.last_used_at)}</p></div>{key.status === "active" && <Button type="button" variant="outline" size="sm" onClick={() => setPendingRevocation(key)}><Trash2 className="size-4" />Revocar</Button>}</CardContent></Card>)}</div>}</section>

        <AlertDialog open={pendingRevocation !== null} onOpenChange={(open) => { if (!open) setPendingRevocation(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Revocar esta clave API?</AlertDialogTitle><AlertDialogDescription>La integración dejará de poder leer las órdenes de trabajo inmediatamente. Puedes crear una clave nueva después si la necesita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => void revoke()}>Revocar clave</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>;
}
