import { ArrowDownLeft, Timer } from "lucide-react";

import { TaskProgressBar } from "@/components/tasks/TaskProgressBar";
import { formatHoursShort } from "@/lib/format-hours";
import type { TaskWorkDetailedSummary } from "@/types/user";

interface TechTaskCardSupplementaryInfoProps {
    checklistCompleted: number;
    checklistTotal: number;
    externalSource?: string | null;
    isExternal: boolean;
    workSummary?: TaskWorkDetailedSummary;
}

export function TechTaskCardSupplementaryInfo({
    checklistCompleted,
    checklistTotal,
    externalSource,
    isExternal,
    workSummary,
}: TechTaskCardSupplementaryInfoProps) {
    return (
        <>
            {isExternal && (
                <div
                    className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-accent"
                    title={externalSource ? `Servicio enviado por ${externalSource}` : "Servicio enviado por una empresa colaboradora"}
                >
                    <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                        {externalSource ? `Externo · ${externalSource}` : "Servicio externo"}
                    </span>
                </div>
            )}

            {checklistTotal > 0 && (
                <TaskProgressBar
                    completed={checklistCompleted}
                    total={checklistTotal}
                    className="mt-2.5 max-w-[24rem]"
                />
            )}

            {workSummary && workSummary.total_seconds > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                    <span className="flex items-center gap-1 text-[9px] font-bold text-[var(--text-muted)]">
                        <Timer className="h-3.5 w-3.5 text-accent" />
                        {formatHoursShort(workSummary.total_seconds)}
                    </span>
                    {workSummary.workers.map((worker) => (
                        <span
                            key={worker.user_id}
                            className="flex items-center gap-1 rounded-md border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent dark:text-accent"
                            title={`${worker.user_name}: ${formatHoursShort(worker.total_seconds)}`}
                        >
                            {worker.user_name.split(" ").map((name) => name[0]).join("").toUpperCase().slice(0, 2)} {formatHoursShort(worker.total_seconds)}
                            {worker.is_active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                        </span>
                    ))}
                </div>
            )}
        </>
    );
}
