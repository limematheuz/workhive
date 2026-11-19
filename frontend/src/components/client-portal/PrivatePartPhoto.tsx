"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { TaskClientPublicationService } from "@/services/task-client-publication.service";

type Props = { alt: string; fileName?: string } & ({ reportId: number; workspaceId?: never; publicationId?: never; photoId?: never; taskId?: never } | { reportId?: never; workspaceId: number; publicationId: number; photoId: string; taskId?: never } | { reportId?: never; workspaceId?: never; publicationId?: never; photoId: string; taskId: number });

export function PrivatePartPhoto(props: Props) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState("");
    const { reportId, workspaceId, publicationId, photoId, taskId } = props;
    useEffect(() => {
        let active = true;
        let objectUrl: string | null = null;
        const request = reportId !== undefined ? TaskClientPublicationService.sourcePhoto(reportId) : taskId !== undefined ? TaskClientPublicationService.managerPhoto(taskId, photoId!) : TaskClientPublicationService.photo(workspaceId!, publicationId!, photoId!);
        request.then(blob => {
            if (!active) return;
            objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
        }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo abrir esta fotografía privada."); });
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [reportId, workspaceId, publicationId, photoId, taskId]);
    return <figure className="space-y-2 rounded-xl border p-2">{error ? <p role="alert" className="text-xs text-orange-700 dark:text-orange-300">{error}</p> : url ? <><div className="relative aspect-video overflow-hidden rounded-lg bg-muted"><Image src={url} alt={props.alt} fill unoptimized sizes="(max-width: 768px) 90vw, 420px" className="object-contain" /></div>{props.fileName && <a href={url} download={props.fileName} className="inline-flex min-h-9 items-center text-xs underline">Descargar {props.fileName}</a>}</> : <p role="status" className="p-4 text-xs text-muted-foreground">Cargando fotografía privada…</p>}</figure>;
}
