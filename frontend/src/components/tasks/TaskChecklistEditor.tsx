import { useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TaskChecklistItem } from "@/lib/task-checklist";
import type { User } from "@/types/user";

interface TaskChecklistEditorProps {
    items: TaskChecklistItem[];
    users: User[];
    canEdit: boolean;
    onToggle: (itemIndex: number) => void;
    onAssign: (itemIndex: number, userId: string) => void;
    onAssignAll?: (userId: string) => void;
}

export function TaskChecklistEditor({
    items,
    users,
    canEdit,
    onToggle,
    onAssign,
    onAssignAll,
}: TaskChecklistEditorProps) {
    const [assignAllValue, setAssignAllValue] = useState("select");

    return (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/10 font-sans">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
                <div>
                    <p className="text-xs font-black text-[var(--text-main)]">Pasos del trabajo</p>
                    <p className="mt-0.5 text-2xs text-[var(--text-muted)]">Asigna todo de una vez o ajusta una excepción.</p>
                </div>
                {canEdit && onAssignAll && (
                    <Select
                        value={assignAllValue}
                        onValueChange={(value) => {
                            if (value !== "select") onAssignAll(value);
                            setAssignAllValue("select");
                        }}
                    >
                        <SelectTrigger aria-label="Asignar todos los pasos" className="h-9 max-w-44 text-xs font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="select">Asignar todos…</SelectItem><SelectItem value="unassigned">Quitar asignación</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id.toString()}>{user.full_name || user.email}</SelectItem>)}</SelectContent>
                    </Select>
                )}
            </div>
            <div className="divide-y divide-[var(--border-soft)] px-4">
                {items.map((item) => (
                    <div
                        key={item.index}
                        className="grid grid-cols-[minmax(0,1fr)_11rem] items-center gap-4 py-3 text-xs"
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <button
                                type="button"
                                disabled={!canEdit}
                                aria-label={item.checked ? `Marcar pendiente: ${item.text}` : `Marcar completado: ${item.text}`}
                                onClick={() => onToggle(item.index)}
                                className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ui-motion",
                                    item.checked
                                        ? "border-accent bg-accent text-white"
                                        : "border-[var(--border-color)] bg-[var(--dialog-control-bg)] text-transparent",
                                    canEdit ? "cursor-pointer hover:border-accent" : "cursor-default"
                                )}
                            >
                                <span className="text-[11px] font-black leading-none">✓</span>
                            </button>
                            <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => onToggle(item.index)}
                                className={cn(
                                    "flex-1 select-none truncate-normal break-words pr-2 text-left font-semibold leading-tight transition-colors duration-200 bg-transparent border-none p-0",
                                    item.checked
                                        ? "text-[var(--text-muted)] line-through"
                                        : "text-[var(--text-main)]",
                                    canEdit ? "cursor-pointer hover:text-accent" : "cursor-default"
                                )}
                            >
                                {item.text}
                            </button>
                        </div>

                        {canEdit ? (
                            <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                                <Select
                                    value={item.assignedUserId?.toString() || "unassigned"}
                                    onValueChange={(value) => onAssign(item.index, value)}
                                >
                                    <SelectTrigger aria-label={`Asignar trabajador: ${item.text}`} className="h-9 w-44 text-left text-xs font-semibold"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="unassigned">Sin asignar</SelectItem>{users.map((user) => (
                                        <SelectItem key={user.id} value={user.id.toString()}>
                                            {user.full_name || user.email}
                                        </SelectItem>
                                    ))}</SelectContent>
                                </Select>
                            </div>
                        ) : (
                            item.assignedUserId && (
                                <span
                                    className="shrink-0 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent dark:text-accent"
                                    title={item.assignedUserName}
                                >
                                    {item.assignedUserName
                                        ? item.assignedUserName
                                              .split(" ")
                                              .map((name) => name[0])
                                              .join("")
                                              .toUpperCase()
                                              .slice(0, 2)
                                        : `ID: ${item.assignedUserId}`}
                                </span>
                            )
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
