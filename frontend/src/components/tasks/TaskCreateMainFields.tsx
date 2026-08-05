"use client";

import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/services/location.service";
import { getDefaultTaskDate } from "@/domain/tasks/task-create";

type TaskCreateMainFieldsProps = {
    dict: Dictionary;
    ownLocations: Location[];
    newLocationId: string;
    setNewLocationId: (val: string) => void;
    newCreatedAt: string;
    setNewCreatedAt: (val: string) => void;
};

/** The first decision is only where and when. Team ownership belongs with the checklist. */
export function TaskCreateMainFields({
    dict,
    ownLocations,
    newLocationId,
    setNewLocationId,
    newCreatedAt,
    setNewCreatedAt,
}: TaskCreateMainFieldsProps) {
    return (
        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4 sm:p-5">
            <div className="mb-4">
                <p className="text-sm font-black text-[var(--text-main)]">Planificación</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Elige la ubicación y la fecha. La asignación del equipo se hace en el siguiente paso.
                </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.7fr)_minmax(11rem,0.8fr)]">
                <label className="block space-y-2" htmlFor="task-create-location">
                    <span className="block text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.tasks?.create_dialog?.select_location || "Ubicación *"}
                    </span>
                    <select
                        id="task-create-location"
                        value={newLocationId}
                        onChange={(event) => setNewLocationId(event.target.value)}
                        required
                        className="h-11 w-full cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none ui-motion focus:border-accent focus:ring-1 focus:ring-accent"
                    >
                        <option value="" disabled>Elige una ubicación</option>
                        {ownLocations.map((location) => (
                            <option key={location.id} value={location.id.toString()}>{location.name}</option>
                        ))}
                    </select>
                </label>

                <label className="block space-y-2" htmlFor="task-create-date">
                    <span className="block text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.tasks?.create_dialog?.date || "Fecha"}
                    </span>
                    <input
                        id="task-create-date"
                        type="date"
                        value={newCreatedAt}
                        min={getDefaultTaskDate()}
                        onChange={(event) => setNewCreatedAt(event.target.value)}
                        className="h-11 w-full cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none ui-motion focus:border-accent focus:ring-1 focus:ring-accent"
                    />
                </label>
            </div>
        </section>
    );
}
