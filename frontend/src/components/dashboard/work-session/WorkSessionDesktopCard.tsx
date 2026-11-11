"use client";

import { Clock, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkSessionTaskLauncher } from "./WorkSessionTaskLauncher";
import type { WorkSessionPanelProps } from "./work-session-panel-types";

export function WorkSessionDesktopCard({
    dict, activeSession, activeLocationName, activeTaskTitle, elapsedTime,
    availableTasks, locations, actionLoading, sessionFailed, onOpenTask, onRetry, onPreStopShift, onTogglePause,
}: WorkSessionPanelProps) {
    const copy = dict.work_sessions;
    const disabled = actionLoading || sessionFailed;
    return <section aria-label={copy.widget_title} className="hidden w-full min-w-0 flex-col gap-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 shadow-sm md:flex">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]"><Clock className="size-4 text-accent" aria-hidden="true" />{copy.widget_title}</h3>
            <Badge variant="outline" className="border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                {sessionFailed ? copy.widget_connection : activeSession ? activeSession.paused_at ? copy.paused : dict.profile.stats.active_shift : copy.widget_idle}
            </Badge>
        </div>
        {sessionFailed && <div role="alert" className="space-y-2 text-xs text-[var(--text-muted)]">
            <p>{copy.widget_read_error}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>{copy.widget_retry}</Button>
        </div>}
        {activeSession ? <>
            <div className="space-y-1">
                <p className="break-words text-sm font-semibold text-[var(--text-main)]">{activeTaskTitle || activeLocationName}</p>
                {activeTaskTitle && <p className="break-words text-xs text-[var(--text-muted)]">{activeLocationName}</p>}
                {activeSession.notes && <p className="break-words text-xs text-[var(--text-muted)]">{activeSession.notes}</p>}
            </div>
            <div>
                <p className="text-xs text-[var(--text-muted)]">{copy.elapsed_time}</p>
                <p role="timer" aria-live="off" className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight text-[var(--text-main)]">{elapsedTime}</p>
            </div>
            <div className="grid gap-2">
                <Button type="button" variant="outline" onClick={onTogglePause} disabled={disabled}>
                    {activeSession.paused_at ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
                    {activeSession.paused_at ? copy.resume_shift : copy.pause_shift}
                </Button>
                <Button type="button" variant="destructive" onClick={onPreStopShift} disabled={disabled}>{copy.stop_shift}</Button>
            </div>
        </> : <>
            <WorkSessionTaskLauncher availableTasks={availableTasks} locations={locations} onOpenTask={onOpenTask} disabled={disabled} />
            {availableTasks.length > 0 && <p className="border-t border-[var(--border-soft)] pt-3 text-xs leading-relaxed text-[var(--text-muted)]">{copy.widget_idle_hint}</p>}
        </>}
    </section>;
}
