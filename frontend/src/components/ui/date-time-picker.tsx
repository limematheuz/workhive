"use client";

import * as React from "react";
import { CalendarIcon, Clock3 } from "lucide-react";
import { es } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DateTimePickerProps = {
    id: string;
    value: string | null;
    onValueChange: (value: string | null) => void;
    placeholder?: string;
    className?: string;
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
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

function toLocalIso(date: Date, time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    const next = new Date(date);
    next.setHours(hours, minutes, 0, 0);
    return next.toISOString();
}

export function DateTimePicker({ id, value, onValueChange, placeholder = "dd/mm/aaaa, hh:mm", className }: DateTimePickerProps) {
    const selectedDate = parseDate(value);
    const [open, setOpen] = React.useState(false);
    const [month, setMonth] = React.useState<Date | undefined>(selectedDate);
    const [text, setText] = React.useState(() => formatDate(selectedDate));
    const time = selectedDate
        ? `${String(selectedDate.getHours()).padStart(2, "0")}:${String(selectedDate.getMinutes()).padStart(2, "0")}`
        : "09:00";

    React.useEffect(() => {
        setText(formatDate(selectedDate));
        if (selectedDate) setMonth(selectedDate);
    }, [value]); // Keep external saves/reset in sync with the shared calendar field.

    const selectDate = (date: Date | undefined) => {
        if (!date) return;
        onValueChange(toLocalIso(date, time));
        setText(formatDate(date));
        setMonth(date);
        setOpen(false);
    };

    return (
        <div className={cn("grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]", className)}>
            <InputGroup className="h-10 border-[var(--border-color)] bg-[var(--bg-primary)] shadow-none">
                <InputGroupInput
                    id={id}
                    value={text}
                    placeholder={placeholder}
                    readOnly
                    className="dialog-compact-control !border-0 !bg-transparent !shadow-none"
                    aria-label="Fecha de seguimiento"
                />
                <InputGroupAddon align="inline-end">
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
                                    locale={es}
                                    weekStartsOn={1}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                </InputGroupAddon>
            </InputGroup>
            <Select value={time} onValueChange={(nextTime) => selectedDate && onValueChange(toLocalIso(selectedDate, nextTime))}>
                <SelectTrigger className="h-10"><Clock3 className="size-4 text-[var(--text-muted)]" /><SelectValue placeholder="Hora" /></SelectTrigger>
                <SelectContent>{TIME_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
}
