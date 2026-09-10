"use client";

import { Clock, AlertCircle, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkSession } from "@/services/work-session.service";
import type { TaskItem } from "@/types/user";
import type { User } from "@/types/user";

interface WorkSessionDesktopCardProps {
    dict: {
        work_sessions: {
            title: string;
            elapsed_time: string;
            stop_shift: string;
            pause_shift: string;
            resume_shift: string;
            paused?: string;
            inactive_shift_timer_desc?: string;
            viewer_no_pending_tasks?: string;
            no_accepted_tasks_warning?: string;
            no_active_shift?: string;
        };
        profile: {
            stats: {
                active_shift: string;
                active_location: string;
            };
        };
    };
    activeSession: WorkSession | null;
    activeLocationName: string;
    activeTaskTitle?: string;
    elapsedTime: string;
    availableTasks: TaskItem[];
    user: User | null;
    actionLoading: boolean;
    onPreStopShift: () => void;
    onTogglePause: () => void;
}

export function WorkSessionDesktopCard({
    dict,
    activeSession,
    activeLocationName,
    activeTaskTitle,
    elapsedTime,
    availableTasks,
    user,
    actionLoading,
    onPreStopShift,
    onTogglePause,
}: WorkSessionDesktopCardProps) {
    return (
        <div className="hidden md:flex flex-col bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow justify-between min-h-[220px] w-full">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[var(--text-main)] flex items-center gap-2">
                        <Clock className="w-4.5 h-4.5 text-accent" /> {dict.work_sessions.title}
                    </h3>
                    {activeSession && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                            <span className={`w-2 h-2 rounded-full bg-accent ${activeSession.paused_at ? "" : "animate-pulse"}`}></span>
                            {activeSession.paused_at
                                ? (dict.work_sessions.paused || "Jornada pausada")
                                : dict.profile.stats.active_shift}
                        </span>
                    )}
                </div>

                {activeSession ? (
                    <div className="space-y-4">
                        <div>
                            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold">
                                {dict.profile.stats.active_location}
                            </p>
                            <p className="text-[var(--text-main)] font-medium text-sm mt-0.5">
                                {activeLocationName}
                            </p>
                            {activeTaskTitle && (
                                <p className="mt-1 text-xs font-bold text-accent dark:text-accent">
                                    {activeTaskTitle}
                                </p>
                            )}
                            {activeSession.notes && (
                                <p className="text-[var(--text-muted)] text-xs italic mt-1 bg-[var(--bg-primary)] p-2 rounded-lg border border-[var(--border-soft)]">
                                    &ldquo;{activeSession.notes}&rdquo;
                                </p>
                            )}
                        </div>

                        <div>
                            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold">
                                {dict.work_sessions.elapsed_time}
                            </p>
                            <p className="text-3xl font-mono font-bold tracking-tight text-[var(--text-main)] mt-1">
                                {elapsedTime}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-[var(--text-muted)] py-4 bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-soft)] flex items-start gap-2">
                        {availableTasks.length > 0 ? (
                            <PlayCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        )}
                        <span>
                            {availableTasks.length > 0
                                ? (dict.work_sessions?.inactive_shift_timer_desc || "Open a task and press Start shift and work to activate the timer.")
                                : (user?.role?.name === "viewer"
                                    ? (dict.work_sessions?.viewer_no_pending_tasks || "You have no pending tasks assigned.")
                                    : (dict.work_sessions.no_accepted_tasks_warning || "Open an accepted task and start the shift to begin the timer."))}
                        </span>
                    </div>
                )}
            </div>

            <div className="mt-6">
                {activeSession ? (
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onTogglePause}
                            disabled={actionLoading}
                            className="flex-1"
                        >
                            <PauseCircle className="size-4" />
                            {activeSession.paused_at
                                ? dict.work_sessions.resume_shift
                                : dict.work_sessions.pause_shift}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={onPreStopShift}
                            disabled={actionLoading}
                            className="flex-1"
                        >
                            {actionLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                dict.work_sessions.stop_shift
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] text-center">
                        {dict.work_sessions?.no_active_shift || "No active shift"}
                    </div>
                )}
            </div>
        </div>
    );
}
