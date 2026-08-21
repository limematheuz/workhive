"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type {
    EventClickArg,
    EventDropArg,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { CloudOff, ShieldAlert } from "lucide-react";

import { getTaskCalendarRange } from "@/lib/company-calendar";
import { useDictionary } from "@/lib/dictionary-context";
import { isTaskAssignedToUser } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Location } from "@/types/location";
import { TaskItem, User } from "@/types/user";
import { TaskService } from "@/services/task.service";
import { CalendarTaskDetailDialog } from "./CalendarTaskDetailDialog";
import {
    canManageCompanyCalendar,
    canViewCompanyCalendar,
} from "@/domain/access/roles";
import {
    isOperationalStatus,
    toKanbanStatus,
} from "@/domain/tasks/task-status";
import { useGoogleCalendarConnection } from "./useGoogleCalendarConnection";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarUnscheduledSection } from "./CalendarUnscheduledSection";
import { CalendarBoard } from "./CalendarBoard";
import { buildCalendarEvents, resolveTaskWorkerNames } from "./buildCalendarEvents";
import { isTaskPlanningDateBeforeToday } from "@/domain/tasks/task-schedule";
import { acknowledgeTaskOpened } from "@/components/dashboard/notifications/task-notification-acknowledgement";

interface CompanyCalendarProps {
    tasks: TaskItem[];
    locations: Location[];
    users: User[];
    currentUser: User | null;
    onTasksChanged: () => Promise<void> | void;
}

export function CompanyCalendar({
    tasks,
    locations,
    users,
    currentUser,
    onTasksChanged,
}: CompanyCalendarProps) {
    const calendarRef = useRef<FullCalendar | null>(null);
    const { dict, locale } = useDictionary();
    const calendarDict = dict.calendar;
    const canView = canViewCompanyCalendar(currentUser);
    const canEdit = canManageCompanyCalendar(currentUser);
    const [calendarTitle, setCalendarTitle] = useState("");
    const [calendarView, setCalendarView] = useState("timeGridWeek");
    const [locationFilter, setLocationFilter] = useState("");
    const [userFilter, setUserFilter] = useState("");
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
    const dateLocale = locale === "es" ? "es-ES" : "en-US";
    const googleCalendar = useGoogleCalendarConnection({
        canLoadStatus: canView,
        onTasksChanged,
        messages: {
            connectedSuccess: calendarDict.connected_success,
            connectionError: calendarDict.connection_error,
            connectionAccessDenied: calendarDict.connection_access_denied,
            connectionConfigurationError: calendarDict.connection_configuration_error,
            disconnectedSuccess: calendarDict.disconnected_success,
            disconnectError: calendarDict.disconnect_error,
            syncError: calendarDict.sync_error,
            syncSuccess: calendarDict.sync_success,
            unconfigured: "Google Calendar no está configurado en el backend.",
            ownershipRequested: calendarDict.ownership_requested,
            ownershipRequestError: calendarDict.ownership_request_error,
            ownershipApproved: calendarDict.ownership_approved,
            ownershipRejected: calendarDict.ownership_rejected,
        },
    });

    useEffect(() => {
        const media = window.matchMedia("(max-width: 767px)");
        const applyView = () => setCalendarView(media.matches ? "timeGridDay" : "timeGridWeek");
        applyView();
        media.addEventListener("change", applyView);
        return () => media.removeEventListener("change", applyView);
    }, []);

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            const calendarApi = calendarRef.current?.getApi();
            if (calendarApi && calendarApi.view.type !== calendarView) {
                calendarApi.changeView(calendarView);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [calendarView]);

    const filteredTasks = useMemo(
        () => tasks.filter((task) => {
            if (locationFilter && task.location_id !== Number(locationFilter)) return false;
            if (userFilter && !isTaskAssignedToUser(task, Number(userFilter))) return false;
            return isOperationalStatus(task.status);
        }),
        [locationFilter, tasks, userFilter],
    );

    const locationName = useCallback((id: number) => (
        locations.find((location) => location.id === id)?.name || ""
    ), [locations]);
    const userName = useCallback((id: number | null | undefined) => {
        const user = users.find((candidate) => candidate.id === id);
        return user?.full_name || user?.email || calendarDict.unassigned;
    }, [calendarDict.unassigned, users]);
    const taskWorkerNames = useCallback((task: TaskItem) => (
        resolveTaskWorkerNames(task, userName, calendarDict.unassigned)
    ), [calendarDict.unassigned, userName]);

    const calendarEvents = useMemo(
        () => buildCalendarEvents(
            filteredTasks,
            currentUser?.company_id,
            locationName,
            taskWorkerNames,
        ),
        [currentUser?.company_id, filteredTasks, locationName, taskWorkerNames],
    );

    const unscheduledTasks = filteredTasks.filter((task) => (
        !getTaskCalendarRange(task)
        && ["pending", "progress"].includes(toKanbanStatus(task.status))
    ));
    const selectedTask = selectedTaskId
        ? tasks.find((task) => task.id === selectedTaskId) || null
        : null;
    const selectedRange = selectedTask ? getTaskCalendarRange(selectedTask) : null;

    const navigate = (action: "prev" | "next" | "today") => {
        const api = calendarRef.current?.getApi();
        if (!api) return;
        api[action]();
        setCalendarTitle(api.view.title);
    };

    const persistEventTime = async (
        event: EventDropArg["event"],
        revert: () => void,
    ) => {
        const taskId = Number(event.id);
        const start = event.start;
        if (!taskId || !start) {
            revert();
            return;
        }
        if (isTaskPlanningDateBeforeToday(start)) {
            revert();
            toast.error("La fecha de planificación no puede ser anterior a hoy");
            return;
        }
        const end = event.end || new Date(start.getTime() + 60 * 60 * 1000);
        try {
            await TaskService.updateTaskItem(taskId, {
                scheduled_start_at: start.toISOString(),
                due_at: end.toISOString(),
            });
            toast.success(calendarDict.task_rescheduled);
            await onTasksChanged();
            await googleCalendar.loadStatus();
        } catch (error) {
            revert();
            toast.error(error instanceof Error ? error.message : calendarDict.reschedule_error);
        }
    };

    const handleEventClick = (eventInfo: EventClickArg) => {
        eventInfo.jsEvent.preventDefault();
        const taskId = Number(eventInfo.event.id);
        const task = tasks.find((item) => item.id === taskId);
        if (task && currentUser) acknowledgeTaskOpened(currentUser.id, task);
        setSelectedTaskId(taskId);
    };

    if (!canView) {
        return (
            <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center shadow-sm">
                <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
                <h2 className="mt-3 text-lg font-black text-[var(--text-main)]">{calendarDict.restricted_title}</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{calendarDict.restricted_body}</p>
            </section>
        );
    }

    return (
        <div className="space-y-5">
            <CalendarHeader
                calendarDict={calendarDict}
                status={googleCalendar.status}
                loading={googleCalendar.loading}
                connecting={googleCalendar.connecting}
                syncing={googleCalendar.syncing}
                disconnecting={googleCalendar.disconnecting}
                requestingOwnership={googleCalendar.requestingOwnership}
                reviewingRequestId={googleCalendar.reviewingRequestId}
                lastError={googleCalendar.status?.last_error}
                onConnect={googleCalendar.connect}
                onSync={googleCalendar.sync}
                onDisconnectRequest={() => setDisconnectDialogOpen(true)}
                onRequestOwnership={() => { void googleCalendar.requestOwnership(); }}
                onReviewOwnership={(requestId, decision) => {
                    void googleCalendar.reviewOwnership(requestId, decision);
                }}
            />

            <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 shadow-sm md:p-5">
                <CalendarToolbar
                    calendarDict={calendarDict}
                    calendarTitle={calendarTitle}
                    locationFilter={locationFilter}
                    userFilter={userFilter}
                    locations={locations}
                    users={users}
                    onNavigate={navigate}
                    onLocationFilterChange={setLocationFilter}
                    onUserFilterChange={setUserFilter}
                />
                <CalendarBoard
                    calendarRef={calendarRef}
                    calendarView={calendarView}
                    locale={locale}
                    canEdit={canEdit}
                    events={calendarEvents}
                    onDatesSet={(arg) => setCalendarTitle(arg.view.title)}
                    onEventClick={handleEventClick}
                    onEventDrop={(arg) => {
                        if (!canEdit) return arg.revert();
                        void persistEventTime(arg.event, arg.revert);
                    }}
                    onEventResize={(arg: EventResizeDoneArg) => {
                        if (!canEdit) return arg.revert();
                        void persistEventTime(arg.event, arg.revert);
                    }}
                />
            </section>

            <CalendarUnscheduledSection
                calendarDict={calendarDict}
                tasks={unscheduledTasks}
                locationName={locationName}
                userName={userName}
            />

            <CalendarTaskDetailDialog
                calendarDict={calendarDict}
                dateLocale={dateLocale}
                locationName={selectedTask ? locationName(selectedTask.location_id) : ""}
                onClose={() => setSelectedTaskId(null)}
                open={Boolean(selectedTask)}
                range={selectedRange}
                task={selectedTask}
                workerNames={selectedTask ? taskWorkerNames(selectedTask) : calendarDict.unassigned}
            />

            <DeleteConfirmDialog
                open={disconnectDialogOpen}
                onOpenChange={setDisconnectDialogOpen}
                title={calendarDict.disconnect_dialog_title}
                description={(calendarDict.disconnect_dialog_description ?? "").replace(
                    "{email}",
                    googleCalendar.status?.google_account_email || "your Google account",
                )}
                onConfirm={() => { setDisconnectDialogOpen(false); void googleCalendar.disconnect(); }}
                isDeleting={googleCalendar.disconnecting}
                confirmText={calendarDict.disconnect_dialog_confirm}
                cancelText={calendarDict.disconnect_dialog_cancel}
                confirmIcon={CloudOff}
                confirmVariant="danger"
            />
        </div>
    );
}
