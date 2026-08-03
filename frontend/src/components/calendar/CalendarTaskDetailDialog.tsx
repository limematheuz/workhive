"use client";

import Link from "next/link";
import {
    Check,
    FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cleanChecklistDescription, parseChecklistItems } from "@/lib/format";
import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskCalendarRange } from "@/lib/company-calendar";
import type { TaskItem } from "@/types/user";
import {
    getCalendarStatusColor,
    getCalendarStatusLabel,
} from "./calendar-constants";
import { localizeTaskDescription, taskLocationTitle } from "@/lib/task-display";

interface DetailFieldProps {
    label: string;
    value: React.ReactNode;
}

function DetailField({ label, value }: DetailFieldProps) {
    return (
        <div className="space-y-1">
            <span className="block text-2xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {label}
            </span>
            <div className="flex h-10 items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 text-xs font-bold text-[var(--text-main)]">
                <span className="truncate">{value}</span>
            </div>
        </div>
    );
}

interface CalendarTaskDetailDialogProps {
    calendarDict: Dictionary["calendar"];
    dateLocale: string;
    locationName: string;
    onClose: () => void;
    open: boolean;
    range: TaskCalendarRange | null;
    task: TaskItem | null;
    workerNames: string;
}

export function CalendarTaskDetailDialog({
    calendarDict,
    dateLocale,
    locationName,
    onClose,
    open,
    range,
    task,
    workerNames,
}: CalendarTaskDetailDialogProps) {
    const localizedDescription = localizeTaskDescription(task?.description);
    const checklist = task ? parseChecklistItems(localizedDescription) : [];
    const plainDescription = cleanChecklistDescription(localizedDescription);
    const statusColor = task ? getCalendarStatusColor(task.status) : "#64748b";
    const displayTitle = task ? taskLocationTitle(task, locationName) : "";

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl md:max-w-3xl border-[var(--border-soft)]">
                {task && (
                    <>
                        <DialogHeader className="dialog-glass-chrome shrink-0 border-b border-[var(--border-soft)] p-6 pr-16 text-left sm:text-left">
                            <span className="block text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                                Detalles de la tarea
                            </span>
                            <DialogTitle className="mt-1 text-lg font-black leading-tight text-[var(--text-main)]">
                                {displayTitle}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex-1 space-y-4 overflow-y-auto p-6 font-sans text-sm">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <DetailField
                                    label="Instalación / Ubicación"
                                    value={locationName}
                                />
                                <DetailField
                                    label="Asignado a"
                                    value={workerNames}
                                />
                                <DetailField
                                    label="Fecha de planificación"
                                    value={range ? range.start.toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "-"}
                                />
                                <DetailField
                                    label="Hora"
                                    value={range ? range.start.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "-"}
                                />
                                <DetailField
                                    label="Estado"
                                    value={
                                        <span className="inline-flex items-center gap-1.5 font-black capitalize" style={{ color: statusColor }}>
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
                                            {getCalendarStatusLabel(task.status)}
                                        </span>
                                    }
                                />
                            </div>

                            {task.notes ? (
                                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/10 p-4">
                                    <div className="mb-2 flex items-center gap-2 text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                                        <FileText className="h-4 w-4 text-accent" />
                                        Descripción
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed text-[var(--text-main)]">{task.notes}</p>
                                </div>
                            ) : null}

                            {checklist.length > 0 ? (
                                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/10 p-4">
                                    <div className="mb-3 flex items-center gap-2 text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                                        <FileText className="h-4 w-4 text-amber-500" />
                                        Checklist
                                    </div>
                                    <div className="space-y-2">
                                        {checklist.map((item) => (
                                            <div key={`${item.lineIndex}-${item.text}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-xs">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${item.checked ? "border-accent bg-accent text-white" : "border-[var(--border-color)] bg-[var(--dialog-control-bg)] text-transparent"}`}>
                                                        <Check className="h-3 w-3 stroke-[3px]" />
                                                    </span>
                                                    <span className="truncate font-bold text-[var(--text-main)]">{item.text}</span>
                                                </div>
                                                {item.assignedUserName && (
                                                    <span className="shrink-0 rounded-xl border border-[var(--border-soft)] bg-[var(--dialog-control-bg)] px-3 py-1 text-2xs font-black text-[var(--text-main)]">
                                                        {item.assignedUserName}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : plainDescription ? (
                                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/10 p-4">
                                    <div className="mb-2 flex items-center gap-2 text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                                        <FileText className="h-4 w-4 text-amber-500" />
                                        Descripción
                                    </div>
                                    <p className="text-sm font-medium text-[var(--text-main)]">{plainDescription}</p>
                                </div>
                            ) : null}
                        </div>

                        <DialogFooter className="flex shrink-0 gap-2 border-t border-[var(--border-soft)] p-4">
                            <Button onClick={onClose} className="flex-1 rounded-xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] py-2.5 text-xs font-semibold text-[var(--btn-cancel-text)] hover:border-transparent hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)]">
                                {calendarDict.close || "Cerrar"}
                            </Button>
                            <Button asChild className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--btn-primary-bg)] py-2.5 text-xs font-semibold text-[var(--btn-primary-text)] ui-motion hover:bg-[var(--btn-primary-hover-bg)]">
                                <Link href={`/dashboard/tasks?taskId=${task.id}`}>
                                    {calendarDict.open_task || "Abrir en tareas"}
                                </Link>
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
