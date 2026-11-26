"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Layers3, MapPin, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {SearchableSelect} from "@/components/ui/searchable-select";
import {SearchableMultiSelect} from "@/components/ui/searchable-multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildWorkSpaceHierarchy, filterWorkSpaceHierarchy, indexTaskSpaceBranches, mergeWorkSpaceSelection, workSpaceBranches, type WorkSpaceNode } from "@/domain/locations/space-work-hierarchy";
import type { LocationSpace } from "@/types/location";
import type { SpaceAllocation, WorkforceChoices } from "@/services/service-planning.service";

const pending = "text-orange-700 dark:text-orange-300";
const configure = <Link className="underline underline-offset-2" href="/dashboard/locations">Configurar espacios y sus tareas</Link>;

type AllocationFieldsProps = { node: WorkSpaceNode; row: SpaceAllocation; choices: WorkforceChoices; disabled: boolean; update: (changes: Partial<SpaceAllocation>) => void };

function SpaceAllocationFields({ node, row, choices, disabled, update }: AllocationFieldsProps) {
    const [mode, setMode] = useState(row.crew_id ? "crew" : "people");
    const selectedTaskIds = new Set(row.task_ids);
    const configuredTaskIds = new Set(node.taskIds);
    const peopleById = useMemo(() => new Map(choices.people.map(person => [person.id, person])), [choices.people]);
    const people = useMemo(() => choices.people.filter(person => person.state !== "Baja"), [choices.people]);
    const availableEmployeeIds = useMemo(() => new Set(people.map(person => person.id)), [people]);
    const tasks = (node.space.tasks ?? []).filter(task => task.id && task.is_active !== false);
    const recorded = tasks.filter(task => selectedTaskIds.has(task.id!));
    const minutes = recorded.length && recorded.every(task => task.estimated_minutes && task.estimated_minutes > 0)
        ? recorded.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0) : null;
    const unavailable = row.task_ids.filter(id => !configuredTaskIds.has(id));
    const unavailablePeople = row.employee_ids.filter(id => !availableEmployeeIds.has(id));
    const crew = choices.crews.find(item => item.id === row.crew_id);
    const unassigned = mode === "crew" ? !crew || !crew.employee_ids.length : !row.employee_ids.length;
    return <fieldset disabled={disabled} className="space-y-4">
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Tareas incluidas</legend>
            {tasks.map(task => <label key={task.id} className="flex items-center gap-2 text-sm">
                <Checkbox disabled={disabled} aria-label={task.title} checked={selectedTaskIds.has(task.id!)} onCheckedChange={checked => update({ task_ids: checked === true ? [...new Set([...row.task_ids, task.id!])] : row.task_ids.filter(id => id !== task.id) })} />
                <span className="flex-1">{task.title}</span><span className={`text-xs ${task.estimated_minutes ? "text-muted-foreground" : pending}`}>{task.estimated_minutes ? `${task.estimated_minutes} min` : "Duración pendiente"}</span>
            </label>)}
            {!row.task_ids.length && <p className={`text-xs ${pending}`}>Selecciona al menos una tarea para este espacio.</p>}
            {!tasks.length && <p className={`text-xs ${pending}`}>{configure}</p>}
            {unavailable.length > 0 && <div className={`space-y-1 text-xs ${pending}`}><p>{unavailable.length} tareas seleccionadas ya no están disponibles.</p><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => update({ task_ids: row.task_ids.filter(id => configuredTaskIds.has(id)) })}>Retirar tareas no disponibles</Button></div>}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Asignar a</span><Select disabled={disabled} value={mode} onValueChange={next => { setMode(next); update({ crew_id: null, employee_ids: [] }); }}><SelectTrigger aria-label="Tipo de asignación"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="people">Trabajadores</SelectItem><SelectItem value="crew">Equipo de trabajo</SelectItem></SelectContent></Select></label>
            <label className="space-y-1 text-sm"><span>Esfuerzo previsto (minutos)</span><Input disabled={disabled} type="number" min="1" max="100000" step="1" value={row.planned_minutes ?? minutes ?? ""} placeholder="Completar duración" onChange={event => update({ planned_minutes: event.target.value ? Number(event.target.value) : null })} /></label>
        </div>
        {mode === "crew" ? <div className="space-y-2"><SearchableSelect disabled={disabled || !choices.crews.length} value={row.crew_id ? String(row.crew_id) : ""} onValueChange={id => update({ crew_id: Number(id), employee_ids: [] })} aria-label="Equipo de trabajo asignado" placeholder="Buscar equipo de trabajo…" options={choices.crews.map(item=>({value:String(item.id),label:item.name,description:item.employee_ids.length+" personas",disabled:!item.employee_ids.length}))}/>
            {!choices.crews.some(item => item.employee_ids.length > 0) && <p className={`text-xs ${pending}`}>No hay equipos con miembros. <Link className="underline" href="/dashboard/plantilla/equipos">Configurar equipos</Link></p>}
            {crew && <p className="text-xs text-muted-foreground">{crew.employee_ids.map(id => peopleById.get(id)?.name ?? `Trabajador #${id}`).join(" · ")}</p>}
        </div> : <div className="space-y-2"><p className="text-sm font-medium">Trabajadores de la empresa</p><SearchableMultiSelect aria-label="Trabajadores del espacio" value={row.employee_ids.map(String)} onValueChange={ids=>update({employee_ids:ids.map(Number)})} disabled={disabled} maxSelected={100} options={people.map(person=>({value:String(person.id),label:person.name,description:person.position}))} placeholder="Buscar y añadir trabajadores…"/>
            {!people.length && <p className={`text-xs ${pending}`}>No hay trabajadores disponibles. <Link className="underline" href="/dashboard/plantilla/trabajadores">Configurar plantilla</Link></p>}</div>}
        {unavailablePeople.length > 0 && <div className={`space-y-1 text-xs ${pending}`}><p>{unavailablePeople.length} trabajadores asignados ya no están disponibles.</p><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => update({ employee_ids: row.employee_ids.filter(id => availableEmployeeIds.has(id)) })}>Retirar asignaciones no disponibles</Button></div>}
        {unassigned && <p className={`text-xs ${pending}`}>Espacio pendiente de asignar.</p>}
        {!row.planned_minutes && !minutes && <p className={`text-xs ${pending}`}>Duración pendiente: completa el esfuerzo o los tiempos de las tareas.</p>}
        <p className="text-xs text-muted-foreground">El esfuerzo se reparte entre las personas elegidas. Cada trabajador tendrá su lista de tareas y su progreso individual.</p>
    </fieldset>;
}

export function SpaceWorkforceEditor({ spaces, value, onChange, choices, disabled = false }: { spaces: LocationSpace[]; value: SpaceAllocation[]; onChange: (value: SpaceAllocation[]) => void; choices: WorkforceChoices; disabled?: boolean }) {
    const [query, setQuery] = useState("");
    const [branchKey, setBranchKey] = useState("all");
    const [focus, setFocus] = useState<number | null>(null);
    const [limit, setLimit] = useState(50);
    const [selectionError, setSelectionError] = useState("");
    const nodes = useMemo(() => buildWorkSpaceHierarchy(spaces), [spaces]);
    const byId = useMemo(() => new Map(nodes.map(node => [node.space.id, node])), [nodes]);
    const taskBranches = useMemo(() => indexTaskSpaceBranches(nodes), [nodes]);
    const parentIds = useMemo(() => new Set(nodes.flatMap(node => node.ancestors.map(parent => parent.id))), [nodes]);
    const selected = new Map(value.map(row => [row.space_id, row]));
    const branches = useMemo(() => workSpaceBranches(nodes), [nodes]);
    const visible = useMemo(() => filterWorkSpaceHierarchy(nodes, query, branches.find(branch => branch.key === branchKey)), [nodes, query, branches, branchKey]);
    const candidates = visible.flatMap(item => item.matches && item.node.taskIds.length > 0 ? [item.node.space.id] : []);
    const current = visible.find(item => item.node.space.id === focus)?.node ?? visible.find(item => item.matches && selected.has(item.node.space.id))?.node ?? visible.find(item => item.matches)?.node;
    const row = current ? selected.get(current.space.id) : undefined;
    const currentBranch = current ? taskBranches.get(current.space.id) ?? [] : [];
    const stale = value.filter(item => !byId.has(item.space_id));
    const totalTasks = value.reduce((sum, item) => sum + item.task_ids.length, 0);
    const unconfigured = visible.filter(item => item.matches && !item.node.taskIds.length && !parentIds.has(item.node.space.id));
    const additionCount = candidates.filter(id => !selected.has(id)).length;
    const include = (ids: number[]) => {
        const additions = ids.flatMap(id => { const node = byId.get(id); return node?.taskIds.length ? [{ space_id: id, task_ids: node.taskIds, employee_ids: [], crew_id: null }] : []; });
        const next = mergeWorkSpaceSelection(value, additions);
        if (!next) { setSelectionError("Cada trabajo admite hasta 100 espacios. Selecciona una planta o una zona más pequeña."); return; }
        onChange(next); setSelectionError("");
    };
    const toggle = (node: WorkSpaceNode) => {
        setSelectionError("");
        if (selected.has(node.space.id)) onChange(value.filter(item => item.space_id !== node.space.id));
        else { include([node.space.id]); setFocus(node.space.id); }
    };
    const update = (changes: Partial<SpaceAllocation>) => { if (row) onChange(value.map(item => item.space_id === row.space_id ? { ...item, ...changes } : item)); };
    return <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><div><h3 className="font-semibold">Espacios, tareas y personas</h3><p className="text-xs text-muted-foreground">Selecciona únicamente la parte de la ubicación que se va a limpiar.</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{value.length} espacios · {totalTasks} tareas</span></header>
        {!nodes.length ? <div className={`space-y-2 p-4 text-sm ${pending}`}><p>Esta ubicación todavía no tiene espacios configurados.</p>{configure}</div> : <div className="grid md:grid-cols-[minmax(16rem,1fr)_2fr]">
            <div className="min-w-0 space-y-3 border-b p-3 md:border-b-0 md:border-r">
                <label className="flex items-center gap-2"><Search aria-hidden="true" size={16} /><Input aria-label="Buscar por planta, espacio o tarea" placeholder="Planta, sala, zona, tarea…" value={query} onChange={event => { setQuery(event.target.value); setLimit(50); }} /></label>
                {branches.length > 0 && <Select value={branches.some(branch => branch.key === branchKey) ? branchKey : "all"} onValueChange={key => { setBranchKey(key); setLimit(50); }}><SelectTrigger aria-label="Filtrar por planta o rama"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las plantas y zonas</SelectItem>{branches.map(branch => <SelectItem key={branch.key} value={branch.key}>{branch.label}</SelectItem>)}</SelectContent></Select>}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{candidates.length} espacios con tareas</span><Button type="button" size="sm" variant="outline" disabled={disabled || !additionCount || value.length + additionCount > 100} onClick={() => include(candidates)}>Añadir {additionCount} espacios</Button></div>
                <p className="text-xs text-muted-foreground">Añadir conserva las tareas y asignaciones que ya hayas preparado. Las plantas sin tareas propias solo agrupan espacios.</p>
                {value.length + additionCount > 100 && <p className={`text-xs ${pending}`}>Filtra por planta o zona. Cada trabajo admite hasta 100 espacios.</p>}
                {unconfigured.length > 0 && <p className={`text-xs ${pending}`}>{unconfigured.length} espacios sin tareas; no se añadirán al trabajo. {configure}</p>}
                <div className="max-h-96 space-y-1 overflow-y-auto" aria-label="Jerarquía de espacios">{visible.slice(0, limit).map(({ node, matches }) => {
                    const descendantIds = taskBranches.get(node.space.id) ?? [];
                    const descendantIdSet = new Set(descendantIds);
                    const container = !node.taskIds.length && descendantIds.length > 0;
                    const selectedCount = descendantIds.filter(id => selected.has(id)).length;
                    const checked = container ? selectedCount === descendantIds.length ? true : selectedCount ? "indeterminate" as const : false : selected.has(node.space.id);
                    return <div key={node.space.id} className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${current?.space.id === node.space.id ? "border-accent bg-accent/5" : "border-transparent hover:bg-muted/50"}`}>
                        <Checkbox disabled={disabled || !matches || (!node.taskIds.length && !container && !selected.has(node.space.id))} aria-label={container ? `Incluir los ${descendantIds.length} espacios con tareas de ${node.breadcrumb}` : `Incluir ${node.breadcrumb}`} checked={checked} onCheckedChange={next => container ? next === true ? include(descendantIds) : onChange(value.filter(item => item.space_id !== node.space.id && !descendantIdSet.has(item.space_id))) : toggle(node)} />
                        <Button variant="custom" type="button" aria-pressed={current?.space.id === node.space.id} className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setFocus(node.space.id)}>
                            {container ? <Layers3 aria-hidden="true" size={16} className="shrink-0 text-muted-foreground" /> : <MapPin aria-hidden="true" size={15} className="shrink-0 text-muted-foreground" />}
                            <span className="min-w-0 flex-1"><span className="block truncate text-[10px] text-muted-foreground" title={node.breadcrumb}>{node.breadcrumb}</span><span className="block truncate text-sm font-medium">{node.space.name}</span><small className={node.taskIds.length || container ? "text-muted-foreground" : pending}>{container ? `Grupo · ${descendantIds.length} espacios con tareas` : `${node.taskIds.length} tareas configuradas`}</small></span><ChevronRight aria-hidden="true" size={14} className="shrink-0" />
                        </Button>
                    </div>;
                })}</div>
                {!visible.length && <p className="py-3 text-sm text-muted-foreground">No hay espacios que coincidan con la búsqueda.</p>}
                {visible.length > limit && <Button type="button" size="sm" variant="ghost" onClick={() => setLimit(number => number + 50)}>Mostrar más espacios</Button>}
            </div>
            <div className="min-w-0 space-y-4 p-4">{current && <>
                <div><p className="mb-1 text-xs text-muted-foreground">{current.breadcrumb}</p><h4 className="font-semibold">{current.space.name}</h4><p className="text-xs text-muted-foreground">{row ? "Configura el alcance y el equipo de este espacio." : current.taskIds.length ? "Marca este espacio para incluirlo en el trabajo." : "Esta planta o zona agrupa espacios; selecciona únicamente los que tienen tareas."}</p></div>
                {currentBranch.length > (current.taskIds.length ? 1 : 0) && <Button type="button" variant="outline" disabled={disabled || currentBranch.every(id => selected.has(id))} onClick={() => include(currentBranch)}>Incluir {currentBranch.length} espacios con tareas de esta rama</Button>}
                {row ? <><SpaceAllocationFields key={current.space.id} node={current} row={row} choices={choices} disabled={disabled} update={update} /><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange(value.filter(item => item.space_id !== current.space.id))}>Quitar este espacio del trabajo</Button></> : current.taskIds.length ? <Button type="button" disabled={disabled} variant="outline" onClick={() => toggle(current)}>Incluir este espacio</Button> : !currentBranch.length ? <div className={`space-y-2 text-sm ${pending}`}><p>Este espacio no tiene tareas activas configuradas.</p>{configure}</div> : <p className="text-sm text-muted-foreground">Selecciona un espacio de esta rama para ajustar sus tareas, duración y personas.</p>}
            </>}</div>
        </div>}
        {stale.length > 0 && <div className={`space-y-2 border-t p-3 text-xs ${pending}`}><p>{stale.length} espacios seleccionados ya no están disponibles. Revisa el alcance antes de guardar.</p><Button type="button" disabled={disabled} size="sm" variant="outline" onClick={() => onChange(value.filter(item => byId.has(item.space_id)))}>Retirar espacios no disponibles</Button></div>}
        {selectionError && <p role="alert" className={`border-t p-3 text-xs ${pending}`}>{selectionError}</p>}
    </section>;
}
