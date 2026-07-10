import type { Client } from "../types/client.ts";

export type ClientStatusFilter = "all" | "active" | "inactive";

export function normalizeClientSearch(value: string): string {
    return value.trim().toLowerCase();
}

export function filterClients(
    clients: Client[],
    searchTerm: string,
    statusFilter: ClientStatusFilter,
): Client[] {
    const normalizedSearch = normalizeClientSearch(searchTerm);
    return clients.filter((client) => {
        const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "active" && client.is_active) ||
            (statusFilter === "inactive" && !client.is_active);
        if (!matchesStatus) return false;
        if (normalizedSearch === "") return true;

        return [
            client.name,
            client.legal_number,
            client.email,
            client.phone,
        ].some((value) => (value || "").toLowerCase().includes(normalizedSearch));
    });
}
