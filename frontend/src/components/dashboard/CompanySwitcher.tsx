"use client";
import { useCallback, useState } from "react";
import { Building2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useUser } from "@/lib/user-context";
import { clearSessionCache, setCsrfToken } from "@/lib/auth";
import { ApiResponseError } from "@/lib/api";
import { applicationHome } from "@/lib/auth-routes";
import { authService } from "@/services/auth.service";
import { companySession, type CompanySessionWorkspace } from "@/services/company-session.service";
import { cn } from "@/lib/utils";

export function CompanySwitcher({ className }: { className?: string }) {
    const { user } = useUser();
    const [workspace, setWorkspace] = useState<{ key: string; data: CompanySessionWorkspace } | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
    const internal = Boolean(user && ["admin", "manager", "viewer"].includes(user.role.name));
    const key = `${user?.id}:${user?.company_id}:${revision}`;
    const request = useCallback(() => companySession.list(), []);
    const receive = useCallback((data: CompanySessionWorkspace) => { setWorkspace({ key, data }); setError(""); }, [key]);
    const failed = useCallback((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las empresas."), []);
    useResourceEffect(internal, key, request, receive, failed);
    const data = workspace?.key === key ? workspace.data : null;
    async function change(value: string) {
        const company = data?.companies.find(row => String(row.id) === value);
        if (!company || company.disabled || company.id === user?.company_id || busy) return;
        setBusy(true); setError("");
        let changed = false;
        try {
            const result = await companySession.change(company.id);
            changed = true;
            clearSessionCache(); setCsrfToken(result.csrf_token);
            const identity = await authService.getMe();
            window.location.assign(applicationHome(identity));
        } catch (reason) {
            // A changed cookie or an interrupted response must never leave the
            // previous company's mounted forms active against a new context.
            if (changed || !(reason instanceof ApiResponseError) || reason.status >= 500) {
                clearSessionCache(); window.location.assign(new URL("/dashboard", window.location.origin).href); return;
            }
            setError(reason.message); setBusy(false);
        }
    }
    if (!internal) return null;
    return <div className={cn("relative flex min-w-0 items-center gap-2", className)}><Building2 aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground sm:block" /><div className="w-28 min-w-0 sm:w-52"><SearchableSelect aria-label="Empresa activa" value={String(user?.company_id ?? "")} options={(data?.companies ?? []).map(row => ({ value: String(row.id), label: row.name, description: row.disabled_reason ?? (row.access_class === "admin" ? "Administración" : row.access_class === "responsible" ? "Responsable" : "Trabajador"), disabled: row.disabled }))} onValueChange={value => void change(value)} loading={!data && !error} disabled={busy || Boolean(data && data.companies.length < 2)} placeholder={busy ? "Cambiando empresa…" : "Empresa activa"} className="h-9 text-xs sm:text-sm" /></div>{error && <div role="alert" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border bg-card p-3 text-xs text-orange-700 shadow-lg dark:text-orange-300"><p>{error}</p><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setRevision(value => value + 1)}>Actualizar empresas</Button></div>}<Dialog open={busy}><DialogContent compact showCloseButton={false} onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}><DialogTitle>Cambiando empresa</DialogTitle><p className="text-sm text-muted-foreground" role="status">Actualizando tus permisos y tu espacio de trabajo…</p></DialogContent></Dialog></div>;
}
