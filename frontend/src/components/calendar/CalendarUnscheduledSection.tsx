"use client";

import Link from "next/link";
import { MapPin, UserRound } from "lucide-react";

import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskItem } from "@/types/user";

type CalendarUnscheduledSectionProps = {
    calendarDict: Dictionary["calendar"];
    tasks: TaskItem[];
    locationName: (id: number) => string;
    userName: (id: number | null | undefined) => string;
};

export function CalendarUnscheduledSection({
    calendarDict,
    tasks,
    locationName,
    userName,
}: CalendarUnscheduledSectionProps) {
    if (tasks.length === 0) return null;

    return (
        <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
            <h2 className="text-sm font-black text-[var(--text-main)]">{calendarDict.unscheduled}</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{calendarDict.unscheduled_help}</p>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {tasks.map((task) => (
                    <Link
                        key={task.id}
                        href="/dashboard/tasks"
                        className="rounded-2xl border border-[var(--border-soft)] bg-[var(--dialog-control-bg)] p-3 transition hover:border-[var(--accent-color)]"
                    >
                        <p className="truncate text-xs font-bold text-[var(--text-main)]">{task.title}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {locationName(task.location_id)}
                            </span>
                            <span className="flex items-center gap-1">
                                <UserRound className="h-3 w-3" />
                                {userName(task.user_id)}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
