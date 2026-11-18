"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download-blob";
import { Button } from "@/components/ui/button";
import { PrivatePartPhoto } from "./PrivatePartPhoto";
import { ClientPartAcceptance } from "./ClientPartAcceptance";
import { ClientPartHistory } from "./ClientPartHistory";
import { TaskClientPublicationService, type PublishedWork } from "@/services/task-client-publication.service";

export function ClientPartDetail({ part, workspaceId, defaultSignerName, accepted, refresh }: {
    part: PublishedWork; workspaceId: number; defaultSignerName: string; accepted: (part: PublishedWork) => void; refresh: () => void;
}) {
    const [photosOpen, setPhotosOpen] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const dates = useMemo(() => new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: part.manifest.timezone }), [part.manifest.timezone]);
    const format = (value: string | null) => value ? dates.format(new Date(value)) : "Sin registro";
    async function pdf() {
        setDownloading(true);
        try {
            const blob = await TaskClientPublicationService.pdf(workspaceId, part.id);
            downloadBlob(blob, `parte-${part.manifest.task_id}-r${part.revision}.pdf`);
        } catch (reason) { toast.error(reason instanceof Error ? reason.message : "No se pudo descargar el parte."); } finally { setDownloading(false); }
    }
    return <article className="min-w-0 space-y-4 rounded-2xl border bg-card p-4"><header><p className="text-xs text-muted-foreground">{part.manifest.location_name} · Revisión {part.revision}</p><h2 className="mt-1 text-lg font-semibold">{part.manifest.title}</h2><p className="mt-1 text-xs text-muted-foreground">Publicado el {format(part.published_at)}</p></header><dl className="grid gap-3 rounded-xl bg-muted/30 p-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Inicio registrado</dt><dd className={part.manifest.started_at ? "mt-1" : "mt-1 text-orange-700 dark:text-orange-300"}>{format(part.manifest.started_at)}</dd></div><div><dt className="text-xs text-muted-foreground">Trabajo completado</dt><dd className="mt-1">{format(part.manifest.completed_at)}</dd></div></dl><p className="whitespace-pre-wrap text-sm leading-6">{part.manifest.public_summary}</p>
        {part.manifest.checklist.length > 0 && <section><h3 className="text-sm font-semibold">Tareas incluidas</h3><ul className="mt-2 divide-y">{part.manifest.checklist.map(item => <li key={item.reference ?? `${item.space_name}:${item.text}`} className="flex items-start justify-between gap-3 py-2 text-sm"><span>{item.space_name && <span className="block text-xs text-muted-foreground">{item.space_name}</span>}{item.text}</span><span className={item.completed ? "shrink-0 text-xs text-emerald-700 dark:text-emerald-300" : "shrink-0 text-xs text-orange-700 dark:text-orange-300"}>{item.completed ? "Completada" : "Pendiente"}</span></li>)}</ul></section>}
        {part.manifest.reports.length > 0 && <section className="space-y-2"><h3 className="text-sm font-semibold">Observaciones compartidas</h3>{part.manifest.reports.map(report => <div key={report.reference ?? `${report.created_at}:${report.text}`} className="rounded-xl bg-muted/30 p-3 text-sm">{report.title && <strong className="block">{report.title}</strong>}{report.text && <p className="mt-1 whitespace-pre-wrap">{report.text}</p>}{report.checklist_label && <p className="mt-1 text-xs text-muted-foreground">{report.checklist_label}</p>}<p className="mt-2 text-xs text-muted-foreground">{format(report.created_at)}</p></div>)}</section>}
        {part.manifest.photos.length > 0 && <section className="space-y-3"><Button type="button" size="sm" variant="outline" onClick={() => setPhotosOpen(value => !value)}>{photosOpen ? "Ocultar fotos" : `Ver fotografías (${part.manifest.photos.length})`}</Button>{photosOpen && <div className="grid gap-3 sm:grid-cols-2">{part.manifest.photos.map((photo, index) => <PrivatePartPhoto key={photo.id} workspaceId={workspaceId} publicationId={part.id} photoId={photo.id} fileName={photo.file_name} alt={`Fotografía ${index + 1} del parte ${part.manifest.title}`} />)}</div>}</section>}
        <div className="flex flex-wrap items-center gap-3 border-t pt-3"><Button type="button" size="sm" variant="outline" disabled={downloading} onClick={() => void pdf()}><Download className="size-4" />{downloading ? "Descargando…" : "Descargar parte PDF"}</Button><ClientPartAcceptance key={`${part.id}:${part.acceptance?.accepted_at ?? "pending"}`} part={part} workspaceId={workspaceId} defaultSignerName={defaultSignerName} accepted={accepted} refresh={refresh} /></div>{part.acceptance && <p className="text-xs text-muted-foreground">Validación registrada el {format(part.acceptance.accepted_at)} para la revisión {part.revision}.</p>}
        <ClientPartHistory key={`${part.id}:${part.acceptance?.accepted_at ?? "pending"}`} workspaceId={workspaceId} publicationId={part.id} timezone={part.manifest.timezone} initial={[...(part.acceptance ? [part.acceptance] : []), ...part.previous_acceptances]} />
    </article>;
}
