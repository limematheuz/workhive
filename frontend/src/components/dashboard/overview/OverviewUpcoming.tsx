import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type OperationsOverview } from "@/domain/tasks/operations-overview";
import type { OverviewTaskPresentation } from "./OverviewAgenda";

export function OverviewTomorrow({ data, presentation: { c }, onTomorrow }: { data: OperationsOverview; presentation: OverviewTaskPresentation; onTomorrow: () => void }) {
    const covered = data.planned.length - data.unassigned.length;
    return <section className="wh-overview-panel wh-overview-tomorrow" aria-labelledby="overview-tomorrow-title">
        <header className="wh-overview-section-heading"><h2 id="overview-tomorrow-title">{c.upcoming}</h2><Button type="button" variant="ghost" size="xs" onClick={onTomorrow}>{c.see}<ArrowRight /></Button></header>
        {data.planned.length ? <><div className="wh-overview-tomorrow-counts"><div><strong>{data.planned.length}</strong><span>{c.tasks}</span></div><div><strong>{data.team.length}</strong><span>{c.team}</span></div><div><strong>{data.unassigned.length}</strong><span>{c.unassigned}</span></div></div><div className="wh-overview-coverage"><span>{c.coverage}</span><strong>{covered}/{data.planned.length} {c.covered}</strong></div><progress className="wh-overview-progress" value={covered} max={data.planned.length} aria-label={c.coverage} /></> : <p className="wh-overview-footnote">{c.noTomorrow}</p>}
    </section>;
}
