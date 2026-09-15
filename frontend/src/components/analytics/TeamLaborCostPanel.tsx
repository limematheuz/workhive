import { BriefcaseBusiness, Clock3 } from "lucide-react";

import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { formatCurrency } from "@/lib/format";
import type { TeamLaborCost } from "@/types/margin-forecast";

type TeamLaborCostPanelProps = {
    team: TeamLaborCost;
    copy: Record<string, string>;
};

export function TeamLaborCostPanel({ team, copy }: TeamLaborCostPanelProps) {
    return (
        <section
            className="border-b border-[var(--border-soft)] py-5"
            aria-label={copy.operational_margin_team_title}
        >
            <div className="flex min-w-0 gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-accent">
                    <BriefcaseBusiness className="size-4" aria-hidden="true" />
                </span>
                <div>
                    <h3 className="text-sm font-semibold text-[var(--text-main)]">{copy.operational_margin_team_title}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.operational_margin_team_subtitle}</p>
                </div>
            </div>
            <SummaryMetricGrid className="mt-4" desktopColumns={4} aria-label={team.team_name}>
                <SummaryMetricCard
                    icon={BriefcaseBusiness}
                    label={copy.operational_margin_team_cost}
                    value={formatCurrency(team.actual_labor_cost_base_amount)}
                />
                <SummaryMetricCard
                    icon={Clock3}
                    label={copy.operational_margin_team_sessions}
                    value={String(team.work_session_count)}
                />
            </SummaryMetricGrid>
        </section>
    );
}
