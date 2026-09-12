"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Download, FileText, Paperclip } from "lucide-react";

import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { LocationService, type Location, type LocationDocumentLibraryItem } from "@/services/location.service";

const columns: DataListColumn[] = [
    { key: "document", label: "Documento", className: "w-[38%]" },
    { key: "location", label: "Ubicación", className: "w-[28%]" },
    { key: "date", label: "Fecha", className: "w-[20%]" },
    { key: "actions", label: "", className: "w-[14%] text-right" },
];

const bytes = (size: number) => size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<LocationDocumentLibraryItem[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [locationId, setLocationId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [archiving, setArchiving] = useState<LocationDocumentLibraryItem | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [nextDocuments, nextLocations] = await Promise.all([
                LocationService.getDocumentLibrary(), LocationService.getLocations(),
            ]);
            setDocuments(nextDocuments);
            setLocations(nextLocations.filter((location) => location.can_manage_location));
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudieron cargar los documentos."));
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

    const upload = async (file?: File) => {
        if (!file || !selectedLocation) return;
        setUploading(true);
        try {
            await LocationService.uploadDocument(selectedLocation.id, file);
            toast.success("Documento subido.");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo subir el documento."));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const archive = async () => {
        if (!archiving) return;
        setUploading(true);
        try {
            await LocationService.archiveDocument(archiving.location_id, archiving.id);
            setArchiving(null);
            toast.success("Documento archivado.");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo archivar el documento."));
        } finally {
            setUploading(false);
        }
    };

    return <div className="dashboard-page-content px-[3%] py-6 md:p-8">
        <PageHeader icon={FileText} title="Documentos" subtitle="Documentación operativa vinculada a ubicaciones. El límite depende del plan contratado." className="mb-6" />
        <DataListTable
            items={documents}
            getRowKey={(document) => document.id}
            columns={columns}
            loading={loading}
            header={{ title: "Documentos operativos", subtitle: "Los permisos de ubicación también protegen cada documento.", countLabel: `${documents.length} documentos` }}
            toolbar={<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger className="sm:w-72"><SelectValue placeholder="Selecciona ubicación para subir" /></SelectTrigger>
                    <SelectContent>{locations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent>
                </Select>
                <input ref={fileRef} className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png" aria-label="Subir documento" onChange={(event) => void upload(event.target.files?.[0])} />
                <Button type="button" disabled={!selectedLocation || uploading} onClick={() => fileRef.current?.click()}><Paperclip className="size-4" />Subir documento</Button>
            </div>}
            empty={<p className="text-sm text-[var(--text-muted)]">No hay documentos. Selecciona una ubicación y sube el primero.</p>}
            renderDesktopRow={(document) => [
                <div key="document" className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{document.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{document.document_type} · {bytes(document.size_bytes)}</p></div>,
                <span key="location" className="truncate text-sm text-[var(--text-main)]">{document.location_name}</span>,
                <span key="date" className="text-sm text-[var(--text-muted)]">{formatDate(document.created_at)}</span>,
                <div key="actions" className="flex justify-end gap-1"><a className="inline-flex h-8 items-center justify-center rounded-md px-2 text-sm font-medium hover:bg-muted" href={LocationService.documentDownloadUrl(document.location_id, document.id)}><Download className="mr-1 size-4" />Descargar</a>{locations.some((location) => location.id === document.location_id) && <Button type="button" size="icon" variant="ghost" className="size-8 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiving(document)} aria-label={`Archivar ${document.name}`}><Archive className="size-4" /></Button>}</div>,
            ]}
            renderCompactRow={(document) => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{document.name}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{document.location_name} · {bytes(document.size_bytes)}</p></div><div className="flex shrink-0 gap-1"><a className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted" href={LocationService.documentDownloadUrl(document.location_id, document.id)} aria-label={`Descargar ${document.name}`}><Download className="size-4" /></a>{locations.some((location) => location.id === document.location_id) && <Button type="button" size="icon" variant="ghost" className="size-8 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiving(document)} aria-label={`Archivar ${document.name}`}><Archive className="size-4" /></Button>}</div></div>}
        />
        <DeleteConfirmDialog open={Boolean(archiving)} onOpenChange={(open) => !open && setArchiving(null)} title="Archivar documento" description="Dejará de aparecer en los documentos operativos." confirmText="Archivar" cancelText="Cancelar" confirmVariant="soft-danger" isDeleting={uploading} onConfirm={() => void archive()} />
    </div>;
}
