"use client";

import { CalendarClock, CheckCircle2, Send } from "lucide-react";
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { Button } from "@/components/ui/button";
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { formatCurrency } from "@/lib/format";
import { quoteExpiresSoon, type QuoteAttention } from "@/lib/quote-workspace";
import type { Quote } from "@/types/quote";

export function QuotesOverview({ quotes, today, attention, onAttentionChange, statusLabels, onStatusChange }: {
    quotes: Quote[]; today: string; attention: QuoteAttention; onAttentionChange: (value: QuoteAttention) => void;
    statusLabels: Record<string, string>; onStatusChange: (status: string) => void;
}) {
    const sent = quotes.filter((quote) => quote.status === "sent");
    const expiring = quotes.filter((quote) => quoteExpiresSoon(quote, today));
    const accepted = quotes.filter((quote) => quote.status === "accepted");
    return <div className="mb-4 space-y-3">
        <p className="text-xs text-muted-foreground">Cartera actual · EUR · Actualizado al cargar · Vigencia a {today}</p>
        <SummaryMetricGrid desktopColumns={3}>
            <FinanceMetricButton label="Por responder" value={String(sent.length)} description="Presupuestos enviados · ver registros" icon={Send} active={attention === "respond"} onClick={() => onAttentionChange("respond")} />
            <FinanceMetricButton label="Vencen en 7 días" value={String(expiring.length)} description="Enviados con vigencia próxima" icon={CalendarClock} active={attention === "expiring"} attention={expiring.length > 0} onClick={() => onAttentionChange("expiring")} />
            <FinanceMetricButton label="Importe aceptado" value={formatCurrency(accepted.reduce((sum, quote) => sum + quote.total_amount, 0))} description={`${accepted.length} aceptados · cartera actual, con impuestos`} icon={CheckCircle2} active={attention === "accepted"} onClick={() => onAttentionChange("accepted")} />
        </SummaryMetricGrid>
        <section className="billing-surface rounded-xl p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Presupuestos por estado</h2>{attention !== "all" && <Button size="sm" variant="ghost" onClick={() => onAttentionChange("all")}>Quitar prioridad</Button>}</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries(statusLabels).map(([status, label]) => {
            const rows = quotes.filter((quote) => quote.status === status);
            return <Button type="button" variant="outline" key={status} onClick={() => { onAttentionChange("all"); onStatusChange(status); }} className="h-auto flex-col items-start gap-1 p-3"><span className="text-xs text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{rows.length}</span><span className="text-xs tabular-nums">{formatCurrency(rows.reduce((sum, quote) => sum + quote.total_amount, 0))}</span></Button>;
        })}</div><p className="mt-3 text-xs leading-5 text-muted-foreground">Tasa de aceptación por periodo: sin datos de resolución completos. No se utilizan las fechas de edición como si fueran fechas de aceptación o rechazo.</p></section>
    </div>;
}
