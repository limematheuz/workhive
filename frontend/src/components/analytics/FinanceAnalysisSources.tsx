"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { DataListTable } from "@/components/ui/data-list-table";
import { Button } from "@/components/ui/button";
import { financePeriodBounds, isRevenueInvoice, type FinancePaymentRecord, type FinancePeriod, type FinanceRevenueRecord } from "@/lib/finance-analytics";
import { formatCurrency, formatDate } from "@/lib/format";
import { downloadBlob } from "@/lib/download-blob";
import type { Expense } from "@/types/expense";

export type FinanceSourceScope = "revenue" | "payments" | "expenses" | "balance";
export function FinanceAnalysisSources({ revenue, payments, expenses, period, scope, category, onClearCategory }: {
    revenue: FinanceRevenueRecord[]; payments: FinancePaymentRecord[]; expenses: Expense[]; period: FinancePeriod;
    scope: FinanceSourceScope; category: string; onClearCategory: () => void;
}) {
    const { start, end } = financePeriodBounds(period);
    const included = (date: string) => { const value = Date.parse(date); return value >= start.getTime() && value < end.getTime(); };
    const income = revenue.filter((invoice) => isRevenueInvoice(invoice) && included(invoice.issue_date));
    const spent = expenses.filter((expense) => included(expense.expense_date) && (!category || expense.category === category));
    const cash = payments.filter((payment) => payment.status === "received" && included(payment.received_at));
    type Row = { id: string; label: string; kind: string; date: string; amount: number; href?: string };
    const incomeRows: Row[] = income.map((invoice, index) => ({ id: `revenue-${invoice.source_type ?? "invoice"}-${invoice.id ?? index}`, label: invoice.document_number ?? (invoice.id ? `Factura #${invoice.id}` : "Venta histórica"), kind: invoice.source_type === "manual" ? "Venta histórica" : "Factura", date: invoice.issue_date, amount: invoice.base_amount, href: invoice.source_type !== "manual" && invoice.id ? `/dashboard/invoices?invoice=${invoice.id}` : undefined }));
    const expenseRows: Row[] = spent.map((expense) => ({ id: `expense-${expense.id}`, label: expense.description, kind: "Gasto", date: expense.expense_date, amount: scope === "balance" ? -expense.base_amount : expense.base_amount }));
    const rows: Row[] = scope === "revenue" ? incomeRows : scope === "expenses" ? expenseRows : scope === "balance" ? [...incomeRows, ...expenseRows] : cash.map((payment, index) => ({ id: `payment-${index}`, label: `Cobro ${index + 1}`, kind: "Cobro recibido", date: payment.received_at, amount: Number(payment.amount) }));
    const titles: Record<FinanceSourceScope, string> = { revenue: "Origen de los ingresos", payments: "Origen de los cobros", expenses: "Origen de los gastos", balance: "Ingresos menos gastos registrados" };
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const exportRows = () => {
        const cell = (value: unknown) => `"${String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
        const csv = ["Documento;Tipo;Fecha;Importe EUR", ...rows.map((row) => [row.label, row.kind, row.date, row.amount.toFixed(2)].map(cell).join(";"))].join("\n");
        downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `analitica-${scope}-${start.toISOString().slice(0, 10)}.csv`);
    };
    return <DataListTable items={rows} getRowKey={(row) => row.id} columns={[{ key: "document", label: "Documento / registro" }, { key: "kind", label: "Origen" }, { key: "date", label: "Fecha" }, { key: "amount", label: scope === "payments" ? "Cobro con impuestos EUR" : "Base sin impuestos EUR", className: "text-right" }]} header={{ title: titles[scope], subtitle: `${formatDate(start.toISOString())} → ${formatDate(end.toISOString())} · ${rows.length} registros · Total ${formatCurrency(total)}` }} toolbar={<div className="flex flex-wrap justify-between gap-2">{category ? <Button variant="ghost" size="sm" onClick={onClearCategory}>Quitar categoría: {category}</Button> : <span className="text-xs text-muted-foreground">KPI, selección y CSV utilizan estos registros.</span>}<Button size="sm" variant="outline" disabled={rows.length === 0} onClick={exportRows}><Download />Exportar selección</Button></div>} empty={<p className="text-sm text-muted-foreground">No hay registros de este origen en el periodo.</p>} renderDesktopRow={(row) => [<span key="label">{row.href ? <Link className="text-accent hover:underline" href={row.href}>{row.label}</Link> : row.label}</span>, <span key="kind">{row.kind}</span>, <span key="date">{formatDate(row.date)}</span>, <span key="amount" className="block text-right tabular-nums">{formatCurrency(row.amount)}</span>]} renderCompactRow={(row) => <div className="space-y-2"><p className="text-sm font-semibold">{row.href ? <Link className="text-accent" href={row.href}>{row.label}</Link> : row.label}</p><p className="text-xs text-muted-foreground">{row.kind} · {formatDate(row.date)}</p><strong className="text-sm tabular-nums">{formatCurrency(row.amount)}</strong></div>} />;
}
