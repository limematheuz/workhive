"use client";

import { Fragment, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { locationTaskEstimate } from "@/domain/locations/location-setup";
import type { LocationSpace } from "@/types/location";

function estimateLabel(estimate: ReturnType<typeof locationTaskEstimate>) {
    if (!estimate.tasks) return "—";
    if (!estimate.unestimated) return `${estimate.minutes} min`;
    return estimate.minutes ? `${estimate.minutes} min · parcial` : "Sin estimar";
}

export function LocationSpaceBreakdown({ spaces }: { spaces: LocationSpace[] }) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const id = useId();
    if (!spaces.length) return <p className="text-sm text-[var(--text-muted)]">Todavía no hay espacios configurados.</p>;
    const total = locationTaskEstimate(spaces);

    return <div className="space-y-3">

        <Table className="wh-location-task-table w-full table-fixed [&_td]:!whitespace-normal [&_th]:!whitespace-normal">
            <caption className="sr-only">Espacios, tareas asociadas y tiempo estimado por espacio</caption>
            <TableHeader><TableRow><TableHead scope="col" className="w-1/2">Espacio / planta</TableHead><TableHead scope="col" className="w-1/5">Tareas</TableHead><TableHead scope="col">Tiempo estimado</TableHead></TableRow></TableHeader>
            <TableBody>{spaces.map((space, index) => {
                const estimate = locationTaskEstimate([space]);
                const open = expanded.has(index);
                const floor = space.attributes?.floor || (space.attributes?.shared_space ? "Compartido" : "Sin planta");
                return <Fragment key={space.id ?? space.name}>
                    <TableRow>
                        <TableCell className="break-words">
                            <Button type="button" variant="ghost" className="h-auto max-w-full justify-start gap-2 whitespace-normal p-0 text-left" aria-expanded={open} aria-controls={`${id}-${index}`} onClick={() => setExpanded(previous => {
                                const next = new Set(previous);
                                if (next.has(index)) next.delete(index); else next.add(index);
                                return next;
                            })}>
                                <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                                <span className="min-w-0"><span className="block font-semibold">{space.name}</span><span className="mt-1 block text-[11px] font-normal text-[var(--text-muted)]">{String(floor)}</span></span>
                            </Button>
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums text-accent">{estimate.tasks}</TableCell>
                        <TableCell className="break-words tabular-nums">{estimateLabel(estimate)}{estimate.unestimated > 0 && <span className="mt-1 block text-[11px] text-[var(--text-muted)]">{estimate.unestimated} sin estimar</span>}</TableCell>
                    </TableRow>
                    <TableRow id={`${id}-${index}`} hidden={!open}>
                        <TableCell colSpan={3} className="bg-[var(--bg-secondary)]">
                            {estimate.tasks ? <ul className="divide-y divide-[var(--border-soft)]" aria-label={`Tareas de ${space.name}`}>
                                {space.tasks?.flatMap(task => task.is_active === false ? [] : [<li key={task.id ?? task.title} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2 text-xs">
                                    <span className="break-words font-medium">{task.title}</span><span className="tabular-nums">{task.estimated_minutes == null ? "Sin estimar" : `${task.estimated_minutes} min`}</span>
                                    <span className="text-[var(--text-muted)]">{task.frequency || "Frecuencia sin definir"}</span>
                                </li>])}
                            </ul> : <p className="py-2 text-xs text-[var(--text-muted)]">Sin tareas seleccionadas.</p>}
                        </TableCell>
                    </TableRow>
                </Fragment>;
            })}</TableBody>
        </Table>
        <div className="wh-stat-row" aria-label="Totales de la ubicación">
            <div><strong>{spaces.length}</strong><span>espacios en total</span></div>
            <div><strong>{total.tasks}</strong><span>tareas asociadas</span></div>
            <div><strong>{total.unestimated && !total.minutes ? "—" : total.minutes}</strong><span>{total.unestimated ? `min conocidos · ${total.unestimated} ${total.unestimated === 1 ? "tarea" : "tareas"} sin estimar` : "minutos estimados en total"}</span></div>
        </div>
    </div>;
}
