"use client";

import { BriefcaseBusiness, CheckSquare, Loader2, Receipt, Search } from "lucide-react";

import type { InvoiceableTask as InvoiceableJob } from "@/services/invoice.service";
import type { Client } from "@/services/client.service";
import { formatCurrency, formatDate } from "@/lib/format";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export type InvoiceableTask = InvoiceableJob & {
    clientId: number;
    clientName: string;
    locationName: string;
};

type InvoiceableJobsSectionProps = {
    tasks: InvoiceableTask[];
    loading: boolean;
    selectedJobIds: number[];
    clients: Client[];
    collaboratorOptions: readonly (readonly [number, string])[];
    search: string;
    onSearchChange: (value: string) => void;
    partyFilter: string;
    onPartyFilterChange: (value: string) => void;
    invoiceFilter: "all" | "pending" | "invoiced";
    onInvoiceFilterChange: (value: "all" | "pending" | "invoiced") => void;
    dateFrom: string;
    onDateFromChange: (value: string) => void;
    dateTo: string;
    onDateToChange: (value: string) => void;
    onToggleJob: (task: InvoiceableTask) => void;
    onCreateInvoice: () => void;
    labels: {
        jobs_title?: string;
        jobs_subtitle?: string;
        create_invoice_with_count?: string;
        search_jobs_placeholder?: string;
        filter_all_parties?: string;
        clients_group?: string;
        collaborators_group?: string;
        filter_uninvoiced_jobs?: string;
        filter_invoiced_jobs?: string;
        filter_all_jobs?: string;
        empty_jobs?: string;
        jobs_loading?: string;
        client?: string;
        price?: string;
        title?: string;
        quantity?: string;
        task_title?: string;
        location_label?: string;
        col_date?: string;
        invoiced?: string;
        status_pending?: string;
    };
};

export function InvoiceableJobsSection({
    tasks,
    loading,
    selectedJobIds,
    clients,
    collaboratorOptions,
    search,
    onSearchChange,
    partyFilter,
    onPartyFilterChange,
    invoiceFilter,
    onInvoiceFilterChange,
    dateFrom,
    onDateFromChange,
    dateTo,
    onDateToChange,
    onToggleJob,
    onCreateInvoice,
    labels,
}: InvoiceableJobsSectionProps) {
    const selectedJobIdSet = new Set(selectedJobIds);
    const selectedCount = selectedJobIds.length;

    return (
        <div className="space-y-5">
            <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-5 space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
                            <BriefcaseBusiness className="w-5 h-5" />
                            {labels.jobs_title || "Trabajos completados"}
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                            {labels.jobs_subtitle || "Selecciona varios trabajos del mismo cliente y genera una única factura."}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={selectedCount === 0}
                        onClick={onCreateInvoice}
                        className="h-10 px-4 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold flex items-center justify-center gap-2 border border-[var(--border-soft)] cursor-pointer"
                    >
                        <Receipt className="w-4 h-4" />
                        {labels.create_invoice_with_count
                            ? labels.create_invoice_with_count.replace("{count}", selectedCount.toString())
                            : `Crear factura con ${selectedCount}`}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
                        <input
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder={labels.search_jobs_placeholder || "Buscar por trabajo, cliente o casa..."}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                        />
                    </div>
                    <select
                        aria-label={labels.filter_all_parties || "Todos los clientes y colaboradores"}
                        value={partyFilter}
                        onChange={(e) => onPartyFilterChange(e.target.value)}
                        className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                    >
                        <option value="">{labels.filter_all_parties || "Todos los clientes y colaboradores"}</option>
                        <optgroup label={labels.clients_group || "Clientes"}>
                            {clients.map((c) => (
                                <option key={c.id} value={`client:${c.id}`}>{c.name}</option>
                            ))}
                        </optgroup>
                        {collaboratorOptions.length > 0 && (
                            <optgroup label={labels.collaborators_group || "Colaboradores"}>
                                {collaboratorOptions.map(([id, name]) => (
                                    <option key={id} value={`collaborator:${id}`}>{name}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                    <select
                        aria-label="Filtrar por estado de facturación"
                        value={invoiceFilter}
                        onChange={(e) => onInvoiceFilterChange(e.target.value as "all" | "pending" | "invoiced")}
                        className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                    >
                        <option value="pending">{labels.filter_uninvoiced_jobs || "Pendientes de facturar"}</option>
                        <option value="invoiced">{labels.filter_invoiced_jobs || "Ya facturados"}</option>
                        <option value="all">{labels.filter_all_jobs || "Todos"}</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="date"
                            aria-label="Fecha desde"
                            value={dateFrom}
                            onChange={(e) => onDateFromChange(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors min-w-0"
                        />
                        <input
                            type="date"
                            aria-label="Fecha hasta"
                            value={dateTo}
                            onChange={(e) => onDateToChange(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors min-w-0"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl w-full shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-20 gap-3">
                        <Loader2 className="w-6 h-6 text-accent animate-spin" />
                        <span className="text-xs text-[var(--text-muted)]">{labels.jobs_loading || "Loading jobs..."}</span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-sm text-[var(--text-muted)]">{labels.empty_jobs || "No jobs found with these filters."}</p>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3 p-3 md:hidden">
                            {tasks.map((task) => {
                                const isSelected = selectedJobIdSet.has(task.id);
                                const disabled = task.is_invoiced;
                                return (
                                    <button
                                        type="button"
                                        key={task.id}
                                        disabled={disabled}
                                        onClick={() => onToggleJob(task)}
                                        className={`rounded-2xl border p-4 text-left transition ${
                                            isSelected
                                                ? "border-accent bg-accent/5"
                                                : "border-[var(--border-soft)] bg-[var(--bg-primary)]"
                                        } ${disabled ? "opacity-55" : "cursor-pointer"}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-[var(--text-main)]">{task.title}</p>
                                                <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{task.clientName}</p>
                                            </div>
                                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                                isSelected
                                                    ? "border-accent bg-accent text-white"
                                                    : "border-[var(--border-color)]"
                                            }`}>
                                                {isSelected && <CheckSquare className="h-3.5 w-3.5" />}
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border-soft)] pt-3 text-xs text-[var(--text-muted)]">
                                            <span className="truncate">{task.locationName}</span>
                                            <span className="text-right">{formatDate(task.date_done || task.created_at)}</span>
                                            <span>{task.collaborator_company_name || task.clientName}</span>
                                            <span className="text-right font-black text-[var(--text-main)]">
                                                {formatCurrency((task.price || 0) * (task.quantity || 1))}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                            <Table className="w-full min-w-max">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead>{labels.task_title || "Trabajo"}</TableHead>
                                        <TableHead>{labels.client || "Cliente"}</TableHead>
                                        <TableHead>{labels.location_label || "Casa / ubicación"}</TableHead>
                                        <TableHead>{labels.col_date || "Fecha"}</TableHead>
                                        <TableHead className="text-right">{labels.price || "Importe"}</TableHead>
                                        <TableHead className="text-center">{labels.title || "Factura"}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tasks.map((task) => {
                                        const isSelected = selectedJobIdSet.has(task.id);
                                        const disabled = task.is_invoiced;
                                        return (
                                            <TableRow
                                                key={task.id}
                                                onClick={() => onToggleJob(task)}
                                                className={`${disabled ? "opacity-55" : "cursor-pointer"} ${isSelected ? "bg-accent/5" : ""}`}
                                            >
                                                <TableCell>
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                        isSelected
                                                            ? "bg-accent border-accent text-white"
                                                            : "border-[var(--border-color)] bg-[var(--bg-primary)]"
                                                    }`}>
                                                        {isSelected && <CheckSquare className="w-3 h-3" />}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-[var(--text-main)] text-xs">{task.title}</div>
                                                    <div className="text-2xs text-[var(--text-muted)]">{labels.quantity || "Cant."} {task.quantity || 1} {task.unit}</div>
                                                </TableCell>
                                                <TableCell className="text-xs text-[var(--text-muted)] font-medium">{task.clientName}</TableCell>
                                                <TableCell className="text-xs text-[var(--text-muted)]">{task.locationName}</TableCell>
                                                <TableCell className="text-xs text-[var(--text-muted)]">{formatDate(task.date_done || task.created_at)}</TableCell>
                                                <TableCell className="text-right text-xs font-black text-[var(--text-main)]">{formatCurrency((task.price || 0) * (task.quantity || 1))}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-black uppercase ${
                                                        task.is_invoiced
                                                            ? "bg-accent/10 text-accent border border-accent/20"
                                                            : "bg-neutral-500/10 text-[var(--text-muted)] border border-[var(--border-soft)]"
                                                    }`}>
                                                        {task.is_invoiced ? (labels.invoiced || "Facturado") : (labels.status_pending || "Pendiente")}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
