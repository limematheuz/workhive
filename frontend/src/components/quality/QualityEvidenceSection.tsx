"use client";

import * as React from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveApiMediaUrl } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import {
    QualityService,
    type QualityEvidence,
} from "@/services/quality.service";

type EvidenceSubject = "inspection" | "incident";

type QualityEvidenceSectionProps = {
    subject: EvidenceSubject;
    subjectId: number;
    evidence: QualityEvidence[];
    canManage: boolean;
    onEvidenceAdded: (evidence: QualityEvidence) => void;
};

export function QualityEvidenceSection({
    subject,
    subjectId,
    evidence,
    canManage,
    onEvidenceAdded,
}: QualityEvidenceSectionProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [caption, setCaption] = React.useState("");
    const [uploading, setUploading] = React.useState(false);

    const upload = async (file: File) => {
        try {
            setUploading(true);
            const created = subject === "inspection"
                ? await QualityService.addInspectionEvidence(subjectId, file, caption.trim() || undefined)
                : await QualityService.addIncidentEvidence(subjectId, file, caption.trim() || undefined);
            onEvidenceAdded(created);
            setCaption("");
            toast.success("Foto de evidencia añadida.");
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo guardar la foto de evidencia."));
        } finally {
            setUploading(false);
        }
    };

    return (
        <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-[var(--text-main)]">Evidencia fotográfica</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {evidence.length === 0 ? "Aún no hay fotos registradas." : `${evidence.length} foto${evidence.length === 1 ? "" : "s"} registrada${evidence.length === 1 ? "" : "s"}.`}
                    </p>
                    {canManage && (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                            Objetivo de compresión: 850 KB. El servidor no admite archivos de más de 1 MB.
                        </p>
                    )}
                </div>
                {canManage && (
                    <>
                        <input
                            ref={inputRef}
                            className="sr-only"
                            type="file"
                            aria-label="Seleccionar foto de evidencia"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.currentTarget.value = "";
                                if (file) void upload(file);
                            }}
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => inputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                            Añadir foto
                        </Button>
                    </>
                )}
            </div>
            {canManage && (
                <div className="grid gap-2">
                    <Label htmlFor={`quality-evidence-caption-${subject}-${subjectId}`}>Descripción opcional</Label>
                    <Input
                        id={`quality-evidence-caption-${subject}-${subjectId}`}
                        value={caption}
                        onChange={(event) => setCaption(event.target.value)}
                        maxLength={1000}
                        placeholder="Ej. Estado del baño tras la revisión"
                    />
                </div>
            )}
            {evidence.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {evidence.map((item) => {
                        const mediaUrl = resolveApiMediaUrl(item.media_url);
                        return (
                            <a
                                key={item.id}
                                href={mediaUrl ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="group overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)]"
                                aria-label={`Abrir evidencia ${item.file_name || item.id}`}
                            >
                                <div className="relative aspect-square w-full">
                                    <Image
                                    src={mediaUrl ?? item.media_url}
                                    alt={item.caption || item.file_name || "Foto de evidencia"}
                                        fill
                                        unoptimized
                                        sizes="(max-width: 640px) 50vw, 33vw"
                                        className="object-cover transition-transform group-hover:scale-[1.02]"
                                    />
                                </div>
                                {(item.caption || item.file_name) && (
                                    <p className="truncate px-2 py-1.5 text-xs text-[var(--text-muted)]">
                                        {item.caption || item.file_name}
                                    </p>
                                )}
                            </a>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
