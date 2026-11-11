"use client";

import { PauseCircle, PlayCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkSessionPanelProps } from "./work-session-panel-types";

export function WorkSessionMobileBar({
    dict, activeSession, activeLocationName, elapsedTime, availableTasks, actionLoading,
    sessionFailed, onOpenTask, onRetry, onPreStopShift, onTogglePause,
}: WorkSessionPanelProps) {
    const copy = dict.work_sessions;
    const nextTask = availableTasks[0];
    if (!activeSession && !nextTask && !sessionFailed) return null;
    const disabled = actionLoading || sessionFailed;
    return <section aria-label={copy.widget_title} className="fixed inset-x-0 bottom-0 z-50 flex w-full flex-col gap-2 border-t border-[var(--border-soft)] bg-[var(--bg-card)]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md md:hidden">
        {sessionFailed && <div role="alert" className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <p className="min-w-0 flex-1">{copy.widget_read_error}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>{copy.widget_retry}</Button>
        </div>}
        {activeSession ? <div className="flex w-full items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[var(--text-muted)]">{activeSession.paused_at ? copy.paused : activeLocationName || copy.widget_title}</p>
                <p role="timer" aria-live="off" className="font-mono text-xl font-bold tabular-nums text-[var(--text-main)]">{elapsedTime}</p>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={onTogglePause} disabled={disabled} aria-label={activeSession.paused_at ? copy.resume_shift : copy.pause_shift}>
                {activeSession.paused_at ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
            </Button>
            <Button type="button" variant="destructive" onClick={onPreStopShift} disabled={disabled}>{copy.stop_shift}</Button>
        </div> : nextTask ? <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--text-muted)]">{copy.widget_title} · {copy.widget_idle}</p>
                <p className="truncate text-sm font-semibold text-[var(--text-main)]">{nextTask.title}</p>
            </div>
            <Button type="button" onClick={() => onOpenTask(nextTask)} disabled={disabled}>{copy.widget_open_job}<ArrowRight className="size-4" aria-hidden="true" /></Button>
        </div> : null}
    </section>;
}
