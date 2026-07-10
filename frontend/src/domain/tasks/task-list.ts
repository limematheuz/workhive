import { canManageCompanyTasks } from "../access/roles.ts";
import type { User } from "../../types/user.ts";

export type TaskPageTab = "kanban" | "list" | "calendar" | "templates" | "requests";

export interface TaskListFilters {
    locationId?: number;
    userId?: number;
    status?: string;
}

interface BuildTaskListFiltersParams {
    currentUser: User | null;
    activeTab: TaskPageTab;
    selectedLocationId: string;
    selectedStatus: string;
    selectedUserId: string;
}

function parsePositiveInt(value: string): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildTaskListFilters({
    currentUser,
    activeTab,
    selectedLocationId,
    selectedStatus,
    selectedUserId,
}: BuildTaskListFiltersParams): TaskListFilters {
    const filters: TaskListFilters = {};
    const locationId = parsePositiveInt(selectedLocationId);
    if (locationId) filters.locationId = locationId;

    if (activeTab === "requests") {
        filters.status = "requested";
    } else if (activeTab === "list" && selectedStatus) {
        filters.status = selectedStatus;
    }

    if (canManageCompanyTasks(currentUser)) {
        const userId = parsePositiveInt(selectedUserId);
        if (userId) filters.userId = userId;
        return filters;
    }

    if (currentUser) {
        filters.userId = currentUser.id;
    }

    return filters;
}
