"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

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
    users: User[];
    onNavigate: (action: "prev" | "next" | "today") => void;
    onLocationFilterChange: (value: string) => void;
    onUserFilterChange: (value: string) => void;
};

export function CalendarToolbar({
    calendarDict,
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
                <Button variant="outline" size="icon" onClick={() => onNavigate("prev")} aria-label="Semana anterior">
                    <ChevronLeft />
                </Button>
                <Button variant="outline" onClick={() => onNavigate("today")}>{calendarDict.today}</Button>
                <Button variant="outline" size="icon" onClick={() => onNavigate("next")} aria-label="Semana siguiente">
                    <ChevronRight />
                </Button>
                <h2 className="ml-0 text-lg font-black capitalize text-[var(--text-main)] sm:ml-2">
                    {calendarTitle}
                </h2>
            </div>
            <div className="flex flex-wrap gap-2">
                <select
                    value={locationFilter}
                    onChange={(event) => onLocationFilterChange(event.target.value)}
                    aria-label={calendarDict.all_locations}
                    className="h-10 rounded-xl border border-[var(--dialog-control-border)] bg-[var(--dialog-control-bg)] px-4 text-xs font-semibold text-[var(--text-main)] outline-none transition focus:border-[var(--accent-color)]"
                >
                    <option value="">{calendarDict.all_locations}</option>
                    {locations.map((location) => (
                        <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                </select>
                {users.length > 1 && (
                    <select
                        value={userFilter}
                        onChange={(event) => onUserFilterChange(event.target.value)}
                        aria-label={calendarDict.all_workers}
                        className="h-10 rounded-xl border border-[var(--dialog-control-border)] bg-[var(--dialog-control-bg)] px-4 text-xs font-semibold text-[var(--text-main)] outline-none transition focus:border-[var(--accent-color)]"
                    >
                        <option value="">{calendarDict.all_workers}</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    );
}
