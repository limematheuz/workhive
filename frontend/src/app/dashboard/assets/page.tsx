"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, PackagePlus } from "lucide-react";

import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { AssetCompactDetails, AssetServiceDate, AssetStatus } from "@/components/assets/asset-details";
import { assetStatusLabel } from "@/lib/asset-presentation";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { LocationService, type Location, type LocationEquipmentLibraryItem, type LocationEquipmentStatus } from "@/services/location.service";

const columns: DataListColumn[] = [
    { key: "asset", label: "Activo", className: "w-[30%]" },
    { key: "location", label: "Ubicación", className: "w-[25%]" },
    { key: "status", label: "Estado", className: "w-[20%]" },
    { key: "service", label: "Próximo mantenimiento", className: "w-[17%]" },
    { key: "actions", label: "", className: "w-[8%] text-right" },
];

export default function AssetsPage() {
    const [assets, setAssets] = useState<LocationEquipmentLibraryItem[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [locationId, setLocationId] = useState("");
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [status, setStatus] = useState<LocationEquipmentStatus>("active");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [archiving, setArchiving] = useState<LocationEquipmentLibraryItem | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [nextAssets, nextLocations] = await Promise.all([
                LocationService.getEquipmentLibrary(), LocationService.getLocations(),
            ]);
            setAssets(nextAssets);
            setLocations(nextLocations.filter((location) => location.can_manage_location));
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudieron cargar los activos."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => void reload(), 0);
        return () => window.clearTimeout(timer);
    }, [reload]);

    const selectedLocation = useMemo(
        () => locations.find((location) => String(location.id) === locationId),
        [locationId, locations],
    );
    const manageableLocationIds = useMemo(
        () => new Set(locations.map((location) => location.id)),
        [locations],
    );
    const canManageAsset = (asset: LocationEquipmentLibraryItem) =>
        manageableLocationIds.has(asset.location_id);

    const addAsset = async () => {
        if (!selectedLocation || !name.trim()) return;
        setSaving(true);
        try {
            await LocationService.createEquipment(selectedLocation.id, {
                name: name.trim(),
                category: category.trim() || "other",
                quantity: 1,
                status,
            });
            setName("");
            setCategory("");
            setStatus("active");
            toast.success("Activo añadido.");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo añadir el activo."));
        } finally {
            setSaving(false);
        }
    };

    const archive = async () => {
        if (!archiving) return;
        setSaving(true);
        try {
            await LocationService.archiveEquipment(archiving.location_id, archiving.id);
            setArchiving(null);
            toast.success("Activo archivado.");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo archivar el activo."));
        } finally {
            setSaving(false);
        }
    };

    return <div className="dashboard-page-content px-[3%] py-6 md:p-8">
        <PageHeader icon={PackagePlus} title="Activos" subtitle="Equipos vinculados a cada ubicación, separados del stock y los consumos de material." className="mb-6" />
        <DataListTable
            desktopFrom="lg"
            items={assets}
            getRowKey={(asset) => asset.id}
            columns={columns}
            loading={loading}
            header={{ title: "Activos operativos", subtitle: "Cada activo conserva su ubicación y estado.", countLabel: `${assets.length} ${assets.length === 1 ? "activo" : "activos"}` }}
            toolbar={locations.length > 0 ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(10rem,0.75fr)_minmax(9rem,0.65fr)_auto]">
                <Select value={locationId} onValueChange={setLocationId}><SelectTrigger><SelectValue placeholder="Ubicación" /></SelectTrigger><SelectContent>{locations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del activo" aria-label="Nombre del activo" />
                <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Categoría" aria-label="Categoría" />
                <Select value={status} onValueChange={(value) => setStatus(value as LocationEquipmentStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(assetStatusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                <Button type="button" className="sm:col-span-2 sm:justify-self-end lg:col-span-1" disabled={!selectedLocation || !name.trim() || saving} onClick={() => void addAsset()}><PackagePlus className="size-4" />Añadir</Button>
            </div> : undefined}
            empty={<p className="text-sm text-[var(--text-muted)]">No hay activos registrados.</p>}
            renderDesktopRow={(asset) => [
                <div key="asset" className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{asset.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{asset.category} · {asset.quantity} ud.</p></div>,
                <span key="location" className="truncate text-sm text-[var(--text-main)]">{asset.location_name}</span>,
                <AssetStatus key="status" status={asset.status} />,
                <span key="service" className="text-sm text-[var(--text-muted)]"><AssetServiceDate value={asset.next_service_at} /></span>,
                canManageAsset(asset) ? <Button key="actions" type="button" size="icon" variant="ghost" className="ml-auto size-8 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiving(asset)} aria-label={`Archivar ${asset.name}`}><Archive className="size-4" /></Button> : null,
            ]}
            renderCompactRow={(asset) => <div className="flex min-w-0 items-center justify-between gap-3"><AssetCompactDetails asset={asset} />{canManageAsset(asset) && <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiving(asset)} aria-label={`Archivar ${asset.name}`}><Archive className="size-4" /></Button>}</div>}
        />
        <DeleteConfirmDialog open={Boolean(archiving)} onOpenChange={(open) => !open && setArchiving(null)} title="Archivar activo" description="Dejará de aparecer en el inventario operativo." confirmText="Archivar" cancelText="Cancelar" confirmVariant="soft-danger" isDeleting={saving} onConfirm={() => void archive()} />
    </div>;
}
