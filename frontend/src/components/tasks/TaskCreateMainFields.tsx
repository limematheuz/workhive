"use client";

import { Lock } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/services/location.service";
import { getDefaultTaskDate } from "@/domain/tasks/task-create";

type TaskCreateMainFieldsProps = {
    dict: Dictionary;
    ownLocations: Location[];
    calendarOwnerName: string;
    newLocationId: string;
    setNewLocationId: (val: string) => void;
    newCreatedAt: string;
    setNewCreatedAt: (val: string) => void;
};

export function TaskCreateMainFields({
    dict,
    ownLocations,
    calendarOwnerName,
    newLocationId,
    setNewLocationId,
    newCreatedAt,
    setNewCreatedAt,
}: TaskCreateMainFieldsProps) {
    return (
        <div className="bg-[var(--bg-secondary)] p-5 border border-[var(--border-soft)] rounded-2xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div className="space-y-2">
                    <label htmlFor="task-create-location" className="text-2xs uppercase font-black text-[var(--text-main)] flex items-end tracking-wider sm:min-h-[36px] pb-0.5">
                        <span>{dict.tasks?.create_dialog?.select_location || "Select Location *"}</span>
                    </label>
                    <select
                        id="task-create-location"
                        value={newLocationId}
                        onChange={(e) => setNewLocationId(e.target.value)}
                        aria-label={dict.tasks?.create_dialog?.select_location || "Select Location *"}
                        required
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer h-10 shadow-xs"
                    >
                        <option value="" disabled>{dict.tasks?.create_dialog?.select_location_placeholder || "-- Select a location --"}</option>
                        {ownLocations.map(loc => (
                            <option key={loc.id} value={loc.id.toString()}>{loc.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <span className="text-2xs uppercase font-black text-[var(--text-main)] flex items-end tracking-wider sm:min-h-[36px] pb-0.5">
                        <span>Calendario</span>
                    </span>
                    <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-bold text-[var(--text-main)] shadow-xs">
                        <Lock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="truncate">{calendarOwnerName}</span>
                    </div>
                    <p className="text-[10px] font-semibold leading-snug text-[var(--text-muted)]">
                        La tarea principal se asigna al calendario sincronizado. Los trabajadores se asignan abajo en el checklist.
                    </p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="task-create-date" className="text-2xs uppercase font-black text-[var(--text-main)] flex items-end tracking-wider sm:min-h-[36px] pb-0.5">
                        <span>{dict.tasks?.create_dialog?.date || "Planning Date"}</span>
                    </label>
                    <input
                        id="task-create-date"
                        type="date"
                        value={newCreatedAt}
                        min={getDefaultTaskDate()}
                        onChange={(e) => setNewCreatedAt(e.target.value)}
                        aria-label={dict.tasks?.create_dialog?.date || "Planning Date"}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer h-10 shadow-xs"
                    />
                </div>
            </div>
        </div>
    );
}
