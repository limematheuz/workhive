"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, Loader2, Mail, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import { SelectField } from "@/components/ui/select-field";
import { InvitationLinkDialog } from "@/components/invitations/InvitationLinkDialog";
import { useDictionary } from "@/lib/dictionary-context";
import {
    classifyReadError,
    getReadRecoveryMessage,
    getReadWorkspaceKey,
    shouldShowReadRetry,
    type ReadErrorKind,
} from "@/lib/read-recovery";
import { useUser } from "@/lib/user-context";
import { ClientPortalService } from "@/services/client-portal.service";
import type { ClientPortalGrant, ClientPortalInvitation, ClientPortalInvitationCreated } from "@/types/client-portal";
import { useClientPortalInvitationAccess } from "./useClientPortalInvitationAccess";

const invitationExpiryFormatter = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
});

type ClientPortalAccessTabProps = {
    clientId: number;
    clientName: string;
    onAccessChanged?: () => void;
    accessStatuses?: Record<number, string>;
    invitationDeliveryReady?: boolean;
};

const accessStatusLabels: Record<string, string> = { active: "Activo", pending: "Pendiente", accepted: "Aceptada", revoked: "Revocado", expired: "Caducado", suspended: "Cuenta suspendida" };

function AccessStatus({ status }: { status: string }) {
    const active = status === "active";
    const pending = ["pending", "expired", "suspended"].includes(status);
    return <Badge className={active ? "border border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[10px] font-semibold uppercase tracking-wide text-[var(--status-active-text)]" : pending ? "border border-orange-300 bg-orange-50 text-[10px] font-semibold uppercase tracking-wide text-orange-800 dark:bg-orange-950 dark:text-orange-200" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}>{accessStatusLabels[status] ?? status}</Badge>;
}

export function ClientPortalAccessTab({ clientId, clientName, onAccessChanged, accessStatuses, invitationDeliveryReady = true }: ClientPortalAccessTabProps) {
    const { user } = useUser();
    const canInvite = useClientPortalInvitationAccess(user?.id, user?.company_id);
    const { locale } = useDictionary();
    const scopeKey = `${getReadWorkspaceKey(user)}:${clientId}`;
    const [email, setEmail] = useState("");
    const [grants, setGrants] = useState<ClientPortalGrant[]>([]);
    const [invitations, setInvitations] = useState<ClientPortalInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(false);
    const [errorKind, setErrorKind] = useState<ReadErrorKind | null>(null);
    const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [delivery, setDelivery] = useState<"link" | "email">("link");
    const [createdLink, setCreatedLink] = useState<ClientPortalInvitationCreated | null>(null);
    const [error, setError] = useState("");
    const requestIdRef = useRef(0);
    const loadedScopeRef = useRef<string | null>(null);

    const load = useCallback(async (isRetry = false) => {
        const requestId = ++requestIdRef.current;
        const scopeChanged = loadedScopeRef.current !== scopeKey;
        loadedScopeRef.current = scopeKey;
        if (scopeChanged) {
            setGrants([]);
            setInvitations([]);
            setErrorKind(null);
            setHasLoadedSnapshot(false);
            setLoading(true);
        } else if (isRetry) {
            setRetrying(true);
        } else {
            setLoading(true);
        }
        try {
            const [nextGrants, nextInvitations] = await Promise.all([
                ClientPortalService.getGrants(clientId),
                ClientPortalService.getInvitations(clientId),
            ]);
            if (requestId !== requestIdRef.current) return;
            setGrants(nextGrants);
            setInvitations(nextInvitations);
            setHasLoadedSnapshot(true);
            setErrorKind(null);
            setError("");
        } catch (cause) {
            if (requestId !== requestIdRef.current) return;
            const kind = classifyReadError(cause);
            setErrorKind(kind);
            if (kind === "denied") {
                setGrants([]);
                setInvitations([]);
                setHasLoadedSnapshot(false);
            }
        } finally {
            setLoading((current) => requestId === requestIdRef.current ? false : current);
            setRetrying((current) => requestId === requestIdRef.current ? false : current);
        }
    }, [clientId, scopeKey]);

    useEffect(() => {
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    const invite = async () => {
        const normalizedEmail = email.trim();
        if (!normalizedEmail || submitting || !canInvite || (delivery === "email" && !invitationDeliveryReady)) return;
        try {
            setSubmitting(true);
            setError("");
            const created = await ClientPortalService.invite(clientId, normalizedEmail, delivery);
            setEmail("");
            if (created.delivery === "link" && created.invitation_url && created.verification_code) {
                setCreatedLink(created);
                await load(true);
            } else {
                toast.success("Invitación enviada.");
                await load();
                onAccessChanged?.();
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : "No se pudo crear la invitación.");
        } finally {
            setSubmitting(false);
        }
    };

    const revokeGrant = async (grant: ClientPortalGrant) => {
        try {
            await ClientPortalService.revokeGrant(clientId, grant.id);
            toast.success("Acceso revocado.");
            await load();
            onAccessChanged?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo revocar el acceso.");
        }
    };

    const revokeInvitation = async (invitation: ClientPortalInvitation) => {
        try {
            await ClientPortalService.revokeInvitation(clientId, invitation.id);
            toast.success("Invitación revocada.");
            await load();
            onAccessChanged?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo revocar la invitación.");
        }
    };

    if (loading) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-6 animate-spin text-accent" /><span className="sr-only">Cargando acceso del portal</span></div>;

    const recoveryCopy = locale === "en"
        ? {
            unavailable: "Could not load client portal access right now.",
            denied: "You no longer have permission to view or manage this client's portal access.",
            retry: "Retry",
        }
        : {
            unavailable: "No se pudieron cargar los accesos del portal ahora mismo.",
            denied: "Ya no tienes permisos para consultar o gestionar los accesos del portal de este cliente.",
            retry: "Reintentar",
        };
    const errorMessage = getReadRecoveryMessage(errorKind, recoveryCopy);

    return <div className="space-y-5">
        {errorKind && errorMessage && (
            <ReadRecoveryBanner
                kind={errorKind}
                message={errorMessage}
                retryLabel={recoveryCopy.retry}
                onRetry={shouldShowReadRetry(errorKind) ? () => void load(true) : undefined}
                retrying={retrying}
            />
        )}
        {error && <div role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-800 dark:text-orange-200">{error}</div>}
        {errorKind !== "denied" && (
            <Card><CardContent><div className="flex items-start gap-3"><UsersRound className="mt-0.5 size-5 shrink-0 text-accent" /><div><h2 className="font-semibold">Portal de cliente</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Invita a las personas de {clientName} para consultar sus presupuestos, contratos, facturas y los partes y documentos que publiques para ellas. El acceso se limita a este cliente.</p></div></div>{!canInvite && <p role="status" className="mt-3 text-sm text-[var(--text-muted)]">{locale === "en" ? "New invitations require the client portal in the current plan. Existing access can still be revoked." : "Para enviar invitaciones, el plan actual debe incluir el portal de cliente. Puedes seguir revocando los accesos existentes."}</p>}<form className="mt-5 flex flex-col items-end gap-3 sm:flex-row" onSubmit={event => { event.preventDefault(); void invite(); }}><div className="w-full min-w-0 flex-1 space-y-1"><Label htmlFor="client-portal-email">Email de la persona</Label><Input id="client-portal-email" type="email" required disabled={!canInvite || submitting} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@cliente.com" autoComplete="email" /></div><div className="w-full space-y-1 sm:w-52"><Label htmlFor="client-portal-delivery">Forma de entrega</Label><SelectField id="client-portal-delivery" aria-label="Forma de entrega de la invitación" value={delivery} onValueChange={value => setDelivery(value as "link" | "email")} disabled={!canInvite || submitting} options={[{ value: "link", label: "Crear enlace para compartir" }, { value: "email", label: "Enviar por correo", disabled: !invitationDeliveryReady }]} /></div><Button type="submit" disabled={!canInvite || !email.trim() || submitting || (delivery === "email" && !invitationDeliveryReady)}><UserPlus className="size-4" />{submitting ? "Creando…" : delivery === "link" ? "Crear enlace" : "Enviar invitación"}</Button></form>{!invitationDeliveryReady && <p className="mt-3 text-xs text-[var(--text-muted)]">El correo no está configurado. Puedes crear un enlace con caducidad y compartirlo junto con su código.</p>}</CardContent></Card>
        )}
        {hasLoadedSnapshot && <>
            <section className="space-y-3"><div><h2 className="font-semibold">Accesos activos</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Puedes revocar el acceso en cualquier momento.</p></div>{grants.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-[var(--text-muted)]">Aún no hay personas con acceso al portal.</CardContent></Card> : <div className="grid gap-3">{grants.map((grant) => <Card key={grant.id}><CardContent className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{grant.full_name || grant.email}</p><AccessStatus status={accessStatuses?.[grant.id] ?? grant.status} /></div><p className="mt-1 truncate text-sm text-[var(--text-muted)]">{grant.email}</p></div>{grant.status === "active" && <Button type="button" variant="outline" size="sm" onClick={() => void revokeGrant(grant)}><Ban className="size-4" />Revocar</Button>}</CardContent></Card>)}</div>}</section>
            <section className="space-y-3"><div><h2 className="font-semibold">Invitaciones</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Las invitaciones pendientes caducan y no consumen acceso hasta que se aceptan.</p></div>{invitations.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-[var(--text-muted)]">No hay invitaciones enviadas.</CardContent></Card> : <div className="grid gap-3">{invitations.map((invitation) => <Card key={invitation.id}><CardContent className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Mail className="size-4 text-accent" /><p className="truncate font-medium">{invitation.email}</p><AccessStatus status={invitation.status} /></div><p className="mt-1 text-xs text-[var(--text-muted)]">Caduca: {invitationExpiryFormatter.format(new Date(invitation.expires_at))}</p></div>{invitation.status === "pending" && <Button type="button" variant="outline" size="sm" onClick={() => void revokeInvitation(invitation)}><Ban className="size-4" />Revocar</Button>}</CardContent></Card>)}</div>}</section>
        </>}
        {createdLink?.invitation_url && createdLink.verification_code && <InvitationLinkDialog email={createdLink.email} invitationUrl={createdLink.invitation_url} verificationCode={createdLink.verification_code} expiresAt={createdLink.expires_at} onClose={() => { setCreatedLink(null); onAccessChanged?.(); }} />}
    </div>;
}
