import { Button } from "@/components/ui/button";
import type {StaffRoster} from "@/domain/tasks/overview-staff-roster";
import { useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";

import { groupOverviewLocations, taskWorkers, type OperationsOverview } from "@/domain/tasks/operations-overview";
import { parseTaskCalendarDate, isTaskDateOnlyValue } from "@/domain/tasks/task-schedule";
import type { TaskItem } from "@/types/user";
import type { OverviewTaskPresentation } from "./OverviewAgenda";
import { formatOverviewDate } from "./overview-format";


const warning = "font-medium text-orange-800 dark:text-orange-300";

function spaceRows(tasks: TaskItem[],roster:StaffRoster[]) {
    const spaces = new Map<string, Map<number | null, { name: string | null; total: number; done: number }>>();
    for (const task of tasks) {
        const staff=roster.filter(row=>row.task_id===task.id);
        if(staff.some(person=>person.space_progress?.length)){
            const included=new Set<number>();
            for(const person of staff)for(const step of person.space_progress??[]){
                for(const id of step.checklist_ids??[])included.add(id);
                const workers=spaces.get(step.space_name)??new Map<number|null,{name:string|null;total:number;done:number}>();
                const id=person.effective_employee_id===null?null:-person.effective_employee_id;
                const row=workers.get(id)??{name:person.employee_name,total:0,done:0};
                row.total+=step.total;row.done+=step.done;workers.set(id,row);spaces.set(step.space_name,workers);
            }
            for(const item of task.checklist_items??[]){
                const name=item.space_name??"";if(included.has(item.id))continue;
                const workers=spaces.get(name)??new Map<number|null,{name:string|null;total:number;done:number}>();
                const row=workers.get(null)??{name:null,total:0,done:0};row.total++;if(item.completed)row.done++;workers.set(null,row);spaces.set(name,workers);
            }
            continue;
        }
        if(staff.length){
            const lines=task.checklist_items||[];
            const names=new Set(lines.map(line=>line.space_name?.trim()||task.spaces?.map(space=>space.name).join(" / ")||""));
            if(!names.size)names.add(task.spaces?.map(space=>space.name).join(" / ")||"");
            for(const name of names){
                const rows=spaces.get(name)??new Map<number|null,{name:string|null;total:number;done:number}>();
                for(const person of staff){
                    const id=person.effective_employee_id===null?null:-(person.effective_employee_id);
                    const row=rows.get(id)??{name:person.employee_name,total:0,done:0};
                    for(const line of lines){
                        if((line.space_name?.trim()||task.spaces?.map(space=>space.name).join(" / ")||"")!==name)continue;
                        const assigned=person.account_user_id!=null&&((line.assignments||[]).some(a=>a.user_id===person.account_user_id&&a.status!=="cancelled"&&a.status!=="rejected")||(!(line.assignments||[]).length&&taskWorkers(task).some(w=>w.id===person.account_user_id)));
                        if(assigned){row.total++;if(line.completed)row.done++;}
                    }
                    rows.set(id,row);
                }
                spaces.set(name,rows);
            }
            continue;
        }
        const zones = (task.spaces?.length ? task.spaces : task.zones) || [];
        const place = zones.map(z => z.name).join(" / ");
        const workers = taskWorkers(task);
        const lines = task.checklist_items || [];
        const units = lines.length ? lines.map(line => {
            const assignments = line.assignments || [];
            const direct = workers.filter(w => (task.assignments || []).some(a => a.user_id === w.id && a.source !== "checklist" && a.status !== "rejected" && a.status !== "cancelled") || (task.user_id === w.id && !task.assignments?.some(a => a.user_id === w.id && a.source === "checklist")));
            return { space: line.space_name?.trim() || place, done: line.completed, workers: assignments.length ? assignments.flatMap(a => a.status !== "cancelled" && a.status !== "rejected" ? [{id:a.user_id,name:a.user_name}] : []) : direct };
        }) : [{ space: place, done: task.status === "completed", workers }];
        for (const u of units) {
            const rows = spaces.get(u.space) ?? new Map<number | null, {name:string | null; total:number; done:number}>();
            for (const [id,name] of new Map(u.workers.length ? u.workers.map(w => [w.id,w.name] as const) : [[null,null] as const])) {
                const row = rows.get(id) ?? {name,total:0,done:0};
                row.total++; if (u.done) row.done++; rows.set(id,row);
            }
            spaces.set(u.space,rows);
        }
    }
    return spaces;
}

export function OverviewLocations({ data, presentation: p, day, onOpen,roster=[] }: {
    roster?:StaffRoster[];data: OperationsOverview; presentation: OverviewTaskPresentation; day: Date; onOpen: (task:TaskItem) => void;
}) {
    const [id,setId] = useState<number | null>(null);
    const en = p.locale === "en";
    const t = (es:string, eng:string) => en ? eng : es;
    const groups = groupOverviewLocations(data.planned);
    for(const row of roster)if(!groups.some(group=>group.locationId===row.location_id))groups.push({locationId:row.location_id,tasks:[],workers:new Map(),completed:0,unassigned:0});
    const selected = groups.find(g => g.locationId === id) || groups[0];
    const name = (n:number) => p.locationName(n);
    const time = (value?:string | null) => {
        const date = value && parseTaskCalendarDate(value);
        return date && value && !isTaskDateOnlyValue(value) && !/^\d{4}-\d{2}-\d{2}$/.test(value) ? formatOverviewDate(date,p.locale,"time") : null;
    };
    return <section className="wh-overview-panel" aria-labelledby="overview-locations-title">
        <header className="wh-overview-section-heading flex-wrap gap-2"><div><h2 id="overview-locations-title">{p.c.locationsWithWork} <span className="wh-overview-heading-count">{groups.length}</span></h2><p>{t("Selecciona una ubicación para ver el reparto del trabajo.","Select a location to see the work allocation.")}</p></div></header>
        {!selected ? <div className="wh-overview-empty"><MapPin aria-hidden="true"/><p>{p.c.noLocationsWork}</p></div> : <div className="grid items-start gap-3 p-3 md:grid-cols-[minmax(12rem,1fr)_2fr]">
        <div className="grid max-h-72 gap-1 overflow-auto">{groups.map(g => <Button unstyled key={g.locationId} type="button" aria-pressed={g === selected} onClick={() => setId(g.locationId)} className="flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm aria-pressed:border-accent aria-pressed:bg-[var(--brand-blue-soft)]"><MapPin size={15}/><span className="flex-1 font-semibold">{name(g.locationId)}</span><span className={g.completed < g.tasks.length ? warning : ""}>{g.completed}/{g.tasks.length}</span><ChevronRight size={14}/></Button>)}</div>
        <article className="min-w-0 rounded-lg border p-3 text-sm"><h3 className="font-semibold">{name(selected.locationId)}</h3><p className="mb-2 text-xs text-[var(--text-muted)]">{t("Por espacio y trabajador · tareas completadas / asignadas","By space and worker · completed / assigned tasks")}</p>
        {[...spaceRows(selected.tasks,roster)].map(([space,rows]) => <div key={space} className="grid gap-1 border-t py-2 sm:grid-cols-[1fr_2fr]"><strong className={space ? "" : warning}>{space || t("Espacio sin indicar","Space missing")}</strong><div>{[...rows].map(([worker,r]) => <div key={worker ?? "none"} className="flex justify-between gap-2"><span className={worker == null ? warning : ""}>{worker == null ? p.c.unassigned : worker<0?r.name:p.workerName(worker,r.name)}</span><span className={r.total===0||r.done < r.total ? warning : ""}>{r.done}/{r.total}</span></div>)}</div></div>)}
        {roster.flatMap(row=>row.location_id===selected.locationId?[<p key={row.id} className={row.effective_employee_id===null?warning:"text-xs py-1"}>{row.employee_name??t("Turno sin cubrir","Uncovered shift")} · {formatOverviewDate(new Date(row.starts_at),p.locale,"time")} – {formatOverviewDate(new Date(row.ends_at),p.locale,"time")}{row.account_user_id===null&&<span className={warning}> · {t("Sin acceso vinculado; seguimiento por responsable","No linked access; supervisor tracks tasks")}</span>}{!row.task_id&&<span className={warning}> · {t("Trabajo pendiente de vincular","Work link missing")}</span>}</p>]:[])}
        <h4 className="mt-2 border-t pt-2 font-semibold">{t("Horario de trabajo","Work schedule")}</h4>{selected.tasks.map(task => <div key={task.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1 text-xs">{<Button unstyled type="button" onClick={() => onOpen(task)} className="text-left underline decoration-dotted">{task.title}</Button>}<span>{formatOverviewDate(parseTaskCalendarDate(task.scheduled_start_at || task.due_at || "") || day,p.locale,"short")} · <span className={!time(task.scheduled_start_at) ? warning : ""}>{time(task.scheduled_start_at) || t("Inicio pendiente","Start missing")}</span> – <span className={!time(task.due_at) ? warning : ""}>{time(task.due_at) || t("Fin pendiente","End missing")}</span></span></div>)}</article></div>}
    </section>;
}
