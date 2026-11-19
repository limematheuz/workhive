"use client";
import { CircleAlert, CircleCheck, Clock3, UsersRound } from "lucide-react";
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { formatCurrency } from "@/lib/format";
import { useDictionary } from "@/lib/dictionary-context";
import type { ClientWorkspaceMonthlyRevenue, ClientWorkspaceSummary } from "@/lib/client-workspace";
export function ClientWorkspaceStats({ summary, onFilter }: {
 summary: ClientWorkspaceSummary; monthlyRevenue: ClientWorkspaceMonthlyRevenue | null;
 onFilter?: (kind: "all" | "active" | "missing" | "balance") => void;
}) {
 const { dict } = useDictionary(); const text = dict.clients.workspace;
 return <SummaryMetricGrid desktopColumns={4} aria-label={text.stats_label}>
 <FinanceMetricButton label={text.stats_total} value={String(summary.clientCount)} description="Clientes de esta vista · abrir listado" icon={UsersRound} onClick={() => onFilter?.("all")} />
 <FinanceMetricButton label={text.stats_active} value={String(summary.activeClientCount)} description="Activos · ver clientes" icon={CircleCheck} onClick={() => onFilter?.("active")} />
 <FinanceMetricButton label={text.stats_pending_contact} value={String(summary.missingContactCount)} description={text.stats_pending_contact_description} icon={Clock3} attention={summary.missingContactCount > 0} onClick={() => onFilter?.("missing")} />
 {summary.hasFinancialData && <FinanceMetricButton label={text.stats_balance} value={formatCurrency(summary.pendingBalanceTotal)} description="Saldo actual · todas las emisiones · EUR" icon={CircleAlert} attention={summary.pendingBalanceTotal > 0} onClick={() => onFilter?.("balance")} />}
 </SummaryMetricGrid>;
}
