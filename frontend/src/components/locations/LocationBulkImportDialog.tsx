"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import type { LocationBulkImportPreview } from "@/types/location";
import { LocationService } from "@/services/location.service";

const CSV_TEMPLATE = [
    "name,address,city,postal_code,client_id,site_type,internal_code,spaces",
    "Oficina Norte,Calle Norte 1,Madrid,28001,1,office,OFI-N,Despacho 1|Baño 1",
    "Local Sur,Calle Sur 2,Sevilla,41001,1,commercial,LOC-S,Mostrador|Almacén",
].join("\n");

interface LocationBulkImportDialogProps {
    onImported?: () => void;
}

function downloadLocationTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "plantilla-ubicaciones-workhive.csv";
    anchor.click();
    URL.revokeObjectURL(url);
}

export function LocationBulkImportDialog({ onImported }: LocationBulkImportDialogProps) {
    const [open, setOpen] = useState(false);
    const [csvContent, setCsvContent] = useState("");
    const [preview, setPreview] = useState<LocationBulkImportPreview | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setCsvContent("");
        setPreview(null);
        setPreviewing(false);
        setImporting(false);
    };

    const selectFile = async (file?: File) => {
        if (!file) return;
        try {
            setCsvContent(await file.text());
            setPreview(null);
        } catch {
            toast.error("No se pudo leer el archivo CSV.");
        }
    };

    const loadPreview = async () => {
        if (!csvContent.trim()) {
            toast.error("Selecciona primero un archivo CSV.");
            return;
        }
        try {
            setPreviewing(true);
            setPreview(await LocationService.previewBulkImport(csvContent));
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo validar el archivo."));
        } finally {
            setPreviewing(false);
        }
    };

    const importLocations = async () => {
        if (!preview?.valid) return;
        try {
            setImporting(true);
            const result = await LocationService.importBulkLocations(csvContent);
            toast.success(`${result.created_count} ubicaciones importadas.`);
            setOpen(false);
            reset();
            onImported?.();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudieron importar las ubicaciones."));
        } finally {
            setImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) reset(); }}>
            <DialogTrigger asChild>
                <Button type="button" variant="secondary" className="w-full md:w-auto">
                    <Upload className="h-4 w-4" /> Importar CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-1.5rem)] !max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[24px] border border-[var(--border-soft)] p-0 sm:w-full sm:!max-w-2xl">
                <DialogHeader className="border-b border-[var(--border-soft)] px-5 py-5 sm:px-7">
                    <DialogTitle>Importar ubicaciones</DialogTitle>
                    <DialogDescription>
                        Para importaciones grandes, descarga la plantilla, completa los datos y revisa todo antes de guardar.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 p-5 sm:p-7">
                    <div className="flex min-h-32 flex-wrap items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4">
                        <Button type="button" variant="secondary" size="sm" onClick={downloadLocationTemplate}>
                            <Download className="h-3.5 w-3.5" /> Descargar plantilla
                        </Button>
                        <Button type="button" variant="default" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <FileSpreadsheet className="h-3.5 w-3.5" /> Seleccionar CSV
                        </Button>
                        <input ref={fileInputRef} type="file" accept=".csv,text/csv" aria-label="Archivo CSV de ubicaciones" className="sr-only" onChange={(event) => void selectFile(event.target.files?.[0])} />
                        {csvContent && <span className="self-center text-xs text-[var(--text-muted)]">Archivo cargado</span>}
                    </div>

                    {preview && <section className="space-y-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3">
                        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-[var(--text-main)]">Vista previa</h3><span className={`rounded-md px-2 py-1 text-xs font-semibold ${preview.valid ? "bg-accent/10 text-accent" : "bg-red-500/10 text-red-600"}`}>{preview.valid ? "Lista para importar" : "Requiere correcciones"}</span></div>
                        <div className="max-h-56 space-y-1 overflow-y-auto text-xs">
                            {preview.rows.map((row) => <div key={row.row_number} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2.5 py-2"><span className="font-semibold text-[var(--text-main)]">Fila {row.row_number}: {row.name || "sin nombre"}</span><span className={row.errors.length ? "text-red-600" : "text-accent"}>{row.errors.length ? row.errors.join(", ") : "Correcta"}</span></div>)}
                        </div>
                    </section>}

                    <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-5">
                        <Button type="button" variant="dangerSoft" onClick={() => setOpen(false)}>Cancelar</Button>
                        {!preview ? <Button type="button" onClick={() => void loadPreview()} disabled={previewing}>{previewing ? "Validando..." : "Vista previa"}</Button> : <Button type="button" onClick={() => void importLocations()} disabled={!preview.valid || importing}>{importing ? "Importando..." : "Importar ubicaciones"}</Button>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
