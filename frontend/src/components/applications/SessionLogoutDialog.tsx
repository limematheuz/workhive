"use client";
import { useCallback, useState } from "react";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { canManageTime } from "@/domain/access/roles";
import { useUser } from "@/lib/user-context";
import { WorkSessionService } from "@/services/work-session.service";
import type { WorkSession } from "@/types/user";

export function SessionLogoutDialog({ open, onOpenChange, onLogout }: {
    open: boolean; onOpenChange: (open: boolean) => void; onLogout: () => void | Promise<void>;
}) {
    const { user } = useUser();
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const [check, setCheck] = useState<{ key: string; active: WorkSession | null; error: boolean } | null>(null);
    const key = `${user?.id}:${user?.company_id}:${open}`;
    const request = useCallback(() => WorkSessionService.getActiveSession(), []);
    const receive = useCallback((active: WorkSession | null) => setCheck({ key, active, error: false }), [key]);
    const failed = useCallback(() => setCheck({ key, active: null, error: true }), [key]);
    const hasTimeAccess = canManageTime(user);
    useResourceEffect(open && hasTimeAccess, key, request, receive, failed);
    const current = check?.key === key ? check : null;
    async function confirm() {
        setBusy(true); setError("");
        try { await onLogout(); setCheck(null); onOpenChange(false); }
        catch { setError("No se pudo cerrar la sesión. Comprueba la conexión y vuelve a intentarlo."); }
        finally { setBusy(false); }
    }
    return <Dialog open={open} onOpenChange={value => { if (!busy) { setError(""); setCheck(null); onOpenChange(value); } }}><DialogContent compact confirmDiscard={false}><DialogHeader><DialogTitle>Cerrar sesión</DialogTitle><DialogDescription>Saldrás de tu cuenta de WorkHive en este navegador.</DialogDescription></DialogHeader>
        {hasTimeAccess && <div className="rounded-lg border p-3 text-sm">{current?.active ? <><p className="font-medium text-[var(--alert-warning-text)]">Tienes un fichaje en curso</p><p className="mt-1">El fichaje seguirá abierto al cerrar sesión. Para finalizar la jornada, ciérralo desde Fichaje.</p><Button variant="outline" asChild className="mt-3"><Link href="/worker/clock" onClick={() => onOpenChange(false)}>Ir a Fichaje</Link></Button></> : <p>{!current ? "Comprobando tu fichaje…" : current.error ? "No se pudo comprobar el fichaje. Si tienes uno abierto, seguirá en curso al salir." : "No tienes un fichaje en curso."}</p>}</div>}
        <p className="text-xs text-muted-foreground">Los partes guardados en este dispositivo que estén pendientes de sincronizar se conservan para esta cuenta y empresa.</p>
        {error && <p role="alert" className="text-sm text-[var(--priority-high-text)]">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => { setCheck(null); onOpenChange(false); }}>Seguir en WorkHive</Button><Button disabled={busy} onClick={() => void confirm()}><LogOut aria-hidden="true" className="size-4" />{busy ? "Cerrando sesión…" : "Cerrar sesión"}</Button></DialogFooter>
    </DialogContent></Dialog>;
}
