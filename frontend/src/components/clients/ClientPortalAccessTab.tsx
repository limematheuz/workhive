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
import type { ClientPortalGrant, ClientPortalInvitation } from "@/types/client-portal";

const invitationExpiryFormatter = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
});

type ClientPortalAccessTabProps = {
    clientId: number;
    clientName: string;
};

function AccessStatus({ status }: { status: string }) {
    const active = status === "active";
    const pending = status === "pending";
    return <Badge className={active ? "border border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[10px] font-semibold uppercase tracking-wide text-[var(--status-active-text)]" : pending ? "border border-accent/20 bg-accent/10 text-[10px] font-semibold uppercase tracking-wide text-accent" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}>{status}</Badge>;
}

export function ClientPortalAccessTab({ clientId, clientName }: ClientPortalAccessTabProps) {
    const { user } = useUser();
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
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            const kind = classifyReadError(error);
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
        if (!normalizedEmail || submitting) return;
        try {
            setSubmitting(true);
            await ClientPortalService.invite(clientId, normalizedEmail);
            setEmail("");
            toast.success("Invitación enviada.");
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo enviar la invitación.");
        } finally {
            setSubmitting(false);
        }
    };

    const revokeGrant = async (grant: ClientPortalGrant) => {
        try {
            await ClientPortalService.revokeGrant(clientId, grant.id);
            toast.success("Acceso revocado.");
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo revocar el acceso.");
        }
    };

    const revokeInvitation = async (invitation: ClientPortalInvitation) => {
        try {
            await ClientPortalService.revokeInvitation(clientId, invitation.id);
            toast.success("Invitación revocada.");
            await load();
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
        {errorKind !== "denied" && (
            <Card><CardContent><div className="flex items-start gap-3"><UsersRound className="mt-0.5 size-5 shrink-0 text-accent" /><div><h2 className="font-semibold">Portal de cliente</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Invita a las personas de {clientName} para consultar únicamente sus presupuestos enviados, contratos y facturas. No recibirán una plaza, membresía ni acceso a otros clientes.</p></div></div><div className="mt-5 flex flex-col gap-2 sm:flex-row"><div className="min-w-0 flex-1"><Label htmlFor="client-portal-email" className="sr-only">Email de la persona</Label><Input id="client-portal-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@cliente.com" autoComplete="email" /></div><Button type="button" onClick={() => void invite()} disabled={!email.trim() || submitting}><UserPlus className="size-4" />{submitting ? "Enviando…" : "Invitar al portal"}</Button></div></CardContent></Card>
        )}
        {hasLoadedSnapshot && <>
            <section className="space-y-3"><div><h2 className="font-semibold">Accesos activos</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Puedes revocar el acceso en cualquier momento.</p></div>{grants.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-[var(--text-muted)]">Aún no hay personas con acceso al portal.</CardContent></Card> : <div className="grid gap-3">{grants.map((grant) => <Card key={grant.id}><CardContent className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{grant.full_name || grant.email}</p><AccessStatus status={grant.status} /></div><p className="mt-1 truncate text-sm text-[var(--text-muted)]">{grant.email}</p></div>{grant.status === "active" && <Button type="button" variant="outline" size="sm" onClick={() => void revokeGrant(grant)}><Ban className="size-4" />Revocar</Button>}</CardContent></Card>)}</div>}</section>
            <section className="space-y-3"><div><h2 className="font-semibold">Invitaciones</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Las invitaciones pendientes caducan y no consumen acceso hasta que se aceptan.</p></div>{invitations.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-[var(--text-muted)]">No hay invitaciones enviadas.</CardContent></Card> : <div className="grid gap-3">{invitations.map((invitation) => <Card key={invitation.id}><CardContent className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Mail className="size-4 text-accent" /><p className="truncate font-medium">{invitation.email}</p><AccessStatus status={invitation.status} /></div><p className="mt-1 text-xs text-[var(--text-muted)]">Caduca: {invitationExpiryFormatter.format(new Date(invitation.expires_at))}</p></div>{invitation.status === "pending" && <Button type="button" variant="outline" size="sm" onClick={() => void revokeInvitation(invitation)}><Ban className="size-4" />Revocar</Button>}</CardContent></Card>)}</div>}</section>
        </>}
    </div>;
}
