import { isCompanyTaskManagerRole } from "../domain/access/roles.ts";

export function canQueryManagementTaskFeed(
    canManageTasks: boolean | undefined,
    roleName: string | undefined,
): boolean {
    if (typeof canManageTasks === "boolean") return canManageTasks;
    return isCompanyTaskManagerRole(roleName);
}

export function canQueryReservationNotificationFeed(
    enabled: boolean,
    reservationDataEnabled: boolean,
    canManageTasks: boolean | undefined,
    roleName: string | undefined,
): boolean {
    return enabled && reservationDataEnabled && canQueryManagementTaskFeed(canManageTasks, roleName);
}
