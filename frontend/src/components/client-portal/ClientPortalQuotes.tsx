"use client";

import { useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { downloadBlob } from "@/lib/download-blob";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientPortalDocumentLines } from "./ClientPortalDocumentLines";
import { ClientPortalService } from "@/services/client-portal.service";
import type { ClientPortalQuote } from "@/types/client-portal";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const dates = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });
const statusLabels: Record<string, string> = { sent: "Pendiente de aceptación", accepted: "Aceptado", rejected: "Rechazado", expired: "Vencido" };

function expiry(value: string | null | undefined) {
    if (!value) return null;
    const date = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + "Z");
    return Number.isNaN(date.getTime()) ? null : date;
}

export function ClientPortalQuotes({ quotes, workspaceId, onAccepted, refresh, filtered = false }: {
    quotes: ClientPortalQuote[];
    workspaceId: number;
    onAccepted: (quote: ClientPortalQuote) => void;
    refresh: () => void;
    filtered?: boolean;
}) {
    const [selected, setSelected] = useState<ClientPortalQuote | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [accepting, setAccepting] = useState(false);
    const [downloading, setDownloading] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [loadedAt] = useState(() => Date.now());

    async function accept() {
        if (!selected || !confirmed || accepting) return;
        setAccepting(true); setError("");
        try {
            const quote = await ClientPortalService.acceptQuote(workspaceId, selected.id, { expected_revision: selected.revision_number, confirmed: true });
            onAccepted(quote); setSelected(null); setConfirmed(false);
            toast.success("Presupuesto aceptado. La revisión y tu cuenta han quedado registradas.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo aceptar el presupuesto."); }
        finally { setAccepting(false); }
    }

    async function download(quote: ClientPortalQuote) {
        setDownloading(quote.id);
        try {
            const blob = await ClientPortalService.downloadQuote(workspaceId, quote.id);
            downloadBlob(blob, `${quote.quote_number}.pdf`);
        } catch (reason) { toast.error(reason instanceof Error ? reason.message : "No se pudo descargar el presupuesto."); }
        finally { setDownloading(null); }
    }

    if (!quotes.length) return <Card><CardContent className="py-12 text-center"><p className="font-semibold">{filtered ? "No hay presupuestos para esta selección" : "No hay presupuestos disponibles"}</p><p className="mt-2 text-sm text-muted-foreground">{filtered ? "Modifica la búsqueda o muestra todos los documentos." : "Aquí aparecerán los presupuestos enviados para esta empresa."}</p></CardContent></Card>;
    return <>
        <div className="grid items-start gap-4 lg:grid-cols-2">{quotes.map(quote => {
            const until = expiry(quote.valid_until);
            const expired = until !== null && until.getTime() <= loadedAt;
            return <Card key={quote.id}><CardContent><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{quote.quote_number} · Revisión {quote.revision_number}</p><h2 className="mt-1 font-semibold">{quote.title}</h2></div><span className={quote.status === "accepted" ? "shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "shrink-0 rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-950 dark:text-orange-200"}>{expired && quote.status === "sent" ? "Vencido" : statusLabels[quote.status] ?? quote.status}</span></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-y py-3 text-sm"><div><dt className="text-xs text-muted-foreground">Válido hasta</dt><dd className="mt-1 font-medium">{until ? dates.format(until) : "Sin fecha límite"}</dd></div><div><dt className="text-xs text-muted-foreground">Total con impuestos</dt><dd className="mt-1 font-mono font-bold">{money.format(quote.total_amount)}</dd></div></dl>
                {quote.terms && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{quote.terms}</p>}<ClientPortalDocumentLines lines={quote.lines} />
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3"><Button type="button" variant="outline" size="sm" disabled={downloading !== null} onClick={() => void download(quote)}><Download className="size-4" />{downloading === quote.id ? "Descargando…" : "Descargar PDF"}</Button>{quote.status === "sent" && !expired && <Button type="button" size="sm" onClick={() => { setError(""); setConfirmed(false); setSelected(quote); }}>Aceptar presupuesto</Button>}{quote.status === "accepted" && <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" />Revisión aceptada</p>}</div>
            </CardContent></Card>;
        })}</div>
        <AlertDialog open={selected !== null} onOpenChange={open => { if (!open && !accepting) { setSelected(null); setConfirmed(false); setError(""); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Aceptar presupuesto</AlertDialogTitle><AlertDialogDescription>Confirma los servicios, el importe y las condiciones de esta revisión. La aceptación quedará registrada con tu cuenta.</AlertDialogDescription></AlertDialogHeader>
            {selected && <><div className="space-y-1 rounded-xl border bg-muted/30 p-3 text-sm"><p className="font-semibold">{selected.title}</p><p>{selected.quote_number} · Revisión {selected.revision_number}</p><p className="text-lg font-semibold">{money.format(selected.total_amount)} <span className="text-xs font-normal text-muted-foreground">impuestos incluidos</span></p></div><label className="flex items-start gap-3 rounded-xl border p-3 text-sm leading-6"><Checkbox checked={confirmed} disabled={accepting} onCheckedChange={value => setConfirmed(value === true)} aria-label="Confirmar los servicios y condiciones de esta revisión" /><span>He revisado esta revisión y acepto sus servicios, importe y condiciones como representante autorizado del cliente.</span></label></>}
            {error && <div role="alert" className="space-y-2 text-sm text-orange-700 dark:text-orange-300"><p>{error}</p><Button type="button" variant="outline" size="sm" onClick={() => { setSelected(null); refresh(); }}>Actualizar documentos</Button></div>}
            <AlertDialogFooter><AlertDialogCancel disabled={accepting}>Volver a revisar</AlertDialogCancel><AlertDialogAction disabled={!confirmed || accepting} onClick={event => { event.preventDefault(); void accept(); }}>{accepting && <Loader2 className="size-4 animate-spin" />}{accepting ? "Registrando…" : "Confirmar aceptación"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent></AlertDialog>
    </>;
}
