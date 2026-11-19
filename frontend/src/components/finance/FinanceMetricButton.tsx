"use client";

import type { LucideIcon } from "lucide-react";
import { SummaryMetricCard } from "@/components/ui/summary-metric-card";

export function FinanceMetricButton({ label, value, description, icon, onClick, active = false, attention = false }: {
    label: string; value: string; description: string; icon: LucideIcon;
    onClick: () => void; active?: boolean; attention?: boolean;
}) {
    return <div className={`relative min-w-0 rounded-xl ${active ? "ring-2 ring-accent" : ""} ${attention ? "ring-1 ring-orange-400/60" : ""}`}>
        <SummaryMetricCard label={label} value={value} description={description} icon={icon}
            className={`h-full ${attention ? "border-orange-400/40 bg-orange-400/5" : ""}`} />
        <button type="button" onClick={onClick} aria-pressed={active} aria-label={`${label}: ${value}. ${description}`}
            className="absolute inset-0 rounded-xl outline-none transition-shadow hover:ring-2 hover:ring-accent/40 focus-visible:ring-2 focus-visible:ring-accent"><span className="sr-only">Ver {label.toLocaleLowerCase()}</span></button>
    </div>;
}
