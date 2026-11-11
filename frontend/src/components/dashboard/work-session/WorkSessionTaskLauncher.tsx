"use client";

import { useMemo, useState } from "react";
import { ArrowRight, MapPin, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDictionary } from "@/lib/dictionary-context";
import { isTaskDateOnlyValue, toTaskPlanningDateInput } from "@/domain/tasks/task-schedule";
import type { WorkSessionPanelProps } from "./work-session-panel-types";

type Props = Pick<WorkSessionPanelProps, "availableTasks" | "locations" | "onOpenTask"> & { disabled: boolean };

export function WorkSessionTaskLauncher({ availableTasks, locations, onOpenTask, disabled }: Props) {
    const { dict, locale } = useDictionary();
    const [selectedId, setSelectedId] = useState("");
    const selected = availableTasks.find(task => String(task.id) === selectedId) ?? availableTasks[0];
    const planningValue = selected?.scheduled_start_at || selected?.due_at;
    const plannedLabel = useMemo(() => {
        if (!planningValue) return null;
        const day = isTaskDateOnlyValue(planningValue) ? toTaskPlanningDateInput(planningValue) : null;
        const date = new Date(day ? `${day}T12:00:00.000Z` : planningValue);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    }, [locale, planningValue]);
    if (!selected) return <p className="text-sm leading-relaxed text-[var(--text-muted)]">{dict.work_sessions.widget_no_jobs}</p>;
    const location = locations.find(item => item.id === selected.location_id);
    return <div className="space-y-3">
        {availableTasks.length > 1 ? <div className="space-y-1.5">
            <Label htmlFor="shift-job">{dict.work_sessions.widget_job}</Label>
            <Select value={String(selected.id)} onValueChange={setSelectedId} disabled={disabled}>
                <SelectTrigger id="shift-job" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{availableTasks.map(task => <SelectItem key={task.id} value={String(task.id)}>{task.title}</SelectItem>)}</SelectContent>
            </Select>
        </div> : <div>
            <p className="text-xs font-semibold text-[var(--text-muted)]">{dict.work_sessions.widget_job}</p>
            <p className="mt-1 break-words text-sm font-semibold text-[var(--text-main)]">{selected.title}</p>
        </div>}
        {(location || plannedLabel) && <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
            {location && <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{location.name}</span></p>}
            {plannedLabel && <p className="flex items-center gap-1.5 whitespace-nowrap"><CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />{plannedLabel}</p>}
        </div>}
        <Button type="button" className="w-full" onClick={() => onOpenTask(selected)} disabled={disabled}>
            {dict.work_sessions.widget_open_job}<ArrowRight className="size-4" aria-hidden="true" />
        </Button>
    </div>;
}
