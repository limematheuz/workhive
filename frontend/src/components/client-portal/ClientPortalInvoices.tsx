"use client";
import { snapshotLineRows } from "@/lib/snapshot-line-rows";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { downloadBlob } from "@/lib/download-blob";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClientPortalService } from "@/services/client-portal.service";
import { currencyMoney } from "@/lib/transaction-currency";
import type { ClientPortalInvoice } from "@/types/client-portal";
import { ClientPortalDocumentLines } from "./ClientPortalDocumentLines";

const date = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });
const formatDate = (value?: string | null) => value ? date.format(new Date(value)) : "—";
const statuses: Record<string, string> = { issued: "Emitida", paid: "Pagada", overdue: "Vencida", partially_paid: "Pago parcial", rectified: "Rectificada", cancelled: "Cancelada" };
export function ClientPortalInvoices({ invoices, workspaceId, filtered = false }: { invoices: ClientPortalInvoice[]; workspaceId: number; filtered?: boolean }) {
    const [downloading, setDownloading] = useState<number | null>(null);
    const download = async (invoice: ClientPortalInvoice) => {
        try {
            setDownloading(invoice.id);
            const blob = await ClientPortalService.downloadInvoice(workspaceId, invoice.id);
            downloadBlob(blob, `${invoice.invoice_number}.pdf`);
        } catch (cause) { toast.error(cause instanceof Error ? cause.message : "No se pudo descargar la factura."); }
        finally { setDownloading(null); }
    };
    if (!invoices.length) return <Card><CardContent className="py-12 text-center"><h2 className="font-semibold">{filtered ? "No hay facturas para esta selección" : "No hay facturas disponibles"}</h2><p className="mt-2 text-sm text-muted-foreground">{filtered ? "Prueba con otra referencia o muestra todas las facturas." : "Las facturas emitidas para esta empresa aparecerán aquí."}</p></CardContent></Card>;
    return <div className="space-y-4">{invoices.map(invoice => {
        const snapshot = invoice.currency_snapshot;
        return <Card key={invoice.id}><CardContent><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xs text-muted-foreground">{invoice.invoice_number}</p><Badge variant="secondary">{statuses[invoice.status] ?? invoice.status}</Badge>{invoice.is_rectification && <Badge variant="secondary">Rectificativa</Badge>}</div><p className="mt-2 text-sm text-muted-foreground">Emitida el {formatDate(invoice.issue_date)} · Vence {formatDate(invoice.due_date)}</p></div><div className="flex shrink-0 items-center gap-3"><div className="text-right"><p className="font-mono text-lg font-bold">{snapshot ? currencyMoney(snapshot.original_amounts.total_amount, snapshot.currency) : currencyMoney(invoice.total_amount)}</p>{snapshot && snapshot.currency !== "EUR" && <p className="mt-1 text-xs text-muted-foreground">Equivalencia contable {currencyMoney(invoice.total_amount)}</p>}</div><Button type="button" variant="outline" size="sm" disabled={downloading === invoice.id} onClick={() => void download(invoice)}><Download className="size-4" />{downloading === invoice.id ? "Descargando…" : "PDF"}</Button></div></div>
            {snapshot && <p className="mt-3 text-xs text-muted-foreground">Cambio del {snapshot.rate_date}: 1 {snapshot.currency} = {snapshot.eur_rate} EUR.</p>}
            {snapshot?.original_lines?.length ? <div className="mt-4 divide-y border-t">{snapshotLineRows(snapshot.original_lines).map(({line, key}) => <div key={key} className="flex justify-between gap-4 py-3 text-sm"><div className="min-w-0"><p className="break-words font-medium">{line.description}</p><p className="mt-1 text-xs text-muted-foreground">{line.quantity} × {currencyMoney(line.unit_price, snapshot.currency, true)}</p></div><span className="shrink-0 font-mono font-semibold">{currencyMoney(line.subtotal, snapshot.currency)}</span></div>)}</div> : <ClientPortalDocumentLines lines={invoice.lines} />}
        </CardContent></Card>;
    })}</div>;
}
