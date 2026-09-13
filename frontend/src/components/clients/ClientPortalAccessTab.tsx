"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, Mail, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientPortalService } from "@/services/client-portal.service";
import type { ClientPortalGrant, ClientPortalInvitation } from "@/types/client-portal";

type ClientPortalAccessTabProps = {
    clientId: number;
    clientName: string;
};

function AccessStatus({ status }: { status: string }) {
    const active = status === "active";
    const pending = status === "pending";
    return <Badge className={active ? "border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold uppercase tracking-wide text-emerald-700" : pending ? "border border-accent/20 bg-accent/10 text-[10px] font-semibold uppercase tracking-wide text-accent" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}>{status}</Badge>;
}

export function ClientPortalAccessTab({ clientId, clientName }: ClientPortalAccessTabProps) {
    const [email, setEmail] = useState("");
    const [grants, setGrants] = useState<ClientPortalGrant[]>([]);
    const [invitations, setInvitations] = useState<ClientPortalInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [nextGrants, nextInvitations] = await Promise.all([
                ClientPortalService.getGrants(clientId),
                ClientPortalService.getInvitations(clientId),
            ]);
            setGrants(nextGrants);
            setInvitations(nextInvitations);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudieron cargar los accesos del portal.");
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => { void load(); }, [load]);

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

    return <div className="space-y-5"><Card><CardContent><div className="flex items-start gap-3"><UsersRound className="mt-0.5 size-5 shrink-0 text-accent" /><div><h2 className="font-semibold">Portal de cliente</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Invita a las personas de {clientName} para consultar únicamente sus presupuestos enviados, contratos y facturas. No recibirán una plaza, membresía ni acceso a otros clientes.</p></div></div><div className="mt-5 flex flex-col gap-2 sm:flex-row"><div className="min-w-0 flex-1"><Label htmlFor="client-portal-email" className="sr-only">Email de la persona</Label><Input id="client-portal-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@cliente.com" autoComplete="email" /></div><Button type="button" onClick={() => void invite()} disabled={!email.trim() || submitting}><UserPlus className="size-4" />{submitting ? "Enviando…" : "Invitar al portal"}</Button></div></CardContent></Card>
        <section className="space-y-3"><div><h2 className="font-semibold">Accesos activos</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Puedes revocar el acceso en cualquier momento.</p></div>{grants.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-[var(--text-muted)]">Aún no hay personas con acceso al portal.</CardContent></Card> : <div className="grid gap-3">{grants.map((grant) => <Card key={grant.id}><CardContent className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{grant.full_name || grant.email}</p><AccessStatus status={grant.status} /></div><p className="mt-1 truncate text-sm text-[var(--text-muted)]">{grant.email}</p></div>{grant.status === "active" && <Button type="button" variant="outline" size="sm" onClick={() => void revokeGrant(grant)}><Ban className="size-4" />Revocar</Button>}</CardContent></Card>)}</div>}</section>
        <section className="space-y-3"><div><h2 className="font-semibold">Invitaciones</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Las invitaciones pendientes caducan y no consumen acceso hasta que se aceptan.</p></div>{invitations.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-[var(--text-muted)]">No hay invitaciones enviadas.</CardContent></Card> : <div className="grid gap-3">{invitations.map((invitation) => <Card key={invitation.id}><CardContent className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Mail className="size-4 text-accent" /><p className="truncate font-medium">{invitation.email}</p><AccessStatus status={invitation.status} /></div><p className="mt-1 text-xs text-[var(--text-muted)]">Caduca: {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(invitation.expires_at))}</p></div>{invitation.status === "pending" && <Button type="button" variant="outline" size="sm" onClick={() => void revokeInvitation(invitation)}><Ban className="size-4" />Revocar</Button>}</CardContent></Card>)}</div>}</section>
    </div>;
}
