"use client";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { documentRegister, type RegisteredDocument } from "@/services/document-register.service";

export function DocumentPublicationDialog({ document, revoke = false, close, saved }: { document: RegisteredDocument; revoke?: boolean; close: () => void; saved: (row: RegisteredDocument) => void }) {
    const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
    const current = document.current;
    async function save() {
        if (!document.id || !confirmed || (!revoke && (!current?.id || !current.revision_hash))) return;
        setBusy(true); setError("");
        try { saved(await documentRegister.publication(document.id, revoke ? { revision_id: null } : { revision_id: current!.id, expected_hash: current!.revision_hash! })); close(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cambiar la publicación."); }
        finally { setBusy(false); }
    }
    return <AlertDialog open onOpenChange={open => { if (!open && !busy) close(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{revoke ? "Retirar del portal del cliente" : "Publicar revisión para el cliente"}</AlertDialogTitle><AlertDialogDescription>{revoke ? "El cliente dejará de tener acceso al archivo publicado. El documento, las revisiones y las firmas se conservan en la empresa." : "Solo las personas autorizadas en el portal del cliente vinculado a esta ficha podrán consultar y firmar esta revisión. Una nueva revisión seguirá siendo privada hasta que la publiques."}</AlertDialogDescription></AlertDialogHeader><div className="rounded-xl border bg-muted/30 p-3 text-sm"><strong>{document.title}</strong><p className="mt-1">{document.owner_name} · {revoke ? "Publicada: revisión " + document.published_revision : "Revisión " + current?.revision}</p></div><label className="flex items-start gap-3 rounded-xl border p-3 text-sm leading-6"><Checkbox checked={confirmed} disabled={busy} onCheckedChange={value => setConfirmed(value === true)} /><span>{revoke ? "Confirmo que quiero retirar el acceso del cliente a esta publicación." : "He revisado el archivo y autorizo compartir esta revisión con el cliente de esta ficha."}</span></label>{error && <p role="alert" className="text-sm text-orange-700">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy || !confirmed} onClick={event => { event.preventDefault(); void save(); }}>{busy ? "Guardando…" : revoke ? "Retirar publicación" : "Publicar revisión"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
