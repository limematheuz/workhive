"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DataListTable } from "@/components/ui/data-list-table";
import { Button } from "@/components/ui/button";
import { FinanceLoadError } from "./FinanceLoadError";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { InvoiceService } from "@/services/invoice.service";
import { ExpenseService } from "@/services/expense.service";
import { SalesLedgerService } from "@/services/sales-ledger.service";
import { fiscalSourceRecords, type FiscalSourceRecord } from "@/lib/fiscal-source-records";
import { downloadBlob } from "@/lib/download-blob";
import { formatCurrency, formatDate } from "@/lib/format";

export function FiscalSourceDialog({ year, period, scope, onClose }: { year: number; period: string; scope: "sales" | "expenses" | "all" | "withholding"; onClose: () => void }) {
    const [rows, setRows] = useState<FiscalSourceRecord[] | null>(null);
    const [error, setError] = useState(false);
    const [revision, setRevision] = useState(0);
    const request = useCallback(async () => {
        const [invoices, expenses, ledger] = await Promise.all([InvoiceService.getAllInvoices(), ExpenseService.getAllExpenses(), SalesLedgerService.getAllEntries({ year })]);
        return fiscalSourceRecords(invoices, expenses, ledger, year, period);
    }, [year, period]);
    useResourceEffect(true, `${year}:${period}:${revision}`, request, (data) => { setRows(data); setError(false); }, () => { setRows(null); setError(true); });
    const visible = (rows ?? []).filter((row) => scope === "all" || (scope === "expenses" ? row.kind === "expense" : scope === "withholding" ? row.withholding !== 0 : row.kind !== "expense"));
    const exportRows = () => {
        const cell = (value: unknown) => `"${String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
        const csv = ["Documento;Origen;Fecha;Base EUR;IVA repercutido EUR;IVA soportado EUR;Recargo EUR;Retención EUR", ...visible.map((row) => [row.label, row.kind, row.date.slice(0, 10), row.base, row.outputVat, row.inputVat, row.surcharge, row.withholding].map(cell).join(";"))].join("\n");
        downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `origen-fiscal-${year}-${period}-${scope}.csv`);
    };
    return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="flex max-h-[95dvh] max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:max-w-6xl"><DialogHeader><DialogTitle>Origen fiscal · {year} · {period === "annual" ? "Año completo" : period}</DialogTitle><DialogDescription>EUR · Facturas reportables por emisión, ventas históricas sin duplicados y gastos por fecha de registro.</DialogDescription></DialogHeader><div className="min-h-0 overflow-y-auto">{error ? <FinanceLoadError message="No se han podido consultar todos los documentos de origen." onRetry={() => { setError(false); setRevision((value) => value + 1); }} /> : <DataListTable items={visible} getRowKey={(row) => row.id} loading={rows === null} header={{ title: "Documentos del periodo", countLabel: `${visible.length} registros` }} toolbar={<Button variant="outline" size="sm" disabled={rows === null || visible.length === 0} onClick={exportRows}><Download />Exportar estos registros</Button>} columns={[{ key: "document", label: "Documento" }, { key: "date", label: "Fecha" }, { key: "base", label: "Base EUR" }, { key: "output", label: "IVA repercutido" }, { key: "input", label: "IVA soportado" }, { key: "withholding", label: "Retención" }]} empty={<p className="text-sm text-muted-foreground">No hay documentos para esta selección.</p>} renderDesktopRow={(row) => [<span key="document">{row.href ? <Link className="text-accent hover:underline" href={row.href}>{row.label}</Link> : row.label}<span className="mt-1 block text-xs text-muted-foreground">{row.kind === "invoice" ? "Factura" : row.kind === "expense" ? "Gasto" : "Venta histórica"}</span></span>, <span key="date">{formatDate(row.date)}</span>, <span key="base">{formatCurrency(row.base)}</span>, <span key="output">{formatCurrency(row.outputVat)}</span>, <span key="input">{formatCurrency(row.inputVat)}</span>, <span key="withholding">{formatCurrency(row.withholding)}</span>]} renderCompactRow={(row) => <div className="space-y-2"><strong className="block text-sm">{row.href ? <Link className="text-accent" href={row.href}>{row.label}</Link> : row.label}</strong><p className="text-xs text-muted-foreground">{formatDate(row.date)} · Base {formatCurrency(row.base)}</p><p className="text-xs">Repercutido {formatCurrency(row.outputVat)} · Soportado {formatCurrency(row.inputVat)}</p></div>} />}</div></DialogContent></Dialog>;
}
