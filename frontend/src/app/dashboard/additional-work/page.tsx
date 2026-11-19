"use client";
import {FormSelect} from "@/components/ui/form-select";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ClipboardPenLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-context";
import { canManageFinance,canManageCompanyTasks, canViewFinance } from "@/domain/access/roles";
import { LocationService, type Location } from "@/services/location.service";
import { QuoteService } from "@/services/quote.service";
import type { Quote } from "@/types/quote";
import { readAdditionalWork, saveAdditionalWork, type AdditionalWork } from "@/services/additional-work.service";
import { AdditionalWorkCard } from "@/components/operations/AdditionalWorkCard";
export default function AdditionalWorkPage() {
    const { user, loading } = useUser();
    const allowed = canManageCompanyTasks(user) && canViewFinance(user);
    const [items, setItems] = useState<AdditionalWork[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [title, setTitle] = useState("");
    const [site, setSite] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const request = useCallback(() => Promise.all([readAdditionalWork(), LocationService.getLocations(), QuoteService.getQuotes()]), []);
    const receive = useCallback(([requests, sites, offers]: Awaited<ReturnType<typeof request>>) => { setItems(requests); setLocations(sites); setQuotes(offers); setError(""); }, []);
    const failed = useCallback((error: unknown) => setError(error instanceof Error ? error.message : "No se pudieron cargar los datos."), []);
    async function reload() { try {
        receive(await request());
    }
    catch (error) {
        failed(error);
    } }
    useResourceEffect(allowed, `${user?.company_id}:${user?.id}`, request, receive, failed);
    async function create() {
        setBusy(true);
        try {
            await saveAdditionalWork(null, "", { title, description, location_id: Number(site) });
            setTitle("");
            setDescription("");
            await reload();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo crear.");
        }
        finally {
            setBusy(false);
        }
    }
    if (loading)
        return <p>Cargando…</p>;
    if (!allowed)
        return <p>Acceso restringido.</p>;
    return <div className="dashboard-page-content space-y-4">
        <PageHeader icon={ClipboardPenLine} title="Trabajos adicionales" subtitle="Petición, presupuesto, aprobación, ejecución y facturación." actions={<Button variant="outline" onClick={() => void reload()}>Actualizar</Button>}/>
        {canManageFinance(user)&&<form className="flex flex-wrap items-end gap-3 rounded-xl border p-4" onSubmit={e => { e.preventDefault(); void create(); }}>
            <label>Petición<Input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)}/></label>
            <label>Ubicación<FormSelect aria-label={"Ubicación"} required value={site} onValueChange={selectedOptionValue=>setSite(selectedOptionValue)} className="block h-9 max-w-72 rounded-md border bg-background px-2">
                <option value="">Seleccionar ubicación</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </FormSelect></label>
            <label>Detalle<Input value={description} maxLength={10000} onChange={e => setDescription(e.target.value)}/></label>
            <Button disabled={busy}>Registrar petición</Button>
            <Link className="text-sm underline" href="/dashboard/quotes">Crear presupuesto</Link>
        </form>}
        {error && <p role="alert" className="text-orange-700">{error}</p>}
        {!items.length && !error && <p className="text-muted-foreground">Todavía no hay peticiones adicionales.</p>}
        {items.map(item => <AdditionalWorkCard key={item.id} item={item} quotes={quotes} location={locations.find(l => l.id === item.location_id)} saved={() => void reload()}/>)}
    </div>;
}
