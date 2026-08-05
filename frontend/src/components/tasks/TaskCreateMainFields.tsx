"use client";

import { Lock } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/services/location.service";
import { getDefaultTaskDate } from "@/domain/tasks/task-create";
import {
    taskFormControlClass,
    taskFormLabelClass,
    taskFormReadOnlyClass,
    taskFormSectionClass,
    taskFormSectionHeaderClass,
    taskFormSectionHintClass,
    taskFormSectionTitleClass,
} from "./taskFormLayout";

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
        <section className={taskFormSectionClass}>
            <div className={taskFormSectionHeaderClass}>
                <h3 className={taskFormSectionTitleClass}>
                    {dict.tasks?.create_dialog?.planning_section || "Planning"}
                </h3>
                <p className={taskFormSectionHintClass}>
                    {dict.tasks?.create_dialog?.planning_section_hint
                        || "Choose the location and date. Assign workers in the checklist."}
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div className="space-y-2">
                    <label htmlFor="task-create-location" className={taskFormLabelClass}>
                        <span>{dict.tasks?.create_dialog?.select_location || "Select Location *"}</span>
                    </label>
                    <select
                        id="task-create-location"
                        value={newLocationId}
                        onChange={(e) => setNewLocationId(e.target.value)}
                        aria-label={dict.tasks?.create_dialog?.select_location || "Select Location *"}
                        required
                        className={`${taskFormControlClass} cursor-pointer shadow-xs`}
                    >
                        <option value="" disabled>{dict.tasks?.create_dialog?.select_location_placeholder || "-- Select a location --"}</option>
                        {ownLocations.map(loc => (
                            <option key={loc.id} value={loc.id.toString()}>{loc.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <span className={taskFormLabelClass}>
                        <span>{dict.tasks?.create_dialog?.calendar_owner || "Company calendar"}</span>
                    </span>
                    <div className={taskFormReadOnlyClass}>
                        <Lock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="truncate">{calendarOwnerName}</span>
                    </div>
                    <p className="text-2xs font-semibold leading-snug text-[var(--text-muted)]">
                        {dict.tasks?.create_dialog?.calendar_owner_hint
                            || "This task syncs to the company’s connected calendar."}
                    </p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="task-create-date" className={taskFormLabelClass}>
                        <span>{dict.tasks?.create_dialog?.date || "Planning Date"}</span>
                    </label>
                    <input
                        id="task-create-date"
                        type="date"
                        value={newCreatedAt}
                        min={getDefaultTaskDate()}
                        onChange={(e) => setNewCreatedAt(e.target.value)}
                        aria-label={dict.tasks?.create_dialog?.date || "Planning Date"}
                        className={`${taskFormControlClass} cursor-pointer shadow-xs`}
                    />
                </div>
            </div>
        </section>
    );
}
