"use client";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-context";
import { LocationService, type Location, type LocationEquipmentLibraryItem } from "@/services/location.service";
import { readResourceLog, writeResourceLog, type ResourceLog, type Vehicle } from "@/services/resource-log.service";
import { VehicleForm } from "@/components/operations/VehicleForm";
import { JourneyForm } from "@/components/operations/JourneyForm";
import { CustodyForm } from "@/components/operations/CustodyForm";
export default function ResourcesPage() {
    const { user, loading } = useUser();
    const [data, setData] = useState<ResourceLog>({ vehicles: [], journeys: [], custody: [], staff: [] });
    const [sites, setSites] = useState<Location[]>([]);
    const [assets, setAssets] = useState<LocationEquipmentLibraryItem[]>([]);
    const [edit, setEdit] = useState<Vehicle | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const request = useCallback(() => Promise.all([readResourceLog(), LocationService.getLocations(), LocationService.getEquipmentLibrary()]), []);
    const receive = useCallback(([log, locations, equipment]: Awaited<ReturnType<typeof request>>) => { setData(log); setSites(locations); setAssets(equipment); setError(""); }, []);
    const failed = useCallback((error: unknown) => setError(error instanceof Error ? error.message : "No se pudieron cargar los recursos."), []);
    async function reload() { try {
        receive(await request());
    }
    catch (error) {
        failed(error);
    } }
    useResourceEffect(Boolean(user), `${user?.company_id}:${user?.id}`, request, receive, failed);
    async function giveBack(id: number) {
        setBusy(true);
        try {
            await writeResourceLog("custody/" + id + "/return", {});
            await reload();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo devolver.");
        }
        finally {
            setBusy(false);
        }
    }
    if (loading)
        return <p>Cargando…</p>;
    const person = (id: number) => data.staff.find(p => p.id === id)?.name ?? "Trabajador #" + id;
    return <div className="dashboard-page-content space-y-4">
        <PageHeader icon={Truck} title="Vehículos y entregas" subtitle="Desplazamientos, kilometraje y custodia del material." actions={<Button variant="outline" onClick={() => void reload()}>Actualizar</Button>}/>
        {error && <p role="alert" className="text-orange-700">{error}</p>}
        <details open className="space-y-3 rounded-xl border p-4"><summary className="font-semibold cursor-pointer">Vehículos y mantenimiento</summary>
            <VehicleForm key={edit?.id ?? "new"} vehicle={edit ?? undefined} saved={() => { setEdit(null); void reload(); }}/>
            {data.vehicles.map(v => <div key={v.id} className="flex flex-wrap justify-between gap-2 border-t pt-2"><div><strong>{v.name} · {v.registration}</strong><p>{v.odometer} km · {v.status === "active" ? "Disponible" : v.status === "maintenance" ? "En mantenimiento" : "Retirado"}</p><p className={!v.service_due_on || v.service_due_on < new Date().toISOString().slice(0, 10) ? "text-orange-700" : ""}>Mantenimiento {v.service_due_on ?? "pendiente de indicar"}</p></div><Button variant="outline" onClick={() => setEdit(v)}>Editar</Button></div>)}
        </details>
        <details className="space-y-3 rounded-xl border p-4"><summary className="font-semibold cursor-pointer">Trayectos y kilometraje</summary>
            <JourneyForm vehicles={data.vehicles} staff={data.staff} sites={sites} saved={() => void reload()}/>
            {data.journeys.map(j => <p key={j.id} className="border-t pt-2">{data.vehicles.find(v => v.id === j.vehicle_id)?.name} · {person(j.employee_id)} · {sites.find(s => s.id === j.location_id)?.name} · {j.start_km} — {j.end_km} km · {j.notes}</p>)}
        </details>
        <details className="space-y-3 rounded-xl border p-4"><summary className="font-semibold cursor-pointer">Entregas y devoluciones</summary>
            <Link className="text-sm underline" href="/dashboard/assets">Registrar material, maquinaria o llaves</Link>
            <CustodyForm assets={assets} staff={data.staff} saved={() => void reload()}/>
            {data.custody.map(c => <div key={c.id} className="flex flex-wrap justify-between gap-2 border-t pt-2"><div><strong>{assets.find(a => a.id === c.equipment_id)?.name}</strong><p>{person(c.employee_id)} · {c.notes}</p><span className={c.returned_at ? "" : "text-orange-700"}>{c.returned_at ? "Devuelto" : "Pendiente de devolución"}</span></div>{!c.returned_at && <Button disabled={busy} variant="outline" onClick={() => void giveBack(c.id)}>Registrar devolución</Button>}</div>)}
        </details>
    </div>;
}
