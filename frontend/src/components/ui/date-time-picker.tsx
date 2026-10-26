"use client";

import * as React from "react";
import { CalendarIcon, Clock3, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Matcher } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formControlSurfaceClassName } from "@/components/ui/control-styles";
import { useDialogFormGuardMark } from "./dialog-form-guard";
import { cn } from "@/lib/utils";

type DateTimePickerProps = {
    id: string;
    value: string | null;
    onValueChange: (value: string | null) => void;
    placeholder?: string;
    className?: string;
    min?: string | null;
    max?: string | null;
    clearable?: boolean;
    "aria-label"?: string;
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
    const hours = String(Math.floor(index / 2)).padStart(2, "0");
    const minutes = index % 2 === 0 ? "00" : "30";
    return `${hours}:${minutes}`;
});
function parseDate(value: string | null) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(value: Date | undefined) {
    if (!value) return "";
    return format(value, "dd/MM/yyyy");
}

function toLocalDateTime(date: Date, time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    const next = new Date(date);
    next.setHours(hours, minutes, 0, 0);
    return next;
}

function clampToBounds(date: Date, min?: string | null, max?: string | null): Date {
    const minimum = parseDate(min ?? null);
    const maximum = parseDate(max ?? null);
    if (minimum && date < minimum) return minimum;
    if (maximum && date > maximum) return maximum;
    return date;
}

export function DateTimePicker({
    id,
    value,
    onValueChange,
    placeholder = "dd/mm/aaaa, hh:mm",
    className,
    min,
    max,
    clearable = false,
    "aria-label": ariaLabel,
}: DateTimePickerProps) {
    const control = React.useRef<HTMLDivElement>(null);
    const markDirty = useDialogFormGuardMark();
    const changeValue = (next: string | null) => {
        if (next === value) return;
        markDirty(control.current);
        onValueChange(next);
    };
    const selectedDate = parseDate(value);
    const [open, setOpen] = React.useState(false);
    const [month, setMonth] = React.useState<Date | undefined>(selectedDate);
    const time = selectedDate
        ? `${String(selectedDate.getHours()).padStart(2, "0")}:${String(selectedDate.getMinutes()).padStart(2, "0")}`
        : "09:00";
    const disabled = React.useMemo<Matcher | undefined>(() => {
        const before = parseDate(min ?? null);
        const after = parseDate(max ?? null);
        if (before && after) return { before, after };
        if (before) return { before };
        if (after) return { after };
        return undefined;
    }, [max, min]);

    const applyDateTime = (date: Date, nextTime: string) => {
        changeValue(clampToBounds(toLocalDateTime(date, nextTime), min, max).toISOString());
    };

    const selectDate = (date: Date | undefined) => {
        if (!date) return;
        applyDateTime(date, time);
        setMonth(date);
        setOpen(false);
    };

    return (
        <div ref={control} className={cn("grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]", className)}>
            <InputGroup className={cn("h-10 overflow-hidden rounded-xl shadow-none", formControlSurfaceClassName)}>
                <InputGroupInput
                    id={id}
                    value={formatDate(selectedDate)}
                    placeholder={placeholder}
                    readOnly
                    className="dialog-compact-control !border-0 !bg-transparent !shadow-none"
                    aria-label={ariaLabel ?? "Fecha y hora"}
                />
                <InputGroupAddon align="inline-end">
                    {clearable && value && (
                        <InputGroupButton
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Borrar fecha y hora"
                            onClick={() => changeValue(null)}
                        >
                            <X />
                        </InputGroupButton>
                    )}
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <InputGroupButton type="button" variant="ghost" size="icon-xs" aria-label="Abrir calendario">
                                <CalendarIcon />
                            </InputGroupButton>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto overflow-hidden p-0" align="end" sideOffset={10}>
                            <div className="style-vega">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    month={month}
                                    onMonthChange={setMonth}
                                    onSelect={selectDate}
                                    disabled={disabled}
                                    locale={es}
                                    weekStartsOn={1}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                </InputGroupAddon>
            </InputGroup>
            <Select value={time} onValueChange={(nextTime) => selectedDate && applyDateTime(selectedDate, nextTime)}>
                <SelectTrigger className="h-10"><Clock3 className="size-4 text-[var(--text-muted)]" /><SelectValue placeholder="Hora" /></SelectTrigger>
                <SelectContent>{TIME_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
}
