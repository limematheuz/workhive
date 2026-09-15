"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
                <div className="block space-y-2">
                    <span className="block text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.tasks?.create_dialog?.select_location || "Ubicación *"}
                    </span>
                    <Select
                        value={newLocationId}
                        onValueChange={setNewLocationId}
                    >
                        <SelectTrigger id="task-create-location" className="h-11 w-full text-sm font-semibold">
                            <SelectValue placeholder="Elige una ubicación" />
                        </SelectTrigger>
                        <SelectContent>
                            {ownLocations.map((location) => (
                                <SelectItem key={location.id} value={location.id.toString()}>{location.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="block space-y-2">
                    <span className="block text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.tasks?.create_dialog?.date || "Fecha"}
                    </span>
                    <DatePicker
                        id="task-create-date"
                        value={newCreatedAt}
                        min={getDefaultTaskDate()}
                        onValueChange={setNewCreatedAt}
                    />
                </div>
            </div>
        </section>
    );
}
