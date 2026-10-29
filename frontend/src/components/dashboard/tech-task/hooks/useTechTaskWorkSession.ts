"use client";

import { startTransition, useState, useEffect, useCallback } from "react";
import { WorkSession, WorkerTimeSummary } from "@/types/user";
import { WorkSessionService } from "@/services/work-session.service";
import { TaskService } from "@/services/task.service";
import { toast } from "@/lib/toast";
import {
    getCurrentWorkEndLocation,
    getCurrentWorkStartLocation,
} from "@/lib/work-start-location";
import type { Dictionary } from "@/lib/dictionary-context";
import { POLL_INTERVALS } from "@/lib/polling";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";

interface UseTechTaskWorkSessionParams {
    taskId: number;
    dict: Dictionary;
    onAssignmentChanged: () => void;
}

interface UseTechTaskWorkSessionReturn {
    taskWorkSeconds: number;
    activeWorkers: number;
    workers: WorkerTimeSummary[];
    activeSession: WorkSession | null;
    personalElapsedSeconds: number;
    isCurrentTaskSessionActive: boolean;
    hasAnotherActiveSession: boolean;
    updatingStatus: boolean;
    refreshActiveSession: () => Promise<void>;
    handleStartWork: () => Promise<void>;
    handleFinishWork: (options: {
        ownTotalCount: number;
        ownCompletedCount: number;
        onBack: () => void;
        onStatusUpdate: () => void;
    }) => Promise<void>;
}

export function useTechTaskWorkSession({
    taskId,
    dict,
    onAssignmentChanged,
}: UseTechTaskWorkSessionParams): UseTechTaskWorkSessionReturn {
    const [taskWorkSeconds, setTaskWorkSeconds] = useState(0);
    const [activeWorkers, setActiveWorkers] = useState(0);
    const [workers, setWorkers] = useState<WorkerTimeSummary[]>([]);
    const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const loadWorkSummary = useCallback(async () => {
        try {
            const summary = await WorkSessionService.getTaskDetailedSummary(taskId);
            setTaskWorkSeconds(summary.total_seconds);
            setActiveWorkers(summary.active_workers);
            setWorkers(summary.workers);
        } catch {
            setTaskWorkSeconds(0);
            setActiveWorkers(0);
            setWorkers([]);
        }
    }, [taskId]);

    useEffect(() => {
        startTransition(() => {
            void loadWorkSummary();
        });
    }, [loadWorkSummary]);
    useBackgroundPolling(
        loadWorkSummary,
        POLL_INTERVALS.liveWork,
        POLL_INTERVALS.realtimeSafety,
    );

    // Active session management
    const refreshActiveSession = useCallback(async () => {
        try {
            setActiveSession(await WorkSessionService.getActiveSession());
        } catch {
            setActiveSession(null);
        }
    }, []);

    useRealtimeInvalidation(["live-work", "tasks"], () => {
        void loadWorkSummary();
        void refreshActiveSession();
    });

    useEffect(() => {
        startTransition(() => {
            void refreshActiveSession();
        });
        const handleSessionChanged = () => void refreshActiveSession();
        window.addEventListener("workhive:session-changed", handleSessionChanged);
        return () => {
            window.removeEventListener("workhive:session-changed", handleSessionChanged);
        };
    }, [refreshActiveSession]);

    const isCurrentTaskSessionActive = activeSession?.task_item_id === taskId;
    const personalElapsedSeconds = isCurrentTaskSessionActive && activeSession
        ? Math.max(0,
            Math.floor((nowMs - new Date(activeSession.start_time).getTime()) / 1000)
            - (activeSession.paused_seconds ?? 0)
            - (activeSession.paused_at
                ? Math.max(0, Math.floor((nowMs - new Date(activeSession.paused_at).getTime()) / 1000))
                : 0)
        )
        : 0;
    const hasAnotherActiveSession = Boolean(
        activeSession && activeSession.task_item_id !== taskId
    );

    // Personal elapsed time ticker (1s interval when session is active for this task)
    useEffect(() => {
        if (!isCurrentTaskSessionActive) return;
        const interval = window.setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
        return () => window.clearInterval(interval);
    }, [isCurrentTaskSessionActive]);

    const handleStartWork = async () => {
        try {
            setUpdatingStatus(true);
            let startLocation;
            try {
                startLocation = await getCurrentWorkStartLocation();
            } catch {
                toast.error(
                    dict.work_sessions?.location_required
                    || "Debes permitir la ubicación para iniciar el fichaje."
                );
                return;
            }
            await TaskService.startTaskWork(taskId, startLocation);
            await refreshActiveSession();
            window.dispatchEvent(new CustomEvent("workhive:session-changed"));
            toast.success(dict.tech.toast_work_started);
        } catch (error: unknown) {
            const rawMessage = error instanceof Error
                ? error.message
                : dict.tech.toast_work_start_error;
            const assignmentChanged = rawMessage === "You can only start work assigned to you";
            const msg = assignmentChanged
                ? (
                    dict.tech.toast_work_not_assigned
                    || "Esta tarea ya no está asignada a tu usuario. Actualiza la tarea o contacta con un administrador."
                )
                : rawMessage;
            if (!assignmentChanged) {
                console.error("Error starting task", error);
            }
            toast.error(msg);
            if (assignmentChanged) {
                onAssignmentChanged();
            }
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleFinishWork = async ({
        ownTotalCount,
        ownCompletedCount,
        onBack,
        onStatusUpdate,
    }: {
        ownTotalCount: number;
        ownCompletedCount: number;
        onBack: () => void;
        onStatusUpdate: () => void;
    }) => {
        if (ownTotalCount > 0 && ownCompletedCount < ownTotalCount) {
            toast.error(
                dict.tech.toast_pending_requirements.replace(
                    "{count}",
                    String(ownTotalCount - ownCompletedCount)
                )
            );
            return;
        }

        try {
            setUpdatingStatus(true);
            let endLocation;
            try {
                endLocation = await getCurrentWorkEndLocation();
            } catch {
                // GPS is optional when finishing work.
            }
            await TaskService.finishTaskWork(taskId, endLocation);
            setActiveSession(null);
            window.dispatchEvent(new CustomEvent("workhive:session-changed"));
            toast.success(dict.tech.toast_work_completed);
            onStatusUpdate();
            onBack();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : dict.tech.toast_work_complete_error;
            console.error("Error completing task", error);
            toast.error(msg);
        } finally {
            setUpdatingStatus(false);
        }
    };

    return {
        taskWorkSeconds,
        activeWorkers,
        workers,
        activeSession,
        personalElapsedSeconds,
        isCurrentTaskSessionActive,
        hasAnotherActiveSession,
        updatingStatus,
        refreshActiveSession,
        handleStartWork,
        handleFinishWork,
    };
}
