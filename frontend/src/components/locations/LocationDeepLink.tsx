"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LocationService, type Location } from "@/services/location.service";
import { useUser } from "@/lib/user-context";
import { useDictionary } from "@/lib/dictionary-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LocationDetailDialog } from "./LocationDetailDialog";

/** Global search opens canonical detail, including an authorized one-off location absent from the directory. */
export function LocationDeepLink({ onEdit }: { onEdit: (location: Location) => void }) {
    const params = useSearchParams(), router = useRouter(), pathname = usePathname();
    const { user } = useUser(), { dict } = useDictionary();
    const raw = params.get("locationId");
    const id = raw && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
    const key = `${user?.id}:${user?.company_id}:${id}`;
    const [result, setResult] = useState<{ key: string; location?: Location; error?: string } | null>(null);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let current = true;
        if (id && user) void LocationService.getLocation(id).then(location => { if (current) setResult({ key, location }); }).catch(() => { if (current) setResult({ key, error: "La ubicación no está disponible con tu acceso actual. Puede haberse eliminado o haber cambiado sus permisos." }); });
        return () => { current = false; };
    }, [id, key, user, revision]);
    const close = () => { const next = new URLSearchParams(params.toString()); next.delete("locationId"); router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }); };
    if (!raw) return null;
    const visible = result?.key === key ? result : null;
    if (visible?.location) return <LocationDetailDialog key={key} location={visible.location} clientName={visible.location.client_id ? `Cliente #${visible.location.client_id}` : dict.locations.workspace.no_client} activeLabel={dict.locations.table.active} inactiveLabel={dict.locations.table.inactive} onClose={close} onEdit={() => { if (visible.location?.can_manage_location) { close(); onEdit(visible.location); } }} />;
    return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent><DialogHeader><DialogTitle>Detalle de ubicación</DialogTitle></DialogHeader>{!id ? <p role="alert">El enlace de ubicación no es válido.</p> : visible?.error ? <div role="alert" className="space-y-3"><p>{visible.error}</p><Button variant="outline" onClick={() => setRevision(value => value + 1)}>Reintentar</Button></div> : <p role="status">Consultando ubicación y permisos…</p>}<Button variant="outline" onClick={close}>Volver al listado</Button></DialogContent></Dialog>;
}
