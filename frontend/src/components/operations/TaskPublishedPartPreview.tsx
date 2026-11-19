"use client";
import { useState } from "react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download-blob";
import { Button } from "@/components/ui/button";
import { PrivatePartPhoto } from "@/components/client-portal/PrivatePartPhoto";
import { TaskClientPublicationService, type PublishedWork } from "@/services/task-client-publication.service";

export function TaskPublishedPartPreview({ taskId, part }: { taskId: number; part: PublishedWork }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    async function download() {
        setBusy(true);
        try {
            const blob = await TaskClientPublicationService.managerPdf(taskId);
            downloadBlob(blob, `parte-${taskId}-r${part.revision}.pdf`);
        } catch (reason) { toast.error(reason instanceof Error ? reason.message : "No se pudo descargar el parte publicado."); } finally { setBusy(false); }
    }
    return <section className="space-y-3 border-t pt-3"><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setOpen(value => !value)}>{open ? "Ocultar contenido publicado" : `Revisar lo publicado · revisión ${part.revision}`}</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void download()}>{busy ? "Descargando…" : "PDF publicado"}</Button></div>{open && <div className="space-y-3 rounded-xl bg-muted/30 p-3 text-sm"><p className="whitespace-pre-wrap">{part.manifest.public_summary}</p>{part.manifest.checklist.map(item => <p key={item.reference ?? item.text}>{item.space_name ? item.space_name + " · " : ""}{item.text} · {item.completed ? "Completada" : "Pendiente"}</p>)}{part.manifest.reports.map(report => <div key={report.reference ?? report.created_at}>{report.title && <strong>{report.title}</strong>}{report.text && <p className="whitespace-pre-wrap">{report.text}</p>}</div>)}{part.manifest.photos.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{part.manifest.photos.map((photo, index) => <PrivatePartPhoto key={photo.id} taskId={taskId} photoId={photo.id} fileName={photo.file_name} alt={`Fotografía ${index + 1} publicada en esta revisión`} />)}</div>}</div>}</section>;
}
