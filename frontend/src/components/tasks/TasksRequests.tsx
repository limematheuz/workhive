"use client";

import React from "react";
import { Inbox, Search } from "lucide-react";
import { TaskItem } from "@/services/task.service";
import { Location } from "@/services/location.service";
import { TasksRequestsFilters } from "./TasksRequestsFilters";
import { TaskRequestCard } from "./TaskRequestCard";

interface TasksRequestsProps {
    requests: TaskItem[];
    locations: Location[];
    getLocationName: (locId: number) => string;
    onAccept: (task: TaskItem) => void;
    onReject: (taskId: number) => Promise<void>;
}

export function TasksRequests({
    requests,
    locations,
    getLocationName,
    onAccept,
    onReject,
}: TasksRequestsProps) {
    const [actioningId, setActioningId] = React.useState<number | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [locationFilter, setLocationFilter] = React.useState("ALL");
    const [issuerFilter, setIssuerFilter] = React.useState("ALL");
    const [dateFilter, setDateFilter] = React.useState("ALL");

    const requestLocations = React.useMemo(
        () => locations
            .filter((location) => requests.some((task) => task.location_id === location.id))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
        [locations, requests]
    );

    const issuers = React.useMemo(() => {
        const values = new Map<number, string>();
        requests.forEach((task) => {
            const reservation = task.checkout_reservation;
            if (reservation?.owner_company_id) {
                values.set(
                    reservation.owner_company_id,
                    reservation.owner_company_name || `Empresa ${reservation.owner_company_id}`
                );
            }
        });
        return Array.from(values.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [requests]);

    const filteredRequests = React.useMemo(() => {
        const now = new Date();
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const normalizedSearch = searchQuery.trim().toLowerCase();

        return requests.filter((task) => {
            const location = locations.find((item) => item.id === task.location_id);
            const reservation = task.checkout_reservation;
            const plannedAt = task.scheduled_start_at
                ? new Date(task.scheduled_start_at)
                : reservation
                    ? new Date(reservation.check_out_at)
                    : null;
            const haystack = [
                task.title,
                task.description,
                location?.name,
                location?.address,
                reservation?.owner_company_name,
            ].filter(Boolean).join(" ").toLowerCase();

            const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
            const matchesLocation = locationFilter === "ALL"
                || task.location_id === Number(locationFilter);
            const matchesIssuer = issuerFilter === "ALL"
                || reservation?.owner_company_id === Number(issuerFilter);
            const matchesDate = dateFilter === "ALL"
                || (
                    dateFilter === "TURNOVER"
                    && Boolean(
                        reservation
                        && task.next_reservation
                        && new Date(reservation.check_out_at).toDateString()
                            === new Date(task.next_reservation.check_in_at).toDateString()
                    )
                )
                || (
                    dateFilter === "NEXT_7"
                    && plannedAt !== null
                    && plannedAt >= now
                    && plannedAt <= nextWeek
                )
                || (dateFilter === "NO_NEXT" && !task.next_reservation);

            return matchesSearch && matchesLocation && matchesIssuer && matchesDate;
        });
    }, [dateFilter, issuerFilter, locationFilter, locations, requests, searchQuery]);

    const handleAction = async (taskId: number, action: (id: number) => Promise<void>) => {
        try {
            setActioningId(taskId);
            await action(taskId);
        } finally {
            setActioningId(null);
        }
    };

    if (requests.length === 0) {
        return (
            <div className="billing-block rounded-2xl border border-dashed border-[var(--border-soft)] px-5 py-14 text-center">
                <Inbox className="mx-auto mb-3 h-7 w-7 text-[var(--text-muted)]" />
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    No tienes solicitudes de limpieza pendientes
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <TasksRequestsFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                locationFilter={locationFilter}
                onLocationFilterChange={setLocationFilter}
                issuerFilter={issuerFilter}
                onIssuerFilterChange={setIssuerFilter}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
                requestLocations={requestLocations}
                issuers={issuers}
            />

            <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                {filteredRequests.length} de {requests.length} solicitudes
            </p>

            {filteredRequests.length === 0 ? (
                <div className="billing-block rounded-2xl border border-dashed border-[var(--border-soft)] px-5 py-12 text-center">
                    <Search className="mx-auto mb-3 h-7 w-7 text-[var(--text-muted)]" />
                    <p className="text-sm font-semibold text-[var(--text-main)]">No hay solicitudes con estos filtros</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {filteredRequests.map((task) => (
                        <TaskRequestCard
                            key={task.id}
                            task={task}
                            location={locations.find((l) => l.id === task.location_id)}
                            getLocationName={getLocationName}
                            isWorking={actioningId === task.id}
                            onAccept={onAccept}
                            onReject={(taskId) => handleAction(taskId, onReject)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
