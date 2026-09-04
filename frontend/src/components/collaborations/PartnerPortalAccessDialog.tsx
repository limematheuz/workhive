"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartnerPortalService } from "@/services/partner-portal.service";
import type { PartnerPortalCandidate, PartnerPortalGrant } from "@/types/partner-portal";

type PartnerPortalAccessDialogProps = {
    collaborationId: number;
    partnerName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type RoleFilter = "all" | "admin" | "manager" | "viewer";

export function PartnerPortalAccessDialog({ collaborationId, partnerName, open, onOpenChange }: PartnerPortalAccessDialogProps) {
    const [candidates, setCandidates] = useState<PartnerPortalCandidate[]>([]);
    const [grants, setGrants] = useState<PartnerPortalGrant[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingUserId, setSavingUserId] = useState<number | null>(null);
    const [revokingGrantId, setRevokingGrantId] = useState<number | null>(null);
    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [nextCandidates, nextGrants] = await Promise.all([
                PartnerPortalService.getCandidates(collaborationId),
                PartnerPortalService.getGrants(collaborationId),
            ]);
            setCandidates(nextCandidates);
            setGrants(nextGrants);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo cargar el acceso al portal.");
        } finally {
            setLoading(false);
        }
    }, [collaborationId]);

    useEffect(() => {
        if (open) void load();
    }, [load, open]);

    const visibleCandidates = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase("es-ES");
        return candidates.filter(candidate => candidate.eligible && (roleFilter === "all" || candidate.role_name === roleFilter) && (!normalizedQuery || [candidate.full_name, candidate.email].some(value => value?.toLocaleLowerCase("es-ES").includes(normalizedQuery))));
    }, [candidates, query, roleFilter]);

    const grant = async (candidate: PartnerPortalCandidate) => {
        setSavingUserId(candidate.id);
        try {
            const created = await PartnerPortalService.grantAccess(collaborationId, candidate.id);
            setGrants(current => [...current.filter(grant => grant.id !== created.id), created]);
            setCandidates(current => current.filter(item => item.id !== candidate.id));
            toast.success(`Portal activado para ${candidate.full_name || candidate.email}.`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo activar el portal.");
        } finally {
            setSavingUserId(null);
        }
    };

    const revoke = async (grantToRevoke: PartnerPortalGrant) => {
        setRevokingGrantId(grantToRevoke.id);
        try {
            await PartnerPortalService.revokeAccess(collaborationId, grantToRevoke.id);
            setGrants(current => current.filter(grant => grant.id !== grantToRevoke.id));
            toast.success(`Acceso revocado para ${grantToRevoke.user_full_name || grantToRevoke.user_email}.`);
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo revocar el portal.");
        } finally {
            setRevokingGrantId(null);
        }
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent compact className="max-w-2xl">
            <DialogHeader><DialogTitle>Portal de inmobiliaria</DialogTitle><DialogDescription>Elige quién puede enviar reservas de {partnerName}. Este acceso no da acceso al dashboard, facturación ni usuarios de tu empresa.</DialogDescription></DialogHeader>
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs leading-5 text-[var(--text-muted)]"><ShieldCheck className="mr-1 inline size-4 text-accent" />Al activarlo, la persona deja de usar el espacio completo de su inmobiliaria y solo ve sus propiedades y solicitudes contigo.</div>
            {loading ? <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-accent" /></div> : <div className="space-y-5">
                <section className="space-y-2"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Personas con portal activo</h3><p className="text-xs text-[var(--text-muted)]">Puedes revocarlo en cualquier momento.</p></div><Badge variant="outline">{grants.length}</Badge></div>{grants.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--border-soft)] px-3 py-3 text-sm text-[var(--text-muted)]">Todavía no hay nadie con acceso.</p> : <div className="divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)]">{grants.map(grant => <div key={grant.id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{grant.user_full_name || grant.user_email}</p><p className="truncate text-xs text-[var(--text-muted)]">{grant.user_email}</p></div><Button type="button" variant="dangerSoft" size="xs" disabled={revokingGrantId === grant.id} onClick={() => void revoke(grant)}>{revokingGrantId === grant.id ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}Revocar</Button></div>)}</div>}</section>
                <section className="space-y-3 border-t border-[var(--border-soft)] pt-5"><div><h3 className="text-sm font-semibold">Dar acceso a otra persona</h3><p className="mt-0.5 text-xs text-[var(--text-muted)]">Solo aparecen usuarios internos activos de la inmobiliaria; filtra antes de elegir.</p></div><div className="grid gap-3 sm:grid-cols-[1fr_10rem]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" /><Input aria-label="Buscar persona" className="pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre o email" /></div><div><Label className="sr-only" htmlFor="portal-role-filter">Rol</Label><Select value={roleFilter} onValueChange={value => setRoleFilter(value as RoleFilter)}><SelectTrigger id="portal-role-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los roles</SelectItem><SelectItem value="admin">Administración</SelectItem><SelectItem value="manager">Operaciones</SelectItem><SelectItem value="viewer">Consulta</SelectItem></SelectContent></Select></div></div>{visibleCandidates.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--border-soft)] px-3 py-3 text-sm text-[var(--text-muted)]">No hay personas elegibles con esos filtros.</p> : <div className="divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)]">{visibleCandidates.map(candidate => <div key={candidate.id} className="flex items-center justify-between gap-3 p-3"><div className="flex min-w-0 items-center gap-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><UserRound className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{candidate.full_name || candidate.email}</p><p className="truncate text-xs text-[var(--text-muted)]">{candidate.email} · {candidate.role_name}</p></div></div><Button type="button" size="xs" disabled={savingUserId === candidate.id} onClick={() => void grant(candidate)}>{savingUserId === candidate.id ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}Activar</Button></div>)}</div>}</section>
            </div>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}
