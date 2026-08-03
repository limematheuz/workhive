"use client";

import {
    FormEvent,
    startTransition,
    Suspense,
    useCallback,
    useEffect,
    useEffectEvent,
    useMemo,
    useRef,
    useState,
} from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
    ReservationsAccessDenied,
    ReservationsPageLayout,
} from "@/features/reservations/ReservationsPageLayout";
import {
    createEmptyReservationForm,
    createReservationForm,
    createReservationPayload,
    filterReservations,
    getReservableLocations,
    getReservationProviderOptions,
} from "@/features/reservations/reservation-helpers";
import {
    confirmReservationCancellation,
    getReservationAssigneeName,
    getReservationLocationName,
    loadInitialTaskDataForPage,
    loadRequestedTasksForPage,
    loadReservationsPageData,
} from "@/features/reservations/reservations-page-utils";
import type {
    ReservationFiltersState,
    ReservationViewMode,
} from "@/features/reservations/types";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import { useTaskCrud } from "@/hooks/useTaskCrud";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { LocationService } from "@/services/location.service";
import { ReservationService } from "@/services/reservation.service";
import { TaskService, TaskItem } from "@/services/task.service";
import type { Company } from "@/types/company";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";
import type { TemplateTask } from "@/types/template";
import type { User } from "@/types/user";

function createInitialReservationFilters(): ReservationFiltersState {
    return {
        location: "ALL",
        provider: "ALL",
        cleaning: "ALL",
        date: "UPCOMING",
        year: new Date().getFullYear().toString(),
        month: "ALL",
        search: "",
        showCancelled: false,
    };
}

function ReservationsPageContent() {
    const { user } = useUser();
    const { dict, locale } = useDictionary();
    const searchParams = useSearchParams();
    const defaultTab =
        (searchParams.get("tab") as "reservations" | "requests") || "reservations";

    const [locations, setLocations] = useState<Location[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reservationFilters, setReservationFilters] =
        useState<ReservationFiltersState>(createInitialReservationFilters);
    const [viewMode, setViewMode] = useState<ReservationViewMode>("active");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Reservation | null>(null);
    const [form, setForm] = useState(() => createEmptyReservationForm());
    const [providersState, setProvidersState] = useState<{
        forLocationId: string;
        providers: Company[];
    }>({ forLocationId: "", providers: [] });
    const serviceProviders =
        providersState.forLocationId === form.locationId
            ? providersState.providers
            : [];
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    const reservationToCancelRef = useRef<Reservation | null>(null);

    const canManage = ["admin", "manager", "superadmin"].includes(user?.role?.name || "");
    const [activeTab, setActiveTab] = useState<"reservations" | "requests">(defaultTab);
    const [requestedTasks, setRequestedTasks] = useState<TaskItem[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [templates, setTemplates] = useState<TemplateTask[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);

    useEffect(() => {
        if (!form.locationId) return;
        const locationId = form.locationId;
        LocationService.getLocationServiceProviders(Number(locationId))
            .then((providers) =>
                setProvidersState({
                    forLocationId: locationId,
                    providers: providers.filter((provider) => provider.id !== user?.company_id),
                }),
            )
            .catch((error) => console.error("Error loading service providers:", error));
    }, [form.locationId, user?.company_id]);

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab === "requests" || tab === "reservations") {
            startTransition(() => setActiveTab(tab));
        }
    }, [searchParams]);

    const displayRequestedTasks = useMemo(() => (user ? requestedTasks : []), [requestedTasks, user]);

    const loadRequestedTasks = useCallback(
        (silent = false) =>
            loadRequestedTasksForPage(setRequestedTasks, setLoadingTasks, silent),
        [],
    );

    const loadInitialTaskData = useCallback(
        () => loadInitialTaskDataForPage(user, setUsers, setTemplates),
        [user],
    );

    useEffect(() => {
        if (canManage) {
            loadRequestedTasks();
            loadInitialTaskData();
        }
    }, [user, canManage, loadRequestedTasks, loadInitialTaskData]);

    const taskCrud = useTaskCrud({
        dict,
        templates,
        loadTasks: loadRequestedTasks,
        setTasks: setRequestedTasks,
        users,
        currentUser: user,
    });

    const openTaskFromUrl = useEffectEvent((taskId: string | null, tasks: TaskItem[]) => {
        if (!taskId || tasks.length === 0) return;
        const task = tasks.find((requestedTask) => requestedTask.id === Number(taskId));
        if (task && (!taskCrud.selectedTask || taskCrud.selectedTask.id !== task.id)) {
            taskCrud.handleOpenDetail(task);
        }
    });

    useEffect(() => {
        openTaskFromUrl(searchParams.get("taskId"), requestedTasks);
    }, [searchParams, requestedTasks]);

    const getAssigneeName = (userId: number | null) =>
        getReservationAssigneeName(userId, users, user);
    const getLocationName = (locationId: number) =>
        getReservationLocationName(locationId, locations);

    const handleRejectTask = async (taskId: number) => {
        try {
            await TaskService.rejectTaskItem(taskId);
            toast.success("Solicitud rechazada");
            await loadRequestedTasks();
        } catch (error) {
            console.error("Error rejecting task:", error);
            toast.error("No se pudo rechazar la solicitud");
        }
    };

    const handleAcceptTask = async (taskId: number, scheduledStartAt?: string) => {
        try {
            await TaskService.acceptTaskItem(taskId, scheduledStartAt);
            toast.success("Solicitud aceptada con éxito");
            await loadRequestedTasks();
        } catch (error) {
            console.error("Error accepting task:", error);
            toast.error("No se pudo aceptar la solicitud");
            throw error;
        }
    };

    const loadData = useCallback(
        (silent = false) =>
            loadReservationsPageData({
                silent,
                canManage,
                setLoading,
                setLocations,
                setReservations,
                loadRequestedTasks,
                onError: (message) => toast.error(message),
            }),
        [canManage, loadRequestedTasks],
    );

    useEffect(() => {
        loadData(false);
    }, [loadData]);

    useBackgroundPolling(() => loadData(true), POLL_INTERVALS.reservations);

    const locationMap = useMemo(
        () => new Map(locations.map((location) => [location.id, location])),
        [locations],
    );
    const providerOptions = useMemo(
        () => getReservationProviderOptions(reservations),
        [reservations],
    );
    const filteredReservations = useMemo(
        () =>
            filterReservations({
                reservations,
                locationMap,
                companyId: user?.company_id,
                filters: reservationFilters,
                viewMode,
            }),
        [locationMap, reservationFilters, reservations, user?.company_id, viewMode],
    );
    const reservableLocations = useMemo(
        () => (user ? getReservableLocations(locations, user.company_id) : []),
        [locations, user],
    );

    const openCreate = () => {
        setEditing(null);
        const firstLocation = reservableLocations[0];
        setForm(
            createEmptyReservationForm(
                firstLocation?.id.toString() || "",
                firstLocation?.default_service_provider_id,
            ),
        );
        setOpen(true);
    };

    const openEdit = useCallback((reservation: Reservation) => {
        setEditing(reservation);
        setForm(createReservationForm(reservation));
        setOpen(true);
    }, []);

    useEffect(() => {
        const reservationId = searchParams.get("reservationId");
        if (!reservationId || reservations.length === 0) return;
        const reservation = reservations.find((item) => item.id === Number(reservationId));
        if (reservation && (!editing || editing.id !== reservation.id)) {
            const timeoutId = window.setTimeout(() => {
                setActiveTab("reservations");
                openEdit(reservation);
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
    }, [searchParams, reservations, editing, openEdit]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const payload = createReservationPayload(form, editing);
        try {
            setSaving(true);
            if (editing) {
                await ReservationService.updateReservation(editing.id, payload);
                toast.success(dict.reservations?.form?.update_success || "Reserva actualizada con éxito");
            } else {
                await ReservationService.createReservation(payload);
                toast.success(dict.reservations?.form?.create_success || "Reserva creada con éxito");
            }
            setOpen(false);
            await loadData();
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : dict.reservations?.form?.save_error || "Error al guardar la reserva",
            );
        } finally {
            setSaving(false);
        }
    };

    const cancelReservation = (reservation: Reservation) => {
        reservationToCancelRef.current = reservation;
        setIsCancelConfirmOpen(true);
    };

    const confirmCancelReservation = async () => {
        await confirmReservationCancellation({
            reservation: reservationToCancelRef.current,
            dict,
            loadData: () => loadData(),
            onComplete: () =>
                toast.success(dict.reservations?.cancel_dialog?.success || "Reserva cancelada con éxito"),
            onError: (message) => toast.error(message),
        });
        setIsCancelConfirmOpen(false);
        reservationToCancelRef.current = null;
    };

    const handleCancelDialogOpenChange = (nextOpen: boolean) => {
        setIsCancelConfirmOpen(nextOpen);
        if (!nextOpen) reservationToCancelRef.current = null;
    };

    if (!canManage) return <ReservationsAccessDenied />;

    return (
        <ReservationsPageLayout
            dict={dict}
            locale={locale}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            requestCount={displayRequestedTasks.length}
            showCreateButton={activeTab === "reservations" && reservableLocations.length > 0}
            onCreate={openCreate}
            loading={loading}
            reservationFilters={reservationFilters}
            onFiltersChange={setReservationFilters}
            onResetFilters={() => setReservationFilters(createInitialReservationFilters())}
            locations={locations}
            providerOptions={providerOptions}
            filteredReservations={filteredReservations}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            locationMap={locationMap}
            companyId={user?.company_id ?? undefined}
            onEdit={openEdit}
            onCancel={cancelReservation}
            loadingTasks={loadingTasks}
            displayRequestedTasks={displayRequestedTasks}
            user={user}
            users={users}
            canManage={canManage}
            taskCrud={taskCrud}
            getLocationName={getLocationName}
            getAssigneeName={getAssigneeName}
            onAcceptTask={handleAcceptTask}
            onRejectTask={handleRejectTask}
            onOpenTaskDetail={taskCrud.handleOpenDetail}
            formOpen={open}
            onFormOpenChange={setOpen}
            editing={editing}
            form={form}
            onFormChange={setForm}
            reservableLocations={reservableLocations}
            serviceProviders={serviceProviders}
            saving={saving}
            onSubmit={submit}
            isCancelConfirmOpen={isCancelConfirmOpen}
            onCancelDialogOpenChange={handleCancelDialogOpenChange}
            onConfirmCancelReservation={confirmCancelReservation}
        />
    );
}

export default function ReservationsPage() {
    return (
        <Suspense
            fallback={
                <div className="py-20 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
            }
        >
            <ReservationsPageContent />
        </Suspense>
    );
}
