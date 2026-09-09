import { CalendarClock, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LocationServiceWindow, LocationWeekday } from "@/types/location";

const WEEKDAYS: Array<[LocationWeekday, string]> = [
    ["mon", "L"], ["tue", "M"], ["wed", "X"], ["thu", "J"],
    ["fri", "V"], ["sat", "S"], ["sun", "D"],
];

const EMPTY_SERVICE_WINDOW: LocationServiceWindow = {
    label: "",
    days: ["mon", "tue", "wed", "thu", "fri"],
    starts_at: "09:00",
    ends_at: "18:00",
    notes: "",
    is_active: true,
};

interface LocationServiceWindowsSectionProps {
    serviceWindows: LocationServiceWindow[];
    setServiceWindows: (value: LocationServiceWindow[]) => void;
}

export function LocationServiceWindowsSection({
    serviceWindows,
    setServiceWindows,
}: LocationServiceWindowsSectionProps) {
    const updateServiceWindow = (
        index: number,
        changes: Partial<LocationServiceWindow>,
    ) => {
        setServiceWindows(serviceWindows.map((serviceWindow, serviceWindowIndex) => (
            serviceWindowIndex === index ? { ...serviceWindow, ...changes } : serviceWindow
        )));
    };
    const toggleDay = (index: number, day: LocationWeekday) => {
        const serviceWindow = serviceWindows[index];
        const days = serviceWindow.days.includes(day)
            ? serviceWindow.days.filter((currentDay) => currentDay !== day)
            : [...serviceWindow.days, day];
        updateServiceWindow(index, { days });
    };

    return (
        <div className="mt-6 border-t border-[var(--border-soft)] pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                        <CalendarClock className="h-4 w-4 text-accent" />
                        Horarios de servicio
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Indica cuándo se puede programar el trabajo. Es distinto del horario y las credenciales de acceso.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setServiceWindows([
                        ...serviceWindows,
                        { ...EMPTY_SERVICE_WINDOW, days: [...EMPTY_SERVICE_WINDOW.days], draft_id: crypto.randomUUID() },
                    ])}
                >
                    <Plus className="h-4 w-4" /> Añadir horario
                </Button>
            </div>

            {serviceWindows.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[var(--bg-secondary)] px-3 py-3 text-sm text-[var(--text-muted)]">
                    No hay horarios de servicio registrados. La planificación usará la disponibilidad acordada en el contrato.
                </p>
            ) : (
                <div className="mt-4 space-y-3">
                    {serviceWindows.map((serviceWindow, index) => (
                        <div key={serviceWindow.id ?? serviceWindow.draft_id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 sm:p-4">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="space-y-1.5 xl:col-span-2">
                                    <Label htmlFor={`location-service-window-label-${index}`}>Nombre del horario</Label>
                                    <Input
                                        id={`location-service-window-label-${index}`}
                                        value={serviceWindow.label || ""}
                                        onChange={(event) => updateServiceWindow(index, { label: event.target.value })}
                                        placeholder="Ej.: Limpieza antes de abrir"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`location-service-window-from-${index}`}>Desde</Label>
                                    <Input
                                        id={`location-service-window-from-${index}`}
                                        type="time"
                                        value={serviceWindow.starts_at}
                                        onChange={(event) => updateServiceWindow(index, { starts_at: event.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`location-service-window-until-${index}`}>Hasta</Label>
                                    <Input
                                        id={`location-service-window-until-${index}`}
                                        type="time"
                                        value={serviceWindow.ends_at}
                                        onChange={(event) => updateServiceWindow(index, { ends_at: event.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                <span className="text-sm font-medium text-[var(--text-main)]">Días</span>
                                {WEEKDAYS.map(([day, label]) => (
                                    <label key={day} className="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--text-muted)]">
                                        <Checkbox
                                            checked={serviceWindow.days.includes(day)}
                                            onCheckedChange={() => toggleDay(index, day)}
                                        />
                                        {label}
                                    </label>
                                ))}
                                <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
                                    <Checkbox
                                        checked={serviceWindow.is_active}
                                        onCheckedChange={(checked) => updateServiceWindow(index, { is_active: checked === true })}
                                    />
                                    Activo
                                </label>
                            </div>
                            <div className="mt-3 space-y-1.5">
                                <Label htmlFor={`location-service-window-notes-${index}`}>Indicaciones</Label>
                                <Textarea
                                    id={`location-service-window-notes-${index}`}
                                    value={serviceWindow.notes || ""}
                                    onChange={(event) => updateServiceWindow(index, { notes: event.target.value })}
                                    placeholder="Ej.: Evitar horas de atención al público."
                                    className="min-h-20"
                                />
                            </div>
                            <div className="mt-3 flex justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-[var(--text-muted)] hover:text-destructive"
                                    onClick={() => setServiceWindows(serviceWindows.filter((_, serviceWindowIndex) => serviceWindowIndex !== index))}
                                >
                                    <Trash2 className="h-4 w-4" /> Eliminar
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
