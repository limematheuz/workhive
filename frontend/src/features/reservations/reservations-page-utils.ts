import { LocationService } from "@/services/location.service";
import { ReservationService } from "@/services/reservation.service";
import { TaskService, TaskItem } from "@/services/task.service";
import { TemplateTaskService } from "@/services/template.service";
import { UserService } from "@/services/user.service";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";
import type { TemplateTask } from "@/types/template";
import type { User } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";

export function getReservationAssigneeName(
    userId: number | null,
    users: User[],
    currentUser: User | null,
): string {
    if (userId === null) return "Sin asignar";
    const assignedUser = users.find((candidate) => candidate.id === userId);
    if (assignedUser) return assignedUser.full_name || assignedUser.email;
    if (currentUser && currentUser.id === userId) return currentUser.full_name || currentUser.email;
    return `ID: ${userId}`;
}

export function getReservationLocationName(locationId: number, locations: Location[]): string {
    const location = locations.find((candidate) => candidate.id === locationId);
    return location ? location.name : `Location ID: ${locationId}`;
}

export async function loadRequestedTasksForPage(
    setRequestedTasks: (tasks: TaskItem[]) => void,
    setLoadingTasks: (loading: boolean) => void,
    silent = false,
) {
    try {
        if (!silent) setLoadingTasks(true);
        const data = await TaskService.getTaskItems({ status: "requested", limit: 250 });
        setRequestedTasks(data);
    } catch (error) {
        console.error("Error loading requested tasks:", error);
    } finally {
        if (!silent) setLoadingTasks(false);
    }
}

export async function loadInitialTaskDataForPage(
    user: User | null,
    setUsers: (users: User[]) => void,
    setTemplates: (templates: TemplateTask[]) => void,
) {
    try {
        const [loadedUsers, loadedTemplates] = await Promise.all([
            UserService.getUsers().catch(() => [] as User[]),
            TemplateTaskService.getTemplates().catch(() => [] as TemplateTask[]),
        ]);
        const filteredUsers =
            user?.role?.name === "superadmin"
                ? loadedUsers
                : loadedUsers.filter((loadedUser) => loadedUser.role?.name !== "superadmin");
        setUsers(filteredUsers);
        setTemplates(loadedTemplates);
    } catch (error) {
        console.error("Error loading initial task data for requests:", error);
    }
}

export async function loadReservationsPageData({
    silent = false,
    canManage,
    setLoading,
    setLocations,
    setReservations,
    loadRequestedTasks,
    onError,
}: {
    silent?: boolean;
    canManage: boolean;
    setLoading: (loading: boolean) => void;
    setLocations: (locations: Location[]) => void;
    setReservations: (reservations: Reservation[]) => void;
    loadRequestedTasks: (silent?: boolean) => Promise<void>;
    onError: (message: string) => void;
}) {
    if (!canManage) {
        setLoading(false);
        return;
    }
    try {
        if (!silent) setLoading(true);
        const [loadedLocations, loadedReservations] = await Promise.all([
            LocationService.getLocations(),
            ReservationService.getReservations(),
        ]);
        setLocations(loadedLocations);
        setReservations(loadedReservations);
        await loadRequestedTasks(silent);
    } catch (error) {
        onError(error instanceof Error ? error.message : "No se pudieron cargar las reservas");
    } finally {
        if (!silent) setLoading(false);
    }
}

export async function confirmReservationCancellation({
    reservation,
    dict,
    loadData,
    onComplete,
    onError,
}: {
    reservation: Reservation | null;
    dict: Dictionary;
    loadData: () => Promise<void>;
    onComplete: () => void;
    onError: (message: string) => void;
}) {
    if (!reservation) return;
    try {
        await ReservationService.updateReservation(reservation.id, { status: "cancelled" });
        onComplete();
        await loadData();
    } catch (error) {
        onError(
            error instanceof Error
                ? error.message
                : dict.reservations?.cancel_dialog?.error || "Error al cancelar la reserva",
        );
    }
}
