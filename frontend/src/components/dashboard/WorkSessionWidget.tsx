"use client";

import { startTransition, useState, useEffect, useEffectEvent, useRef, useCallback, useMemo } from "react"
import { WorkSessionService, WorkSession } from "@/services/work-session.service"
import { Location } from "@/services/location.service"
import { TaskService } from "@/services/task.service"
import { TaskItem } from "@/types/user"
import { useUser } from "@/lib/user-context"
import { useDictionary } from "@/lib/dictionary-context"
import { toast } from "@/lib/toast"
import { getUserTaskStatus, isTaskAssignedToUser } from "@/lib/format"
import { getErrorMessage } from "@/lib/errors"
import { POLL_INTERVALS } from "@/lib/polling"
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling"
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents"
import { WorkSessionDesktopCard } from "./work-session/WorkSessionDesktopCard"
import { WorkSessionMobileBar } from "./work-session/WorkSessionMobileBar"
import { WorkSessionStopWarningDialog } from "./work-session/WorkSessionStopWarningDialog"
import { WorkSessionWidgetLoading } from "./work-session/WorkSessionWidgetLoading"
import { cleanWorkSessionLocalStorage, formatElapsedTimeFromStart } from "./work-session/work-session-utils"
import { useActiveWorkSession } from "./work-session/useActiveWorkSession"
import { getTaskScheduleDate } from "@/domain/tasks/task-schedule"
import { getCurrentWorkEndLocation } from "@/lib/work-start-location"

interface WorkSessionWidgetProps {
    allowedLocations: Location[];
    allowedTasks: TaskItem[];
    onOpenTask: (task: TaskItem) => void;
}

function useWorkSessionWidget({ allowedLocations, allowedTasks, onOpenTask }: WorkSessionWidgetProps) {
    const { dict } = useDictionary()
    const { user } = useUser()
    const { activeSession, setActiveSession, loading, sessionFailed, refreshSession } = useActiveWorkSession(user)
    const allLocations = allowedLocations
    const availableTasks = useMemo(() => {
        if (!user) return []
        const locationIds = new Set(allLocations.map(location => location.id))
        return allowedTasks.filter(task => ["pending", "accepted", "progress"].includes(getUserTaskStatus(task, user.id))
            && ["accepted", "progress", "review"].includes(task.status)
            && isTaskAssignedToUser(task, user.id) && locationIds.has(task.location_id))
            .sort((a, b) => {
                const date = (task: TaskItem) => task.scheduled_start_at || task.due_at ? getTaskScheduleDate(task)?.getTime() ?? Infinity : Infinity
                return date(a) - date(b) || a.id - b.id
            })
    }, [allLocations, allowedTasks, user])
    const [actionLoading, setActionLoading] = useState<boolean>(false)
    const [elapsedTime, setElapsedTime] = useState<string>("00:00:00")

    const [showStopWarning, setShowStopWarning] = useState<boolean>(false)
    const [pendingTasksCount, setPendingTasksCount] = useState<number>(0)

    const [monitoredTaskIds, setMonitoredTaskIds] = useState<number[]>([])

    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const syncMonitoredTasks = useEffectEvent(async (session: WorkSession | null) => {
        if (!session || !user) {
            setMonitoredTaskIds([])
            return
        }
        const key = `workhive_monitored_tasks_${user.id}_${session.id}`
        const stored = localStorage.getItem(key)
        if (stored) {
            try {
                setMonitoredTaskIds(JSON.parse(stored))
            } catch {
                setMonitoredTaskIds([])
            }
        } else {
            if (session.task_item_id) {
                const ids = [session.task_item_id]
                localStorage.setItem(key, JSON.stringify(ids))
                setMonitoredTaskIds(ids)
                return
            }
            try {
                const userTasks = await TaskService.getTaskItems({ userId: user.id }).catch(() => [])
                const activeTasks = userTasks.filter(t =>
                    t.location_id === session.location_id &&
                    t.status !== "cancelled" &&
                    isTaskAssignedToUser(t, user.id)
                )
                const ids = activeTasks.map(t => t.id)
                localStorage.setItem(key, JSON.stringify(ids))
                setMonitoredTaskIds(ids)
            } catch (err) {
                console.error("Error initializing monitored tasks", err)
            }
        }
    })

    useEffect(() => { startTransition(() => { void syncMonitoredTasks(activeSession) }) }, [activeSession])
    useEffect(() => {
        const onSessionChanged = () => { void refreshSession() }
        window.addEventListener("workhive:session-changed", onSessionChanged)
        return () => window.removeEventListener("workhive:session-changed", onSessionChanged)
    }, [refreshSession])
    useBackgroundPolling(refreshSession, POLL_INTERVALS.tasks, POLL_INTERVALS.realtimeSafety)
    useRealtimeInvalidation(["tasks", "live-work"], () => { void refreshSession() })

    const checkCancelledTasks = useCallback(async () => {
        if (!activeSession || !user) return
        try {
            const userTasks = await TaskService.getTaskItems({ userId: user.id }).catch(() => [])
            const monitoredSet = new Set(monitoredTaskIds)

            const cancelledTask = userTasks.find(t =>
                monitoredSet.has(t.id) && t.status === "cancelled"
            )

            if (cancelledTask) {
                toast.error(
                    dict.work_sessions?.toast_task_cancelled
                        ? dict.work_sessions.toast_task_cancelled.replace("{title}", cancelledTask.title)
                        : `The shift has stopped because the task "${cancelledTask.title}" has been cancelled.`
                )
                setActionLoading(true)
                const sessionId = activeSession.id
                try {
                    await WorkSessionService.stopSession()
                    cleanWorkSessionLocalStorage(user.id, sessionId)
                    setActiveSession(null)
                    setMonitoredTaskIds([])
                    window.dispatchEvent(new CustomEvent("workhive:session-changed"))
                } finally {
                    setActionLoading(false)
                }
            }
        } catch (error) {
            console.error("Error polling for cancelled tasks", error)
        }
    }, [activeSession, dict.work_sessions, monitoredTaskIds, setActiveSession, user])

    useBackgroundPolling(
        checkCancelledTasks,
        POLL_INTERVALS.notifications,
        POLL_INTERVALS.realtimeSafety,
    )
    useRealtimeInvalidation(["tasks"], () => {
        void checkCancelledTasks()
    })

    useEffect(() => {
        if (activeSession) {
            const calculateElapsed = () => {
                setElapsedTime(formatElapsedTimeFromStart(
                    activeSession.start_time,
                    activeSession.paused_at,
                    activeSession.paused_seconds,
                ))
            }

            startTransition(calculateElapsed)
            timerRef.current = setInterval(calculateElapsed, 1000)
        } else {
            startTransition(() => setElapsedTime("00:00:00"))
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [activeSession])

    const handleStopShift = async () => {
        if (!activeSession || !user) return
        try {
            setActionLoading(true)
            const sessionId = activeSession.id
            let endLocation
            try {
                endLocation = await getCurrentWorkEndLocation()
            } catch {
                // GPS is optional when finishing a shift.
            }
            await WorkSessionService.stopSession(endLocation)
            cleanWorkSessionLocalStorage(user.id, sessionId)
            setActiveSession(null)
            setMonitoredTaskIds([])
            window.dispatchEvent(new CustomEvent("workhive:session-changed"))
            toast.success(dict.work_sessions.success_stop)
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.work_sessions.error_stop))
        } finally {
            setActionLoading(false)
        }
    }

    const preStopShift = async () => {
        if (!activeSession || !user) return
        try {
            setActionLoading(true)
            const locationTasks = await TaskService.getTaskItems({
                userId: user.id,
                locationId: activeSession.location_id
            }).catch(() => [])

            const pending = locationTasks.filter(t => {
                const status = getUserTaskStatus(t, user.id);
                return status === "pending" || status === "accepted" || status === "progress";
            });

            if (pending.length > 0) {
                setPendingTasksCount(pending.length)
                setShowStopWarning(true)
            } else {
                await handleStopShift()
            }
        } catch (error) {
            console.error("Error pre-stopping shift", error)
            await handleStopShift()
        } finally {
            setActionLoading(false)
        }
    }

    const confirmStopShift = async () => {
        setShowStopWarning(false)
        await handleStopShift()
    }

    const togglePause = async () => {
        if (!activeSession) return
        try {
            setActionLoading(true)
            const updatedSession = activeSession.paused_at
                ? await WorkSessionService.resumeSession()
                : await WorkSessionService.pauseSession()
            setActiveSession(updatedSession)
            window.dispatchEvent(new CustomEvent("workhive:session-changed"))
            toast.success(
                activeSession.paused_at
                    ? (dict.work_sessions.success_resume || "Jornada reanudada")
                    : (dict.work_sessions.success_pause || "Jornada pausada")
            )
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.work_sessions.error_stop))
        } finally {
            setActionLoading(false)
        }
    }

    return {
        actionLoading,
        activeSession,
        allLocations,
        availableTasks,
        confirmStopShift,
        dict,
        elapsedTime,
        loading,
        onOpenTask,
        sessionFailed,
        refreshSession,
        pendingTasksCount,
        preStopShift,
        setShowStopWarning,
        showStopWarning,
        togglePause,
        user,
    }
}

export function WorkSessionWidget(props: WorkSessionWidgetProps) {
    const controller = useWorkSessionWidget(props)

    if (controller.loading) {
        return <WorkSessionWidgetLoading loadingLabel={controller.dict.dashboard.loading || "Loading..."} />
    }

    return <WorkSessionWidgetContent controller={controller} />
}

function WorkSessionWidgetContent({
    controller,
}: {
    controller: ReturnType<typeof useWorkSessionWidget>
}) {
    const {
        actionLoading,
        activeSession,
        allLocations,
        availableTasks,
        confirmStopShift,
        dict,
        elapsedTime,
        onOpenTask,
        sessionFailed,
        refreshSession,
        pendingTasksCount,
        preStopShift,
        setShowStopWarning,
        showStopWarning,
        togglePause,
    } = controller

    const activeLocationName = activeSession
        ? allLocations.find((l) => l.id === activeSession.location_id)?.name || `ID: ${activeSession.location_id}`
        : ""
    const activeTaskTitle = activeSession?.task_item_id
        ? availableTasks.find(task => task.id === activeSession.task_item_id)?.title
        : ""

    return (
        <>
            <WorkSessionDesktopCard
                dict={dict}
                activeSession={activeSession}
                activeLocationName={activeLocationName}
                activeTaskTitle={activeTaskTitle}
                elapsedTime={elapsedTime}
                availableTasks={availableTasks}
                locations={allLocations}
                onOpenTask={onOpenTask}
                sessionFailed={sessionFailed}
                onRetry={() => void refreshSession()}
                actionLoading={actionLoading}
                onPreStopShift={preStopShift}
                onTogglePause={togglePause}
            />

            <WorkSessionMobileBar
                dict={dict}
                activeSession={activeSession}
                activeLocationName={activeLocationName}
                elapsedTime={elapsedTime}
                availableTasks={availableTasks}
                locations={allLocations}
                onOpenTask={onOpenTask}
                sessionFailed={sessionFailed}
                onRetry={() => void refreshSession()}
                actionLoading={actionLoading}
                onPreStopShift={preStopShift}
                onTogglePause={togglePause}
            />

            <WorkSessionStopWarningDialog
                open={showStopWarning}
                onOpenChange={setShowStopWarning}
                pendingTasksCount={pendingTasksCount}
                dict={dict}
                onConfirmStop={confirmStopShift}
            />
        </>
    )
}
