"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, History, KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { redirect } from "next/navigation";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { canAdministerCompany, isPlatformSuperadmin } from "@/domain/access/roles";
import { useUser } from "@/lib/user-context";
import { ApiAccessKeyService } from "@/services/api-access-key.service";
import { CompanyPlanAccessService } from "@/services/company-plan-access.service";
import type { ApiAccessKey, ApiAccessKeyUsage, ApiAccessScope, CreatedApiAccessKey } from "@/types/api-access-key";

const API_FEATURE_CODE = "features.api";
type ApiFeatureAccess = "checking" | "enabled" | "denied";

const dateTime = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
});

function formatDate(value: string | null): string {
    return value ? dateTime.format(new Date(value)) : "Aún no se ha usado";
}

function ApiKeyUsageHistory({ usage, loading }: { usage: ApiAccessKeyUsage[] | undefined; loading: boolean }) {
    if (loading) {
        return <div className="flex items-center gap-2 py-1 text-xs text-[var(--text-muted)]"><Loader2 className="size-4 animate-spin" />Cargando historial…</div>;
    }
    if (!usage?.length) {
        return <p className="text-xs text-[var(--text-muted)]">Aún no hay usos registrados para esta clave.</p>;
    }
    return <div className="space-y-2">{usage.map((event) => <div key={event.id} className="flex flex-col justify-between gap-1 rounded-lg bg-[var(--bg-secondary)]/50 px-3 py-2 text-xs sm:flex-row sm:items-center"><span className="font-mono text-[var(--text-main)]">{[event.scope || "sin alcance", event.method, event.path].filter(Boolean).join(" · ")}</span><time className="shrink-0 text-[var(--text-muted)]">{formatDate(event.created_at)}</time></div>)}</div>;
}

export function ApiAccessWorkspace() {
    const { user, loading: userLoading } = useUser();
    const [featureAccess, setFeatureAccess] = useState<ApiFeatureAccess>("checking");
    const canManageApiAccess = canAdministerCompany(user)
        && !isPlatformSuperadmin(user)
        && user?.company_id != null;

    useEffect(() => {
        if (userLoading || !canManageApiAccess) return;
        let active = true;
        void CompanyPlanAccessService.getCurrentEntitlements()
            .then((access) => {
                if (!active) return;
                const enabled = access.entitlements.some((item) => item.code === API_FEATURE_CODE && item.value === true);
                setFeatureAccess(enabled ? "enabled" : "denied");
            })
            .catch(() => {
                if (!active) return;
                setFeatureAccess("denied");
            });
        return () => { active = false; };
    }, [canManageApiAccess, userLoading]);

    if (userLoading || (canManageApiAccess && featureAccess === "checking")) {
        return <div className="flex min-h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-accent" /><span className="sr-only">Comprobando acceso API</span></div>;
    }

    if (!canManageApiAccess || featureAccess !== "enabled") redirect("/dashboard");

    return <ApiAccessWorkspaceContent />;
}

function ApiAccessWorkspaceContent() {
    const [keys, setKeys] = useState<ApiAccessKey[]>([]);
    const [name, setName] = useState("");
    const [scopes, setScopes] = useState<ApiAccessScope[]>(["work_orders.read"]);
    const [usageByKey, setUsageByKey] = useState<Record<number, ApiAccessKeyUsage[]>>({});
    const [openUsageKeyId, setOpenUsageKeyId] = useState<number | null>(null);
    const [loadingUsageKeyId, setLoadingUsageKeyId] = useState<number | null>(null);
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

    useEffect(() => {
        const loadTimer = window.setTimeout(() => { void load(); }, 0);
        return () => window.clearTimeout(loadTimer);
    }, [load]);

    const create = async () => {
        const normalizedName = name.trim();
        if (!normalizedName || scopes.length === 0 || submitting) return;
        try {
            setSubmitting(true);
            const next = await ApiAccessKeyService.create(normalizedName, scopes);
            setCreated(next);
            setName("");
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo crear la clave API.");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleScope = (scope: ApiAccessScope, checked: boolean | "indeterminate") => {
        setScopes((current) => {
            if (checked === true) {
                return current.includes(scope) ? current : [...current, scope];
            }
            return current.filter((currentScope) => currentScope !== scope);
        });
    };

    const toggleUsage = async (keyId: number) => {
        if (openUsageKeyId === keyId) {
            setOpenUsageKeyId(null);
            return;
        }
        setOpenUsageKeyId(keyId);
        if (usageByKey[keyId] !== undefined) return;
        try {
            setLoadingUsageKeyId(keyId);
            const usage = await ApiAccessKeyService.listUsage(keyId);
            setUsageByKey((current) => ({ ...current, [keyId]: usage }));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo cargar el historial de la clave API.");
        } finally {
            setLoadingUsageKeyId(null);
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
        <PageHeader icon={KeyRound} title="Acceso API" subtitle="Crea credenciales revocables para integraciones de lectura y reservas. Cada uso queda auditado." />

        <Card className="billing-surface billing-surface-accent-pad"><CardContent className="space-y-5">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" /><div><h2 className="font-semibold">Alcances disponibles</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Puedes leer órdenes de trabajo o sincronizar reservas de ubicaciones propias. Las reservas se actualizan de forma idempotente por fuente y referencia externa.</p></div></div>
            <div className="grid gap-2 sm:grid-cols-2"><Label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--border-soft)] p-3"><Checkbox checked={scopes.includes("work_orders.read")} onCheckedChange={(checked) => toggleScope("work_orders.read", checked)} /><span><span className="block text-sm font-medium">Leer órdenes</span><span className="text-xs text-[var(--text-muted)]">GET /public/work-orders</span></span></Label><Label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--border-soft)] p-3"><Checkbox checked={scopes.includes("reservations.write")} onCheckedChange={(checked) => toggleScope("reservations.write", checked)} /><span><span className="block text-sm font-medium">Sincronizar reservas</span><span className="text-xs text-[var(--text-muted)]">PUT /public/reservations</span></span></Label></div>
            <div className="flex flex-col gap-2 sm:flex-row"><div className="min-w-0 flex-1"><Label htmlFor="api-key-name" className="sr-only">Nombre de la integración</Label><Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: PMS de reservas" maxLength={100} /></div><Button type="button" onClick={() => void create()} disabled={!name.trim() || scopes.length === 0 || submitting}><Plus className="size-4" />{submitting ? "Creando…" : "Crear clave"}</Button></div>
        </CardContent></Card>

        {created && <Card className="border-accent/30 bg-accent/5"><CardContent className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Guárdala ahora</p><h2 className="mt-1 font-semibold">Esta clave solo se muestra una vez</h2><p className="mt-1 text-sm text-[var(--text-muted)]">WorkHive guarda únicamente su hash. Si la pierdes, revócala y crea otra.</p></div><div className="flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/70 px-3 py-2.5 text-xs font-semibold text-[var(--text-main)]">{created.api_key}</code><Button type="button" variant="outline" onClick={() => void copyCreatedKey()}><Copy className="size-4" />Copiar</Button></div><div className="flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={() => setCreated(null)}>He guardado la clave</Button></div></CardContent></Card>}

        <section className="space-y-3"><div><h2 className="font-semibold">Claves emitidas</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Revocar bloquea el acceso de inmediato y conserva el historial de auditoría.</p></div>{loading ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-accent" /><span className="sr-only">Cargando claves API</span></div> : keys.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-[var(--text-muted)]">Aún no hay claves API emitidas.</CardContent></Card> : <div className="grid gap-3">{keys.map((key) => <Card key={key.id}><CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{key.name}</p><Badge className={key.status === "active" ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}>{key.status === "active" ? "Activa" : "Revocada"}</Badge></div><p className="mt-1 font-mono text-xs text-[var(--text-muted)]">{key.key_prefix}…</p><p className="mt-2 text-xs text-[var(--text-muted)]">Alcances: {key.scopes.join(" · ")} · Último uso: {formatDate(key.last_used_at)}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Button type="button" variant="outline" size="sm" aria-expanded={openUsageKeyId === key.id} onClick={() => void toggleUsage(key.id)}><History className="size-4" />Historial de uso</Button>{key.status === "active" && <Button type="button" variant="outline" size="sm" onClick={() => setPendingRevocation(key)}><Trash2 className="size-4" />Revocar</Button>}</div></CardContent>{openUsageKeyId === key.id && <CardContent className="border-t border-[var(--border-soft)] pt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Últimos 50 usos auditados</p><ApiKeyUsageHistory usage={usageByKey[key.id]} loading={loadingUsageKeyId === key.id} /></CardContent>}</Card>)}</div>}</section>

        <AlertDialog open={pendingRevocation !== null} onOpenChange={(open) => { if (!open) setPendingRevocation(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Revocar esta clave API?</AlertDialogTitle><AlertDialogDescription>La integración perderá inmediatamente todos los alcances asociados. Puedes crear una clave nueva después si la necesita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => void revoke()}>Revocar clave</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>;
}
