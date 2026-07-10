import type { TaskItem } from "@/types/user";

export function localizeTaskTitle(title: string): string {
    return title.replace(/^Checkout Cleaning\s*-\s*/i, "Limpieza de salida - ");
}

export function localizeTaskDescription(description?: string | null): string | null | undefined {
    if (!description) return description;
    return description.replace(
        /Service requested for the checkout of a reservation of (\d+) guests\./i,
        "Servicio solicitado para la salida de una reserva de $1 huéspedes."
    );
}

export function taskLocationTitle(task: TaskItem, locationName: string): string {
    const title = localizeTaskTitle(task.title);
    return title.includes(locationName) || !locationName
        ? title
        : `${title} - ${locationName}`;
}

export function isExternalTaskForCompany(task: TaskItem, companyId?: number | null): boolean {
    return Boolean(
        task.checkout_reservation?.owner_company_id &&
        companyId &&
        task.checkout_reservation.owner_company_id !== companyId
    );
}
