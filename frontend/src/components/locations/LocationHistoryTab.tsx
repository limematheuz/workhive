"use client";

import React from "react";
import { Plus, Loader2, Check, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cleanChecklistDescription } from "@/lib/format";
import { TaskItem } from "@/services/task.service";
import { User } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";

interface LocationHistoryTabProps {
    dict: Dictionary;
    tasks: TaskItem[];
    users: User[];
    isAdminOrManager: boolean;
    submitting: boolean;
    showCreateForm: boolean;
    setShowCreateForm: (show: boolean) => void;
    title: string;
    setTitle: (val: string) => void;
    description: string;
    setDescription: (val: string) => void;
    assignedUserId: string;
    setAssignedUserId: (val: string) => void;
    price: string;
    setPrice: (val: string) => void;
    quantity: string;
    setQuantity: (val: string) => void;
    unit: string;
    setUnit: (val: string) => void;
    handleCreateTask: (e: React.FormEvent) => void;
    handleToggleStatus: (task: TaskItem) => void;
    getAssigneeName: (userId: number | null) => string;
    loadingTasks: boolean;
    readOnly?: boolean;
}

export function LocationHistoryTab({
    dict,
    tasks,
    users,
    isAdminOrManager,
    submitting,
    showCreateForm,
    setShowCreateForm,
    title,
    setTitle,
    description,
    setDescription,
    assignedUserId,
    setAssignedUserId,
    price,
    setPrice,
    quantity,
    setQuantity,
    unit,
    setUnit,
    handleCreateTask,
    handleToggleStatus,
    getAssigneeName,
    loadingTasks,
    readOnly
}: LocationHistoryTabProps) {
    const [statusFilter, setStatusFilter] = React.useState<string>("ALL");

    const filteredTasks = tasks.filter(task => {
        if (statusFilter === "ALL") return true;
        if (statusFilter === "pending") return task.status === "pending";
        if (statusFilter === "progress") return task.status === "progress" || task.status === "in_progress";
        if (statusFilter === "completed") return task.status === "completed";
        return task.status === statusFilter;
    });

    return (
        <div className="space-y-5">
            {/* Create completed task */}
            {isAdminOrManager && !readOnly && (
                <div className="border-b border-[var(--border-soft)] pb-5">
                    {users.length === 0 ? (
                        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                            <div className="flex items-start gap-3">
                                <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                <div>
                                    <p className="text-sm font-semibold text-[var(--text-main)]">
                                        No hay trabajadores de campo disponibles
                                    </p>
                                    <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
                                        El trabajo puntual se asigna únicamente a trabajadores de tu empresa. Para encargar un servicio a una empresa colaboradora, crea una solicitud desde Reservas.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : !showCreateForm ? (
                        <Button
                            onClick={() => {
                                setAssignedUserId("");
                                setShowCreateForm(true);
                            }}
                            className="w-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-2 ui-motion border-none cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            Crear trabajo puntual
                        </Button>
                    ) : (
                        <form onSubmit={handleCreateTask} className="space-y-3.5 bg-[var(--bg-primary)]/20 p-4 border border-[var(--border-soft)] rounded-2xl">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)]">
                                    Crear trabajo puntual
                                </h4>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowCreateForm(false)}
                                    className="h-6 px-2 text-2xs text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg border-none cursor-pointer"
                                >
                                    {dict.locations?.sheet?.cancel || "Cancelar"}
                                </Button>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-2xs uppercase font-bold text-[var(--text-muted)]">{dict.locations?.sheet?.job_title_label || "Título del Trabajo *"}</Label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={dict.locations?.sheet?.job_title_placeholder || "ej: Planchado de sábanas o lavado extra"}
                                    required
                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="location-history-instructions" className="text-2xs uppercase font-bold text-[var(--text-muted)]">{dict.locations?.sheet?.instructions_label || "Instrucciones"}</label>
                                <textarea
                                    id="location-history-instructions"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={dict.locations?.sheet?.instructions_placeholder || "Detalles sobre lo que se debe hacer..."}
                                    rows={2}
                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent resize-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-2xs uppercase font-bold text-[var(--text-muted)]">Asignar a un trabajador de tu equipo</Label>
                                <select
                                    value={assignedUserId}
                                    onChange={(e) => setAssignedUserId(e.target.value)}
                                    required
                                    aria-label="Asignar a un trabajador de tu equipo"
                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent"
                                >
                                    <option value="" disabled>
                                        Selecciona un trabajador
                                    </option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id.toString()}>
                                            {u.full_name || u.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-2xs uppercase font-bold text-[var(--text-muted)]">{dict.locations?.sheet?.price_label || "Precio (€)"}</Label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder={dict.locations?.sheet?.price_placeholder || "0.00"}
                                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-2xs uppercase font-bold text-[var(--text-muted)]">{dict.locations?.sheet?.quantity_label || "Cantidad"}</Label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        placeholder={dict.locations?.sheet?.quantity_placeholder || "1.0"}
                                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-2xs uppercase font-bold text-[var(--text-muted)]">{dict.locations?.sheet?.unit_label || "Unidad"}</Label>
                                <input
                                    type="text"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    placeholder={dict.locations?.sheet?.unit_placeholder || "hora, unidad, servicio..."}
                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-black text-white hover:bg-neutral-800 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-2 border-none cursor-pointer"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        {dict.locations?.sheet?.assigning || "Creando..."}
                                    </>
                                ) : (
                                    dict.locations?.sheet?.assign_btn || "Asignar Tarea"
                                )}
                            </Button>
                        </form>
                    )}
                </div>
            )}

            {/* List */}
            {loadingTasks ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    <span className="text-2xs text-[var(--text-muted)] font-semibold uppercase">{dict.locations?.sheet?.loading_history || "Cargando historial..."}</span>
                </div>
            ) : tasks.length > 0 ? (
                <div className="space-y-3">
                    {/* Status filter */}
                    <div className="flex justify-end">
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            aria-label="Filtrar por estado"
                            className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg px-2 py-1 outline-none text-[var(--text-main)]"
                        >
                            <option value="ALL">{dict.clients?.details?.all_statuses || "Todos los estados"}</option>
                            <option value="pending">{dict.clients?.details?.status_pending || "Pendientes"}</option>
                            <option value="progress">{dict.clients?.details?.status_in_progress || "En curso"}</option>
                            <option value="completed">{dict.clients?.details?.status_completed || "Completadas"}</option>
                        </select>
                    </div>

                    {filteredTasks.length === 0 ? (
                        <div className="text-center py-8 text-xs font-semibold text-[var(--text-muted)] italic">
                            {dict.clients?.details?.no_tasks || "No se encontraron tareas con los filtros actuales."}
                        </div>
                    ) : (
                        filteredTasks.map(task => {
                            const isCompleted = task.status === "completed";
                        return (
                            <div
                                key={task.id}
                                role={readOnly ? undefined : "button"}
                                tabIndex={readOnly ? undefined : 0}
                                aria-label={readOnly ? undefined : task.title}
                                onClick={() => !readOnly && handleToggleStatus(task)}
                                onKeyDown={
                                    readOnly
                                        ? undefined
                                        : (event) => {
                                              if (event.target !== event.currentTarget) return;
                                              if (event.key === "Enter" || event.key === " ") {
                                                  if (event.key === " ") event.preventDefault();
                                                  handleToggleStatus(task);
                                              }
                                          }
                                }
                                className={`flex items-start gap-3 p-3 rounded-2xl border border-[var(--border-soft)] select-none ui-motion duration-150 ${isCompleted
                                        ? "bg-[var(--bg-primary)]/40 opacity-70"
                                        : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]"
                                    } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                            >
                                <div className="mt-0.5">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ui-motion ${isCompleted ? "bg-accent border-accent text-white" : "border-[var(--border-color)] bg-[var(--bg-primary)]"
                                        }`}>
                                        {isCompleted && <Check className="w-3 h-3 stroke-[3px]" />}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold truncate text-[var(--text-main)] ${isCompleted ? "line-through text-[var(--text-muted)]" : ""}`}>
                                        {task.title}
                                    </p>
                                    {task.description && (
                                        <p className={`text-2xs text-[var(--text-muted)] mt-0.5 break-words line-clamp-2 ${isCompleted ? "line-through" : ""}`}>
                                            {cleanChecklistDescription(task.description)}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 flex-wrap text-3xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                        <span>{getAssigneeName(task.user_id)}</span>
                                        {task.price && (
                                            <span>{task.price} € / {task.unit}</span>
                                        )}
                                        <Badge
                                            className={`text-[9px] px-1.5 py-0 font-bold uppercase rounded-full border ${
                                                task.status === "completed"
                                                    ? "bg-accent/10 text-accent border-accent/20"
                                                    : task.status === "progress" || task.status === "in_progress"
                                                    ? "bg-accent/10 text-accent border-accent/20"
                                                    : "bg-neutral-500/10 text-[var(--text-muted)] border border-[var(--border-soft)]"
                                            }`}
                                        >
                                            {task.status === "completed"
                                                ? (dict.clients?.details?.status_completed || "Completada")
                                                : task.status === "progress" || task.status === "in_progress"
                                                ? (dict.clients?.details?.status_in_progress || "En curso")
                                                : (dict.clients?.details?.status_pending || "Pendiente")}
                                        </Badge>
                                        {task.is_invoiced && (
                                            <span className="flex items-center gap-1 text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded">
                                                <Lock className="w-2.5 h-2.5" />
                                                {dict.locations?.sheet?.invoiced || "Facturado"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                    )}
                </div>
            ) : (
                <div className="text-center py-10 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-soft)]">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">{dict.locations?.sheet?.no_jobs || "Sin trabajos registrados"}</p>
                </div>
            )}
        </div>
    );
}
