"use client";

import { Copy, Link2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { email: string; invitationUrl: string; verificationCode: string; expiresAt: string; onClose: () => void; title?: string };
const expiryFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });

/** Secrets remain in this creation view only; the invitation list cannot recover them. */
export function InvitationLinkDialog({ email, invitationUrl, verificationCode, expiresAt, onClose, title = "Enlace de invitación creado" }: Props) {
    const expiry = useMemo(() => { const date = new Date(expiresAt); return Number.isFinite(date.getTime()) ? expiryFormatter.format(date) : ""; }, [expiresAt]);
    async function copy(value: string) {
        try { await navigator.clipboard.writeText(value); toast.success("Copiado."); }
        catch { toast.error("No se pudo copiar. Selecciona el contenido del campo y cópialo."); }
    }
    return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="size-5" />{title}</DialogTitle><DialogDescription>Para {email}. No se ha enviado ningún correo. Entrega el enlace y el código a esta persona por un canal de confianza.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="created-invitation-link">Enlace de activación</Label><div className="flex gap-2"><Input id="created-invitation-link" value={invitationUrl} readOnly onFocus={event => event.currentTarget.select()} /><Button variant="outline" aria-label="Copiar enlace de invitación" onClick={() => void copy(invitationUrl)}><Copy className="size-4" /></Button></div></div><div className="space-y-2"><Label htmlFor="created-invitation-code">Código de invitación</Label><div className="flex gap-2"><Input id="created-invitation-code" value={verificationCode} readOnly className="font-mono tracking-widest" onFocus={event => event.currentTarget.select()} /><Button variant="outline" aria-label="Copiar código de invitación" onClick={() => void copy(verificationCode)}><Copy className="size-4" /></Button></div></div><p className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 text-sm leading-6 text-orange-800 dark:text-orange-200">Guarda ambos antes de cerrar. Solo se muestran ahora y no pueden recuperarse del listado. {expiry && `Caducan el ${expiry}.`}</p></div><DialogFooter><Button onClick={onClose}>He guardado el enlace y el código</Button></DialogFooter></DialogContent></Dialog>;
}
