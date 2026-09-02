"use client";

import { ArrowLeft, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { parseChecklistItems, type ParsedChecklistItem } from "@/lib/format";
import type { TaskItem } from "@/services/task.service";

function getSubTaskBadge(item: ParsedChecklistItem) {
    let statusLabel = "Pendiente";
    let statusClass = "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20";

    const status = item.assignedStatus || (item.checked ? "completed" : "pending");

    if (status === "completed") {
        statusLabel = "Completada";
        statusClass = "bg-accent/10 text-accent border border-accent/25";
    } else if (status === "progress") {
        statusLabel = "En progreso";
        statusClass = "bg-accent/10 text-accent border border-accent/20";
    } else if (status === "accepted") {
        statusLabel = "Aceptada";
        statusClass = "bg-accent/10 text-accent border border-accent/20";
    } else if (status === "rejected") {
        statusLabel = "Rechazada";
        statusClass = "bg-rose-500/10 text-rose-500 border border-rose-500/20";
    } else if (status === "review") {
        statusLabel = "En revisión";
        statusClass = "bg-purple-500/10 text-purple-500 border border-purple-500/20";
    }

    return { label: statusLabel, className: statusClass };
}

type ClientTaskDetailDialogProps = {
    task: TaskItem | null;
    showBackToClient: boolean;
    onClose: () => void;
    onBackToClient: () => void;
};

export function ClientTaskDetailDialog({
    task,
    showBackToClient,
    onClose,
    onBackToClient,
}: ClientTaskDetailDialogProps) {
    return (
        <Dialog open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md border border-[var(--border-soft)] text-[var(--text-main)] rounded-2xl p-6">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <ListTodo className="w-5 h-5 text-accent" />
                        Detalle de la Tarea
                    </DialogTitle>
                    <DialogDescription className="text-3xs uppercase font-mono tracking-wider text-[var(--text-muted)] font-black">
                        ID de la Tarea: #{task?.id}
                    </DialogDescription>
                </DialogHeader>
                {task && (
                    <div className="space-y-4 py-4 text-xs font-semibold">
                        <div className="space-y-1">
                            <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">Título:</span>
                            <div className="text-sm font-bold text-[var(--text-main)]">{task.title}</div>
                        </div>
                        {task.description && (() => {
                            const checklistItems = parseChecklistItems(task.description);
                            return (
                                <div className="space-y-1">
                                    <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">Descripción / Instrucciones:</span>
                                    {checklistItems.length > 0 ? (
                                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 bg-[var(--bg-secondary)]/30 p-2.5 rounded-xl border border-[var(--border-soft)]">
                                            {checklistItems.map((item) => {
                                                const badge = getSubTaskBadge(item);
                                                return (
                                                    <div key={`${item.text}-${item.checked}-${item.assignedUserId || "all"}`} className="flex items-center justify-between gap-3 p-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border-soft)]/60">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <Checkbox
                                                                checked={item.checked}
                                                                disabled
                                                                aria-label={`Checklist: ${item.text}`}
                                                            />
                                                            <div className="flex flex-col min-w-0">
                                                                <span className={`text-xs font-semibold text-[var(--text-main)] truncate ${item.checked ? "line-through text-[var(--text-muted)] font-normal" : ""}`}>
                                                                    {item.text}
                                                                </span>
                                                                {item.assignedUserName && (
                                                                    <span className="text-[9px] text-accent font-bold uppercase tracking-wide">
                                                                        @{item.assignedUserName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Badge className={`uppercase text-[9px] font-bold rounded-full px-2 py-0.5 shrink-0 ${badge.className}`}>
                                                            {badge.label}
                                                        </Badge>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-[var(--text-main)] font-medium leading-relaxed bg-[var(--bg-secondary)]/50 p-2.5 rounded-xl border border-[var(--border-soft)] whitespace-pre-wrap">
                                            {task.description}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">Estado:</span>
                                <div>
                                    <Badge className={`uppercase text-[9px] font-bold rounded-full px-2 py-0.5 ${
                                        task.status === "completed"
                                            ? "bg-accent/10 text-accent border border-accent/25"
                                            : task.status === "progress"
                                            ? "bg-accent/10 text-accent border border-accent/20"
                                            : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                                    }`}>
                                        {task.status === "completed" ? "Completada" : task.status === "progress" ? "En progreso" : "Pendiente"}
                                    </Badge>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">Precio / Cantidad:</span>
                                <div className="text-[var(--text-main)]">
                                    {task.price ?? 0} € / {task.quantity ?? 1} {task.unit}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-[var(--border-soft)]">
                            {showBackToClient ? (
                                <Button
                                    variant="outline"
                                    onClick={onBackToClient}
                                    className="font-bold rounded-xl px-3 py-2 text-xs border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] flex items-center gap-1.5 cursor-pointer"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    Volver al cliente
                                </Button>
                            ) : <div />}
                            <Button
                                onClick={onClose}
                                className="bg-accent hover:bg-accent/90 text-white font-bold rounded-xl px-4 py-2 text-xs border border-transparent cursor-pointer"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
