"use client";

import { startTransition, useState, useEffect, useEffectEvent, useRef } from "react"
import { WorkSessionService, WorkSession } from "@/services/work-session.service"
import { LocationService, Location } from "@/services/location.service"
import { TaskService } from "@/services/task.service"
import { TaskItem } from "@/types/user"
import { useUser } from "@/lib/user-context"
import { useDictionary } from "@/lib/dictionary-context"
import { toast } from "@/lib/toast"
import { getUserTaskStatus, isTaskAssignedToUser } from "@/lib/format"
import { getErrorMessage } from "@/lib/errors"
import { POLL_INTERVALS } from "@/lib/polling"
import { WorkSessionDesktopCard } from "./work-session/WorkSessionDesktopCard"
import { WorkSessionMobileBar } from "./work-session/WorkSessionMobileBar"
import { WorkSessionStopWarningDialog } from "./work-session/WorkSessionStopWarningDialog"
import { WorkSessionWidgetLoading } from "./work-session/WorkSessionWidgetLoading"
import { cleanWorkSessionLocalStorage, formatElapsedTimeFromStart } from "./work-session/work-session-utils"

interface WorkSessionWidgetProps {
    allowedLocations?: Location[];
}

function useWorkSessionWidget({ allowedLocations }: WorkSessionWidgetProps = {}) {
    const { dict } = useDictionary()
    const { user } = useUser()
    const [activeSession, setActiveSession] = useState<WorkSession | null>(null)
    const [fetchedLocations, setFetchedLocations] = useState<Location[]>([])
    const allLocations = allowedLocations ?? fetchedLocations
    const [availableTasks, setAvailableTasks] = useState<TaskItem[]>([])
    const [loading, setLoading] = useState<boolean>(true)
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

    const initSession = useEffectEvent(async () => {
        try {
            setLoading(true)
            const [session, baseLocs] = await Promise.all([
                WorkSessionService.getActiveSession(),
                allowedLocations ? Promise.resolve<Location[]>([]) : LocationService.getLocations()
            ])

            setActiveSession(session)
            void syncMonitoredTasks(session)
            if (!allowedLocations) {
                setFetchedLocations(baseLocs)
            }
        } catch (error) {
            console.error("Error loading work session initial data", error)
        } finally {
            setLoading(false)
        }
    })

    useEffect(() => {
        if (user) {
            startTransition(() => {
                void initSession()
            })
        }
    }, [user])

    useEffect(() => {
        let cancelled = false

        const refreshAvailableTasks = async () => {
            if (!user) return

            try {
                const userTasks = await TaskService.getTaskItems({
                    userId: user.id
                }).catch(() => [])
                const allowedLocationIds = new Set(allLocations.map(location => location.id))
                const nextTasks = userTasks.filter(task => {
                    const personalStatus = getUserTaskStatus(task, user.id)
                    return (
                        ["pending", "accepted", "progress"].includes(personalStatus)
                        && ["accepted", "progress", "review"].includes(task.status)
                        && isTaskAssignedToUser(task, user.id)
                        && allowedLocationIds.has(task.location_id)
                    )
                })

                if (!cancelled) setAvailableTasks(nextTasks)
            } catch (error) {
                console.error("Error refreshing available work assignments", error)
            }
        }

        if (user && !loading) {
            void refreshAvailableTasks()
            const intervalId = window.setInterval(refreshAvailableTasks, POLL_INTERVALS.tasks)
            window.addEventListener("workhive:tasks-changed", refreshAvailableTasks)
            return () => {
                cancelled = true
                window.clearInterval(intervalId)
                window.removeEventListener("workhive:tasks-changed", refreshAvailableTasks)
            }
        }

        return () => {
            cancelled = true
        }
    }, [user, allLocations, loading])

    const handleSessionChanged = useEffectEvent(async () => {
        try {
            const session = await WorkSessionService.getActiveSession()
            setActiveSession(session)
            void syncMonitoredTasks(session)
        } catch {
            setActiveSession(null)
            setMonitoredTaskIds([])
        }
    })

    useEffect(() => {
        const onSessionChanged = () => {
            void handleSessionChanged()
        }
        window.addEventListener("workhive:session-changed", onSessionChanged)
        return () => {
            window.removeEventListener("workhive:session-changed", onSessionChanged)
        }
    }, [])

    const checkCancelledTasks = useEffectEvent(async () => {
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
    })

    useEffect(() => {
        if (!activeSession || !user || monitoredTaskIds.length === 0) return

        const interval = setInterval(() => {
            void checkCancelledTasks()
        }, POLL_INTERVALS.notifications)
        return () => clearInterval(interval)
    }, [activeSession, user, monitoredTaskIds])

    useEffect(() => {
        if (activeSession) {
            const calculateElapsed = () => {
                setElapsedTime(formatElapsedTimeFromStart(activeSession.start_time))
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
            await WorkSessionService.stopSession()
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

    return {
        actionLoading,
        activeSession,
        allLocations,
        availableTasks,
        confirmStopShift,
        dict,
        elapsedTime,
        loading,
        pendingTasksCount,
        preStopShift,
        setShowStopWarning,
        showStopWarning,
        user,
    }
}

export function WorkSessionWidget({ allowedLocations }: WorkSessionWidgetProps = {}) {
    const controller = useWorkSessionWidget({ allowedLocations })

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
        pendingTasksCount,
        preStopShift,
        setShowStopWarning,
        showStopWarning,
        user,
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
                user={user}
                actionLoading={actionLoading}
                onPreStopShift={preStopShift}
            />

            <WorkSessionMobileBar
                dict={dict}
                activeSession={activeSession}
                activeLocationName={activeLocationName}
                elapsedTime={elapsedTime}
                availableTasks={availableTasks}
                user={user}
                actionLoading={actionLoading}
                onPreStopShift={preStopShift}
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
