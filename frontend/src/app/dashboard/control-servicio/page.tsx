"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canApproveTime, canManageCompanyTasks, canManageTime, canViewLaborCosts } from "@/domain/access/roles";
import { useUser } from "@/lib/user-context";
import { changeServiceHours, approvedHoursExportHref, readServiceHours, type ServiceHours } from "@/services/service-hours.service";

const pendingStyle = "font-medium text-orange-800 dark:text-orange-300";

function duration(minutes: number | null) {
    if (minutes === null) return <span className={pendingStyle}>Sin registrar</span>;
    const rounded = Math.round(minutes);
    return Math.floor(rounded / 60) + " h " + String(rounded % 60).padStart(2, "0") + " min";
}

export default function ServiceControl() {
    const {user}=useUser();
    return <ServiceControlWorkspace key={`${user?.id}:${user?.company_id}`}/>;
}
function ServiceControlWorkspace() {
    const { user, loading } = useUser();
    const [query,setQuery]=useState("");
    const [filter,setFilter]=useState("");
    const [rows, setRows] = useState<ServiceHours[]>([]);
    const [page, setPage] = useState(0);
    const [more, setMore] = useState(false);
    const [version, refresh] = useState(0);
    const [error, setError] = useState("");
    const [fetching, setFetching] = useState(true);
    const [busy, setBusy] = useState(false);
    const [edit, setEdit] = useState<number | null>(null);
    const [minutes, setMinutes] = useState("");
    const [exportMonth, setExportMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const allowed = canManageTime(user);

    useEffect(() => {
        let active = true;
        if (!allowed) return;
        readServiceHours(page * 100).then(result => {
            if (active) {
                setRows(result.items);
                setMore(result.has_more);
            }
        }).catch(e => {
            if (active) {
                setError(e.message);
                setRows([]);
                setMore(false);
            }
        }).finally(() => {
            if (active) setFetching(false);
        });
        return () => { active = false; };
    }, [page, version, allowed, user?.company_id]);

    async function save(row: ServiceHours, action: "contract" | "approval") {
        setBusy(true);
        setError("");
        try {
            const payload = action === "contract" ? { minutes: Number(minutes) } : { signature: row.signature };
            await changeServiceHours(row.id, action, payload);
            setFetching(true);
            setEdit(null);
            refresh(v => v + 1);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar.");
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <p>Cargando…</p>;
    if (!allowed) return <p>Acceso restringido.</p>;
    return <div className="dashboard-page-content space-y-3">
        <PageHeader icon={Clock3} title="Control del servicio"
            subtitle="Horas de personal por tarea. Las realizadas descuentan las pausas y cuentan únicamente fichajes cerrados."
            actions={<Button variant="outline" disabled={fetching || busy} onClick={() => {setFetching(true);setError("");setEdit(null);refresh(v => v + 1);}}>Actualizar</Button>} />
        {canViewLaborCosts(user) && <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">Mes de cierre del fichaje (UTC)
                <Input required type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)} />
            </label>
            {/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(exportMonth) &&
                <a className={buttonVariants({variant:"outline"})} href={approvedHoursExportHref(exportMonth)} download>Exportar horas aprobadas</a>}
        </div>}
        {!fetching && !error && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[{key:"approval",label:"Pendientes de aprobación",count:rows.filter(row=>row.approved_seconds===null&&row.can_close).length},{key:"contract",label:"Contratadas sin registrar",count:rows.filter(row=>row.contract_minutes===null).length},{key:"difference",label:"Plan / contrato diferente",count:rows.filter(row=>row.contract_minutes!==null&&row.planned_minutes!==null&&row.contract_minutes!==row.planned_minutes).length}].map(metric=><button key={metric.key} type="button" aria-pressed={filter===metric.key} className="rounded-xl border bg-card p-3 text-left focus-visible:outline-2 focus-visible:outline-accent" onClick={()=>setFilter(filter===metric.key?"":metric.key)}><span className="text-xs text-muted-foreground">{metric.label}</span><strong className="mt-1 block text-2xl font-semibold">{metric.count}</strong></button>)}</div>}
        <p className="text-xs text-muted-foreground">Comparación de los {rows.length} trabajos de esta página, sin restricción de fecha. El mes sólo afecta a la exportación de horas aprobadas.</p>
        <Input type="search" aria-label="Buscar servicio en esta página" placeholder="Buscar servicio en esta página…" value={query} onChange={event=>setQuery(event.target.value)}/>
        {filter && <Button variant="ghost" size="sm" onClick={()=>setFilter("")}>Quitar filtro de revisión</Button>}
        {error && <p role="alert" className={pendingStyle}>{error}</p>}
        <div className="overflow-x-auto rounded-lg border" aria-busy={fetching}>
            <table className="w-full text-left text-sm">
                <thead className="bg-muted/50"><tr>
                    {["Tarea", "Contratadas", "Planificadas", "Realizadas", "Aprobadas", "Acciones"].map(label =>
                        <th scope="col" className="px-3 py-2" key={label}>{label}</th>)}
                </tr></thead>
                <tbody>
                    {fetching || (!rows.length && !error) ? <tr><td colSpan={6} className="p-4 text-center">
                        {fetching ? "Cargando horas…" : "Sin trabajos en esta página."}
                    </td></tr> : rows.filter(row=>row.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&(filter!=="approval"||row.approved_seconds===null&&row.can_close)&&(filter!=="contract"||row.contract_minutes===null)&&(filter!=="difference"||row.contract_minutes!==null&&row.planned_minutes!==null&&row.contract_minutes!==row.planned_minutes)).map(row => <tr key={row.id} className="border-t">
                        <td className="px-3 py-2"><Link className="font-medium hover:underline" href={"/dashboard?taskId=" + row.id}>{row.title}</Link></td>
                        <td className="px-3 py-2">{duration(row.contract_minutes)}</td>
                        <td className="px-3 py-2">{duration(row.planned_minutes)}{row.planned_minutes!==null&&row.contract_minutes!==null&&row.planned_minutes!==row.contract_minutes&&<p className="mt-1 text-xs text-orange-700 dark:text-orange-300">{row.planned_minutes-row.contract_minutes>0?"+":""}{row.planned_minutes-row.contract_minutes} min sobre contrato</p>}</td>
                        <td className="px-3 py-2">{duration(row.worked_seconds / 60)}</td>
                        <td className="px-3 py-2">{row.approved_seconds === null
                            ? <span className={pendingStyle}>{row.can_close ? "Pendiente de aprobación" : "Pendiente de fichajes"}</span>
                            : duration(row.approved_seconds / 60)}</td>
                        <td className="space-y-1 px-3 py-2">
                            {canManageCompanyTasks(user) && (edit === row.id
                                ? <form className="flex flex-wrap items-end gap-1" onSubmit={e => { e.preventDefault(); void save(row, "contract"); }}>
                                    <label>Minutos contratados<Input required type="number" min="0" max="10000000" value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
                                    <Button size="sm" disabled={busy}>Guardar</Button>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
                                </form>
                                : <Button variant="outline" size="sm" disabled={busy} onClick={() => {
                                    setEdit(row.id);
                                    setMinutes(String(row.contract_minutes ?? ""));
                                }}>{row.contract_minutes === null ? "Indicar contratadas" : "Editar contratadas"}</Button>)}
                            {canApproveTime(user) && row.can_close && row.approved_seconds === null &&
                                <Button disabled={busy} size="sm" onClick={() => void save(row, "approval")}>Aprobar horas</Button>}
                        </td>
                    </tr>)}
                </tbody>
            </table>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!page || fetching || busy} onClick={() => {setFetching(true);setEdit(null);setError("");setPage(v => v - 1);}}>Anterior</Button>
            <span>Página {page + 1}</span>
            <Button variant="outline" disabled={!more || fetching || busy} onClick={() => {setFetching(true);setEdit(null);setError("");setPage(v => v + 1);}}>Siguiente</Button>
        </div>
    </div>;
}
