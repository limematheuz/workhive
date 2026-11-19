"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TaskClientPublicationService, type PublishedWork } from "@/services/task-client-publication.service";

export function ClientPartAcceptance({ part, workspaceId, defaultSignerName, accepted, refresh }: {
    part: PublishedWork; workspaceId: number; defaultSignerName: string; accepted: (part: PublishedWork) => void; refresh: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [signer, setSigner] = useState(defaultSignerName);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function accept() {
        if (!signer.trim() || !confirmed || busy) return;
        setBusy(true); setError("");
        try {
            accepted(await TaskClientPublicationService.accept(workspaceId, part, signer.trim()));
            setOpen(false); toast.success("Validación del trabajo registrada para esta revisión.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo validar esta revisión."); } finally { setBusy(false); }
    }
    if (part.acceptance) return <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" />Trabajo validado por {part.acceptance.signer_name}</p>;
    return <><Button type="button" onClick={() => setOpen(true)}>Validar trabajo</Button><AlertDialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); if (!value) { setConfirmed(false); setError(""); } } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Validar el trabajo publicado</AlertDialogTitle><AlertDialogDescription>La validación se vincula al parte y fotografías de esta revisión. Tu cuenta, el nombre declarado y la fecha quedarán registrados.</AlertDialogDescription></AlertDialogHeader><div className="rounded-xl border bg-muted/30 p-3 text-sm"><strong>{part.manifest.title}</strong><p className="mt-1 text-muted-foreground">{part.manifest.location_name} · Revisión {part.revision}</p></div><label className="text-sm">Nombre del representante<Input className="mt-1" maxLength={255} value={signer} disabled={busy} onChange={event => setSigner(event.target.value)} /></label><label className="flex items-start gap-3 rounded-xl border p-3 text-sm leading-6"><Checkbox checked={confirmed} disabled={busy} onCheckedChange={value => setConfirmed(value === true)} /><span>He revisado el resumen, las tareas y las fotografías de esta revisión y confirmo la conformidad del trabajo como representante autorizado del cliente.</span></label>{error && <div role="alert" className="space-y-2 text-sm text-orange-700 dark:text-orange-300"><p>{error}</p><Button type="button" size="sm" variant="outline" onClick={() => { setOpen(false); refresh(); }}>Actualizar partes</Button></div>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Volver a revisar</AlertDialogCancel><AlertDialogAction disabled={busy || !confirmed || !signer.trim()} onClick={event => { event.preventDefault(); void accept(); }}>{busy ? "Registrando…" : "Confirmar validación"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
