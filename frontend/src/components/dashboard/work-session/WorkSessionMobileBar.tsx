"use client";

import { AlertCircle, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkSession } from "@/services/work-session.service";
import type { TaskItem, User } from "@/types/user";

interface WorkSessionMobileBarProps {
    dict: {
        work_sessions: {
            stop_shift: string;
            pause_shift: string;
            resume_shift: string;
            inactive_shift_mobile_desc?: string;
            viewer_no_pending_tasks?: string;
            no_accepted_tasks_warning?: string;
        };
        profile: {
            stats: {
                active_shift: string;
            };
        };
    };
    activeSession: WorkSession | null;
    activeLocationName: string;
    elapsedTime: string;
    availableTasks: TaskItem[];
    user: User | null;
    actionLoading: boolean;
    onPreStopShift: () => void;
    onTogglePause: () => void;
}

export function WorkSessionMobileBar({
    dict,
    activeSession,
    activeLocationName,
    elapsedTime,
    availableTasks,
    user,
    actionLoading,
    onPreStopShift,
    onTogglePause,
}: WorkSessionMobileBarProps) {
    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-card)]/95 backdrop-blur-md border-t border-[var(--border-soft)] p-4 z-50 flex flex-col gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] pb-[calc(1rem+env(safe-area-inset-bottom))] w-full">
            {activeSession ? (
                <div className="flex items-center justify-between gap-3 w-full">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0"></span>
                            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-extrabold truncate">
                                {activeLocationName || dict.profile.stats.active_shift}
                            </p>
                        </div>
                        <p className="text-xl font-mono font-black tracking-tight text-[var(--text-main)] mt-0.5">
                            {elapsedTime}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={onTogglePause}
                            disabled={actionLoading}
                            aria-label={activeSession.paused_at
                                ? dict.work_sessions.resume_shift
                                : dict.work_sessions.pause_shift}
                        >
                            <PauseCircle className="size-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={onPreStopShift}
                            disabled={actionLoading}
                            className="px-4"
                        >
                            {actionLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                dict.work_sessions.stop_shift
                            )}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="w-full">
                    <div className="flex items-center justify-between gap-3 w-full bg-[var(--bg-primary)] p-2.5 rounded-xl border border-[var(--border-soft)]">
                        <div className="flex items-start gap-1.5 min-w-0">
                            {availableTasks.length > 0 ? (
                                <PlayCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                            )}
                            <p className="text-[10px] text-[var(--text-muted)] font-bold leading-relaxed line-clamp-2 text-left">
                                {availableTasks.length > 0
                                    ? (dict.work_sessions?.inactive_shift_mobile_desc || "Open a task and press Start shift.")
                                    : (user?.role?.name === "viewer"
                                        ? (dict.work_sessions?.viewer_no_pending_tasks || "You have no pending tasks assigned.")
                                        : (dict.work_sessions.no_accepted_tasks_warning || "Open an accepted task and start the shift to begin the timer."))}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
