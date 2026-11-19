"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { CompactFilterSelect } from "@/components/ui/compact-filter-select";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/types/location";
import type { User } from "@/types/user";

type CalendarToolbarProps = {
    calendarDict: Dictionary["calendar"];
    calendarTitle: string;
    locationFilter: string;
    userFilter: string;
    locations: Location[];
    users: Pick<User, "id" | "full_name" | "email">[];
    calendarView: string; onViewChange: (value: string) => void;
    statusFilter: string; onStatusFilterChange: (value: string) => void;
    onNavigate: (action: "prev" | "next" | "today") => void;
    onLocationFilterChange: (value: string) => void;
    onUserFilterChange: (value: string) => void;
};

export function CalendarToolbar({
    calendarDict,
    calendarView, onViewChange, statusFilter, onStatusFilterChange,
    calendarTitle,
    locationFilter,
    userFilter,
    locations,
    users,
    onNavigate,
    onLocationFilterChange,
    onUserFilterChange,
}: CalendarToolbarProps) {
    return (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => onNavigate("prev")} aria-label="Periodo anterior">
                    <ChevronLeft />
                </Button>
                <Button variant="outline" onClick={() => onNavigate("today")}>{calendarDict.today}</Button>
                <Button variant="outline" size="icon" onClick={() => onNavigate("next")} aria-label="Periodo siguiente">
                    <ChevronRight />
                </Button>
                <h2 className="ml-0 text-lg font-black capitalize text-[var(--text-main)] sm:ml-2">
                    {calendarTitle}
                </h2>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
                <CompactFilterSelect aria-label="Vista del calendario" value={calendarView} onValueChange={onViewChange} options={[{value:"timeGridDay",label:"Día"},{value:"timeGridWeek",label:"Semana"}]} />
                <CompactFilterSelect aria-label="Estado del trabajo" value={statusFilter} onValueChange={onStatusFilterChange} options={[{value:"",label:"Todos los estados"},{value:"pending",label:"Pendientes"},{value:"progress",label:"En curso"},{value:"review",label:"En revisión"},{value:"completed",label:"Completados"}]} />
                <SearchableSelect
                    value={locationFilter}
                    onValueChange={onLocationFilterChange}
                    aria-label={calendarDict.all_locations}
                    className="h-10 rounded-xl border border-[var(--dialog-control-border)] bg-[var(--dialog-control-bg)] px-4 text-xs font-semibold text-[var(--text-main)] outline-none transition focus:border-[var(--accent-color)]"
                    options={[
                        { value: "", label: calendarDict.all_locations },
                        ...locations.map((location) => ({ value: String(location.id), label: location.name })),
                    ]}
                />
                {users.length > 1 && (
                    <SearchableSelect
                        value={userFilter}
                        onValueChange={onUserFilterChange}
                        aria-label={calendarDict.all_workers}
                        className="h-10 rounded-xl border border-[var(--dialog-control-border)] bg-[var(--dialog-control-bg)] px-4 text-xs font-semibold text-[var(--text-main)] outline-none transition focus:border-[var(--accent-color)]"
                        options={[
                            { value: "", label: calendarDict.all_workers },
                            ...users.map((user) => ({ value: String(user.id), label: user.full_name || user.email })),
                        ]}
                    />
                )}
            </div>
        </div>
    );
}
