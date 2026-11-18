"use client";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { documentRegister, safeDocumentDownloadUrl, type RegisteredDocument } from "@/services/document-register.service";
import { documentCalendarDate } from "@/lib/document-register-format";

export function DocumentSignDialog({ document, statement, signerName, portalGrant, close, saved }: { document: RegisteredDocument; statement: string; signerName: string; portalGrant?: number; close: () => void; saved: (row: RegisteredDocument) => void }) {
    const [name, setName] = useState(signerName), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
    const revision = document.current;
    const url = revision && safeDocumentDownloadUrl(revision.download_url);
    async function sign() {
        if (!document.id || !revision?.id || !revision.revision_hash || !statement.trim() || !confirmed || name.trim().length < 2) return;
        setBusy(true); setError("");
        try {
            const body = { expected_revision: revision.revision, expected_hash: revision.revision_hash, signer_name: name.trim(), confirmed: true as const };
            const result = portalGrant === undefined ? await documentRegister.sign(document.id, revision.id, body) : await documentRegister.portalSign(portalGrant, document.id, revision.id, body);
            saved(result); close();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo firmar la revisión."); }
        finally { setBusy(false); }
    }
    return <AlertDialog open onOpenChange={open => { if (!open && !busy) close(); }}><AlertDialogContent className="max-h-[90vh] overflow-y-auto"><AlertDialogHeader><AlertDialogTitle>Firmar revisión del documento</AlertDialogTitle><AlertDialogDescription>La firma simple quedará vinculada a tu cuenta, al nombre declarado y a esta revisión concreta.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm"><strong>{document.title}</strong><p>{document.owner_name} · Revisión {revision?.revision}</p><p className="text-xs text-muted-foreground">{revision?.file_name} · {documentCalendarDate(revision?.expires_on)}</p>{url && <Button variant="outline" size="sm" asChild><a href={url} target="_blank" rel="noopener noreferrer">Abrir esta revisión</a></Button>}</div><label className="space-y-1 text-sm">Nombre declarado<Input value={name} maxLength={200} disabled={busy} onChange={event => setName(event.target.value)} autoComplete="name" /></label><label className="flex items-start gap-3 rounded-xl border p-3 text-sm leading-6"><Checkbox checked={confirmed} disabled={busy} onCheckedChange={value => setConfirmed(value === true)} /><span>{statement}</span></label>{error && <p role="alert" className="text-sm text-orange-700 dark:text-orange-300">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Volver a revisar</AlertDialogCancel><AlertDialogAction disabled={busy || !statement.trim() || !confirmed || name.trim().length < 2 || !revision?.revision_hash} onClick={event => { event.preventDefault(); void sign(); }}>{busy ? "Registrando…" : "Confirmar firma simple"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
