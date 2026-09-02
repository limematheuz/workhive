"use client";

import { BriefcaseBusiness, Loader2, Receipt, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { InvoiceableTask as InvoiceableJob } from "@/services/invoice.service";
import type { Client } from "@/services/client.service";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatHoursShort } from "@/lib/format-hours";
import {
    formatWorkerHoursLine,
    resolveTaskInvoiceAmount,
    resolveTaskInvoiceBilling,
    resolveTaskPersonSeconds,
} from "@/lib/task-invoice-billing";
import { cn } from "@/lib/utils";

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

function JobMobileCard({
    task,
    selected,
    disabled,
    onToggle,
    labels,
}: {
    task: InvoiceableTask;
    selected: boolean;
    disabled: boolean;
    onToggle: () => void;
    labels: InvoiceableJobsSectionProps["labels"];
}) {
    const billing = resolveTaskInvoiceBilling(task);
    const amount = resolveTaskInvoiceAmount(task);
    const personSeconds = resolveTaskPersonSeconds(task);
    const workersLine = formatWorkerHoursLine(task.workers, formatHoursShort);
    const quantityLabel = task.pricing_mode === "hourly"
        ? `${formatHoursShort(personSeconds)} × ${formatCurrency(billing.unitPrice)}/h`
        : `${labels.quantity || "Cant."} ${billing.quantity} ${task.unit}`;
    const hoursLabel = personSeconds > 0
        ? `Horas-persona ${formatHoursShort(personSeconds)}`
        : null;

    return (
        <Card
            className={cn(
                "min-w-0 transition-colors",
                selected && "border-accent/60 bg-accent/5 ring-1 ring-accent/35",
                disabled && "opacity-55",
            )}
        >
            <CardContent className="flex min-w-0 gap-3 p-4">
                <Checkbox
                    className="mt-0.5"
                    checked={selected}
                    disabled={disabled}
                    onCheckedChange={() => onToggle()}
                    aria-label={`${selected ? "Quitar" : "Seleccionar"} ${task.title}`}
                />
                <button
                    type="button"
                    disabled={disabled}
                    onClick={onToggle}
                    aria-pressed={selected}
                    className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    aria-label={`${selected ? "Quitar" : "Seleccionar"} ${task.title}`}
                >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text-main)]">{task.title}</p>
                            <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{task.clientName}</p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-xs text-[var(--text-muted)]">{formatDate(task.date_done || task.created_at)}</p>
                            <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(amount)}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-[var(--border-soft)] pt-3">
                        <Badge variant="outline" className={task.is_invoiced ? "border-accent/30 bg-accent/10 text-accent" : "border-[var(--border-soft)] bg-[var(--bg-primary)]/55 text-[var(--text-muted)]"}>
                            {task.is_invoiced ? (labels.invoiced || "Facturado") : (labels.status_pending || "Pendiente")}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-muted)]">{task.locationName}</span>
                    </div>
                    <p className="mt-2 truncate text-xs text-[var(--text-muted)]">
                        {quantityLabel}{hoursLabel ? ` · ${hoursLabel}` : ""}{workersLine ? ` · ${workersLine}` : ""}
                    </p>
                </button>
            </CardContent>
        </Card>
    );
}

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
    const hasFilters = Boolean(search || partyFilter || invoiceFilter !== "pending" || dateFrom || dateTo);

    const resetFilters = () => {
        onSearchChange("");
        onPartyFilterChange("");
        onInvoiceFilterChange("pending");
        onDateFromChange("");
        onDateToChange("");
    };

    return (
        <div className="space-y-4">
            <section className="billing-surface rounded-[22px] p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-main)]">
                            <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
                            {labels.jobs_title || "Trabajos completados"}
                        </h2>
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                            {labels.jobs_subtitle || "Selecciona varios trabajos del mismo cliente y genera una única factura."}
                        </p>
                    </div>
                    <Button
                        type="button"
                        disabled={selectedCount === 0}
                        onClick={onCreateInvoice}
                        size="lg"
                        className="w-full sm:w-auto"
                    >
                        <Receipt className="h-4 w-4" />
                        {labels.create_invoice_with_count
                            ? labels.create_invoice_with_count.replace("{count}", selectedCount.toString())
                            : `Crear factura con ${selectedCount}`}
                    </Button>
                </div>

                <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            <SlidersHorizontal className="h-4 w-4 text-[var(--btn-secondary-text)]" aria-hidden="true" />
                            Buscar y filtrar
                        </div>
                        {hasFilters && (
                            <Button type="button" variant="secondary" size="xs" onClick={resetFilters}>
                                <RotateCcw />
                                Restablecer
                            </Button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                        <div className="relative block md:col-span-2">
                            <span className="sr-only">{labels.search_jobs_placeholder || "Buscar por trabajo, cliente o casa..."}</span>
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                            <Input
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                placeholder={labels.search_jobs_placeholder || "Buscar por trabajo, cliente o casa..."}
                                className="h-11 w-full rounded-xl pl-10 pr-3 text-sm"
                            />
                        </div>
                        <div className="block">
                            <span className="sr-only">{labels.filter_all_parties || "Todos los clientes y colaboradores"}</span>
                            <Select
                                value={partyFilter}
                                onValueChange={(value) => onPartyFilterChange(value === "__all-parties__" ? "" : value)}
                            >
                                <SelectTrigger aria-label={labels.filter_all_parties || "Todos los clientes y colaboradores"} className="h-11 w-full rounded-xl px-3 text-sm font-semibold">
                                    <SelectValue placeholder={labels.filter_all_parties || "Todos los clientes y colaboradores"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all-parties__">{labels.filter_all_parties || "Todos los clientes y colaboradores"}</SelectItem>
                                    {clients.map((c) => (
                                        <SelectItem key={c.id} value={`client:${c.id}`}>{c.name}</SelectItem>
                                    ))}
                                    {collaboratorOptions.map(([id, name]) => (
                                        <SelectItem key={id} value={`collaborator:${id}`}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="block">
                            <span className="sr-only">Filtrar por estado de facturación</span>
                            <Select
                                value={invoiceFilter}
                                onValueChange={(value) => onInvoiceFilterChange(value as "all" | "pending" | "invoiced")}
                            >
                                <SelectTrigger aria-label="Filtrar por estado de facturación" className="h-11 w-full rounded-xl px-3 text-sm font-semibold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">{labels.filter_uninvoiced_jobs || "Pendientes de facturar"}</SelectItem>
                                    <SelectItem value="invoiced">{labels.filter_invoiced_jobs || "Ya facturados"}</SelectItem>
                                    <SelectItem value="all">{labels.filter_all_jobs || "Todos"}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="block min-w-0">
                                <span className="sr-only">Fecha desde</span>
                                <DatePicker
                                    aria-label="Fecha desde"
                                    value={dateFrom}
                                    onValueChange={onDateFromChange}
                                    className="h-11 w-full min-w-0 rounded-xl text-sm"
                                />
                            </div>
                            <div className="block min-w-0">
                                <span className="sr-only">Fecha hasta</span>
                                <DatePicker
                                    aria-label="Fecha hasta"
                                    value={dateTo}
                                    onValueChange={onDateToChange}
                                    className="h-11 w-full min-w-0 rounded-xl text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="billing-surface w-full overflow-hidden rounded-[22px]">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-accent" />
                        <span className="text-xs text-[var(--text-muted)]">{labels.jobs_loading || "Loading jobs..."}</span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                        <BriefcaseBusiness className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                        <p className="mt-3 text-sm text-[var(--text-muted)]">{labels.empty_jobs || "No jobs found with these filters."}</p>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-2.5 p-3 md:hidden">
                            {tasks.map((task) => (
                                <JobMobileCard
                                    key={task.id}
                                    task={task}
                                    selected={selectedJobIdSet.has(task.id)}
                                    disabled={task.is_invoiced}
                                    onToggle={() => onToggleJob(task)}
                                    labels={labels}
                                />
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto p-3 md:block">
                            <Table className="min-w-[940px] table-fixed text-left">
                                <colgroup><col className="w-12" /><col className="w-[29%]" /><col className="w-[16%]" /><col className="w-[20%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[11%]" /></colgroup>
                                <TableHeader><TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]"><TableHead aria-hidden="true" /><TableHead>{labels.task_title || "Trabajo"}</TableHead><TableHead>{labels.client || "Cliente"}</TableHead><TableHead>{labels.location_label || "Casa / ubicación"}</TableHead><TableHead>{labels.col_date || "Fecha"}</TableHead><TableHead className="text-right">{labels.price || "Importe"}</TableHead><TableHead className="text-center">{labels.title || "Factura"}</TableHead></TableRow></TableHeader>
                                <TableBody>{tasks.map((task) => {
                                    const selected = selectedJobIdSet.has(task.id);
                                    const billing = resolveTaskInvoiceBilling(task);
                                    const amount = resolveTaskInvoiceAmount(task);
                                    const personSeconds = resolveTaskPersonSeconds(task);
                                    const workersLine = formatWorkerHoursLine(task.workers, formatHoursShort);
                                    const quantity = task.pricing_mode === "hourly" ? `${formatHoursShort(personSeconds)} × ${formatCurrency(billing.unitPrice)}/h` : `${labels.quantity || "Cant."} ${billing.quantity} ${task.unit}`;
                                    return <TableRow key={task.id} onClick={() => !task.is_invoiced && onToggleJob(task)} className={cn("border-0 bg-transparent", task.is_invoiced ? "opacity-55" : "cursor-pointer hover:bg-[var(--bg-secondary)]/45", selected && "bg-accent/5")}><TableCell onClick={(event) => event.stopPropagation()}><Checkbox checked={selected} disabled={task.is_invoiced} onCheckedChange={() => onToggleJob(task)} aria-label={`${selected ? "Quitar" : "Seleccionar"} ${task.title}`} /></TableCell><TableCell><p className="truncate text-sm font-semibold text-[var(--text-main)]">{task.title}</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{quantity}{personSeconds > 0 ? ` · Horas-persona ${formatHoursShort(personSeconds)}` : ""}</p>{workersLine && <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{workersLine}</p>}</TableCell><TableCell className="truncate text-sm text-[var(--text-muted)]">{task.clientName}</TableCell><TableCell className="truncate text-sm text-[var(--text-muted)]">{task.locationName}</TableCell><TableCell className="text-sm text-[var(--text-muted)]">{formatDate(task.date_done || task.created_at)}</TableCell><TableCell className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(amount)}</TableCell><TableCell className="text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${task.is_invoiced ? "bg-accent/10 text-accent" : "bg-[var(--bg-primary)] text-[var(--text-muted)]"}`}>{task.is_invoiced ? (labels.invoiced || "Facturado") : (labels.status_pending || "Pendiente")}</span></TableCell></TableRow>;
                                })}</TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
