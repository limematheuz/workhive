"use client";

import { CircleAlert, CircleCheck, Clock3, ReceiptText, UsersRound } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import type { ClientWorkspaceSummary } from "@/lib/client-workspace";

type ClientWorkspaceStatsProps = {
    summary: ClientWorkspaceSummary;
    year: number;
};

export function ClientWorkspaceStats({ summary, year }: ClientWorkspaceStatsProps) {
    const cards = [
        {
            label: "Total clientes",
            value: String(summary.clientCount),
            detail: "Todos los clientes",
            icon: UsersRound,
            accentClassName: "bg-[var(--brand-blue-soft)] text-accent",
        },
        {
            label: "Clientes activos",
            value: String(summary.activeClientCount),
            detail: summary.clientCount > 0 ? `${Math.round((summary.activeClientCount / summary.clientCount) * 100)}% del total` : "Sin clientes",
            icon: CircleCheck,
            accentClassName: "bg-emerald-500/10 text-emerald-700",
        },
        {
            label: "Pendientes de contacto",
            value: String(summary.missingContactCount),
            detail: "Sin email ni teléfono",
            icon: Clock3,
            accentClassName: "bg-amber-500/10 text-amber-700",
        },
        summary.hasFinancialData
            ? {
                label: "Saldo pendiente",
                value: formatCurrency(summary.pendingBalanceTotal),
                detail: "Facturas emitidas o vencidas",
                icon: CircleAlert,
                accentClassName: "bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)]",
            }
            : {
                label: "Ubicaciones",
                value: String(summary.locationCount),
                detail: "En todos los clientes",
                icon: UsersRound,
                accentClassName: "bg-[var(--brand-blue-soft)] text-accent",
            },
        summary.hasFinancialData
            ? {
                label: `Facturación (${year})`,
                value: formatCurrency(summary.annualBillingTotal),
                detail: "Sin IVA",
                icon: ReceiptText,
                accentClassName: "bg-[var(--brand-blue-soft)] text-accent",
            }
            : {
                label: "Trabajos pendientes",
                value: String(summary.pendingTaskCount),
                detail: "En todas las ubicaciones",
                icon: CircleAlert,
                accentClassName: "bg-amber-500/10 text-amber-700",
            },
    ];

    return (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumen de clientes">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <article key={card.label} className="billing-block rounded-[22px] p-4">
                        <div className="flex items-start gap-3">
                            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.accentClassName}`} aria-hidden="true">
                                <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-[var(--text-muted)]">{card.label}</p>
                                <p className="mt-1 font-mono text-xl font-semibold leading-tight text-[var(--text-main)]">{card.value}</p>
                                <p className="mt-2 truncate text-[11px] text-[var(--text-muted)]">{card.detail}</p>
                            </div>
                        </div>
                    </article>
                );
            })}
        </section>
    );
}
