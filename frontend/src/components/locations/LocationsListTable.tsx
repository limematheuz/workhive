"use client"

import type { ReactNode } from "react"
import { ListChecks, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination"
import { useDictionary } from "@/lib/dictionary-context"
import type { Location } from "@/services/location.service"
import type { TaskItem } from "@/services/task.service"
import { getLocationTypeVisual } from "./location-visuals"

type Props = {
    locations: Location[]
    tasks: TaskItem[]
    getClientName: (id?: number | null) => string
    renderActions: (location: Location) => ReactNode
    onOpen: (location: Location) => void
}

export function LocationsListTable({ locations, tasks, getClientName, renderActions, onOpen }: Props) {
    const { dict, locale } = useDictionary()
    const workspace = dict.locations.workspace
    const pagination = useDataTablePagination(locations, 10)
    const statusBadge = (location: Location) => <Badge variant="secondary" className={`shrink-0 whitespace-nowrap text-[11px] ${location.is_active ? "border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-text)]" : ""}`}>{location.is_active ? dict.locations.table.active : dict.locations.table.inactive}</Badge>

    return <section className="@container/locations-list overflow-hidden rounded-xl border border-[var(--border-soft)]">
        {locations.length === 0 ? <div className="flex flex-col items-center gap-3 px-5 py-12 text-center"><MapPin className="h-6 w-6 text-accent" /><p className="text-sm text-[var(--text-muted)]">{dict.locations.table.empty}</p></div> : <Table className="table-fixed">
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] @min-[800px]/locations-list:w-[32%]">{dict.locations.title}</TableHead>
                    <TableHead className="hidden w-[25%] px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] @min-[800px]/locations-list:table-cell">{dict.locations.form.client_label}</TableHead>
                    <TableHead className="hidden w-20 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] @min-[650px]/locations-list:table-cell">Total</TableHead>
                    <TableHead className="hidden w-[110px] px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] @min-[650px]/locations-list:table-cell">{workspace.pending_tasks}</TableHead>
                    <TableHead className="hidden w-[100px] px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] @min-[650px]/locations-list:table-cell">{dict.locations.table.status}</TableHead>
                    <TableHead className="w-12"><span className="sr-only">{locale === "es" ? "Acciones" : "Actions"}</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pagination.pageItems.map(location => {
                    const work = tasks.filter(task => task.location_id === location.id)
                    const pending = work.filter(task => task.status !== "completed").length
                    const visual = getLocationTypeVisual(location.profile?.site_type)
                    const Icon = visual.icon
                    const taskLabel = work.length === 1 ? (locale === "es" ? "tarea" : "task") : workspace.tasks
                    const pendingLabel = pending === 1 && locale === "es" ? "pendiente" : workspace.pending_tasks
                    return <TableRow key={location.id} tabIndex={0} aria-label={workspace.view_location.replace("{name}", location.name)} onClick={() => onOpen(location)} onKeyDown={event => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                            event.preventDefault()
                            onOpen(location)
                        }
                    }} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40">
                        <TableCell className="whitespace-normal px-4 py-3 align-top">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${visual.className}`}><Icon className="h-4 w-4" /></span>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="min-w-0 break-words text-sm font-semibold text-[var(--text-main)]">{location.name}</p>
                                    <p className="break-words text-xs text-[var(--text-muted)] @min-[800px]/locations-list:hidden">{getClientName(location.client_id)}</p>
                                    <div className="flex flex-wrap items-center gap-2 pt-1 @min-[650px]/locations-list:hidden">
                                        <span className="text-xs text-[var(--text-muted)]">{work.length} {taskLabel} · {pending} {pendingLabel}</span>
                                        {statusBadge(location)}
                                    </div>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="hidden whitespace-normal px-3 py-3 text-xs text-[var(--text-muted)] @min-[800px]/locations-list:table-cell"><span className="break-words">{getClientName(location.client_id)}</span></TableCell>
                        <TableCell className="hidden px-3 py-3 @min-[650px]/locations-list:table-cell">
                            <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums"><ListChecks className="h-3.5 w-3.5 shrink-0 text-accent" />{work.length}</div>
                        </TableCell>
                        <TableCell className="hidden px-3 py-3 text-xs font-medium tabular-nums @min-[650px]/locations-list:table-cell">{pending}</TableCell>
                        <TableCell className="hidden px-3 py-3 @min-[650px]/locations-list:table-cell">{statusBadge(location)}</TableCell>
                        <TableCell className="px-2 py-3 text-right align-top">{renderActions(location)}</TableCell>
                    </TableRow>
                })}
            </TableBody>
        </Table>}
        <DataTablePagination page={pagination.page} totalItems={locations.length} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} summary={`${locations.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, locations.length)} de ${locations.length} resultados`} rowsPerPageLabel="Filas por página" previousLabel="Página anterior" nextLabel="Página siguiente" />
    </section>
}
