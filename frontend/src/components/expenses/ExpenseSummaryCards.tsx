"use client";
import { Hash, ReceiptText, WalletCards } from "lucide-react";
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import { financeChange } from "@/lib/finance-workspace";
export function ExpenseSummaryCards({ total, tax, records, previous = null, missingReceipts = 0, receiptOnly = false, onReceiptFilter }: {
 total: number; tax: number; records: number; previous?: { total: number; tax: number } | null;
 missingReceipts?: number; receiptOnly?: boolean; onReceiptFilter?: (value: boolean) => void;
}) {
 const { dict } = useDictionary(); const text = dict.expenses;
 const change = previous ? financeChange(total, previous.total) : null;
 const comparison = change ? change.kind === "absolute" ? `${formatCurrency(change.value)} frente al periodo comparable` : `${change.value > 0 ? "+" : ""}${change.value.toFixed(1)}% frente al periodo comparable` : "Importe con impuestos · EUR";
 return <SummaryMetricGrid desktopColumns={3} className="gap-3">
 <FinanceMetricButton label={text.total_spent} value={formatCurrency(total)} description={comparison} icon={WalletCards} active={!receiptOnly} onClick={() => onReceiptFilter?.(false)} />
 <FinanceMetricButton label="Sin justificante" value={String(missingReceipts)} description="Pendientes de adjuntar · ver gastos" icon={ReceiptText} active={receiptOnly} attention={missingReceipts > 0} onClick={() => onReceiptFilter?.(true)} />
 <FinanceMetricButton label={text.records} value={String(records)} description={`Registros del periodo · IVA incluido: ${formatCurrency(tax)}`} icon={Hash} onClick={() => onReceiptFilter?.(false)} />
 </SummaryMetricGrid>;
}
