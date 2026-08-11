"use client";

import { useMemo, useState } from "react";
import { Library, Edit2, Trash2, Copy, Search } from "lucide-react";
import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { DataListTable } from "@/components/ui/data-list-table";
import { TemplateTask } from "@/hooks/useTasksPage";
import { useDictionary } from "@/lib/dictionary-context";
import { cleanChecklistDescription } from "@/lib/format";

interface TasksTemplatesProps {
    templates: TemplateTask[];
    handleOpenTemplateModal: (template: TemplateTask | null) => void;
    onDeleteTemplate: (templateId: number) => void;
    isDeletingTemplate: boolean;
    onDuplicateTemplate: (template: TemplateTask) => Promise<void>;
}

const GRID =
    "grid-cols-[minmax(12rem,1.1fr)_minmax(14rem,1.6fr)_minmax(8rem,.75fr)_5.5rem]";

function parseStepLines(desc: string | null | undefined): string[] {
    if (!desc) return [];

    const cleanLines: string[] = [];
    for (const line of desc.split("\n")) {
        const match = line.match(/^\s*[-*]?\s*\[\s*[xX\s]\s*\]\s*(.+?)(?:\s*\(@\d+.*?\))?$/);
        if (match) {
            cleanLines.push(match[1].trim());
            continue;
        }
        const clean = line.replace(/^\s*[-*]\s+/, "").trim();
        if (clean) cleanLines.push(clean);
    }
    return cleanLines;
}

function formatSuggestedPrice(template: TemplateTask): string {
    return template.default_price !== null
        ? `${template.default_price} € / ${template.unit}`
        : "--";
}

export function TasksTemplates({
    templates,
    handleOpenTemplateModal,
    onDeleteTemplate,
    isDeletingTemplate,
    onDuplicateTemplate,
}: TasksTemplatesProps) {
    const { dict } = useDictionary();
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredTemplates = useMemo(() => {
        const query = searchQuery.trim().toLocaleLowerCase("es");
        if (!query) return templates;
        return templates.filter((template) =>
            `${template.name} ${cleanChecklistDescription(template.description || "")} ${template.unit}`
                .toLocaleLowerCase("es")
                .includes(query)
        );
    }, [searchQuery, templates]);

    const renderCleanDescription = (desc: string | null | undefined) => {
        if (!desc) {
            return (
                <span className="text-xs italic font-semibold text-[var(--text-muted)]">
                    {dict.tasks?.no_description || "Sin descripción"}
                </span>
            );
        }

        const cleanLines = parseStepLines(desc);
        if (cleanLines.length === 0) {
            return <span className="text-sm text-[var(--text-muted)]">{desc}</span>;
        }

        return (
            <div className="flex max-w-full flex-wrap gap-1">
                {cleanLines.map((item) => (
                    <span
                        key={item}
                        className="inline-flex shrink-0 select-none items-center rounded-md bg-[var(--bg-card-solid)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]"
                    >
                        {item}
                    </span>
                ))}
            </div>
        );
    };

    const getTemplateActions = (tmpl: TemplateTask): PopoverOption[] => [
        {
            label: dict.tasks.edit || "Editar",
            icon: Edit2,
            variant: "edit",
            onClick: () => handleOpenTemplateModal(tmpl),
        },
        {
            label: dict.tasks.duplicate || "Duplicar",
            icon: Copy,
            onClick: () => {
                void onDuplicateTemplate(tmpl);
            },
        },
        {
            label: dict.tasks.delete || "Eliminar",
            icon: Trash2,
            variant: "delete",
            onClick: () => setDeleteConfirmId(tmpl.id),
        },
    ];

    const handleConfirmDelete = () => {
        if (deleteConfirmId !== null) {
            onDeleteTemplate(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    const emptyContent = templates.length === 0 ? (
        <>
            <Library className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">
                Todavía no hay servicios en el catálogo
            </p>
            <Button
                onClick={() => handleOpenTemplateModal(null)}
                className="mt-4 rounded-xl bg-accent text-xs font-semibold text-white"
            >
                Crear primer servicio
            </Button>
        </>
    ) : (
        <>
            <Search className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[var(--text-muted)]">
                No hay servicios que coincidan con la búsqueda
            </p>
        </>
    );

    return (
        <>
            <DataListTable
                items={filteredTemplates}
                getRowKey={(tmpl) => tmpl.id}
                gridClassName={GRID}
                desktopFrom="md"
                variant="plain"
                header={{
                    title: "Catálogo de servicios",
                    subtitle: dict.tasks.templates_subtitle
                        || "Configura el catálogo de tareas estándar reutilizables con sus precios base por defecto.",
                    countLabel: `${templates.length} ${templates.length === 1 ? "servicio definido" : "servicios definidos"}`,
                }}
                toolbar={templates.length > 0 ? (
                    <div className="mb-2">
                        <label className="relative block w-full sm:max-w-xs">
                            <span className="sr-only">Buscar servicio o paso</span>
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                                aria-hidden="true"
                            />
                            <input
                                id="template-search"
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                aria-label="Buscar servicio o paso"
                                placeholder="Buscar servicio o paso"
                                className="h-9 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] pl-10 pr-3 text-sm font-medium text-[var(--text-main)] outline-none transition focus:border-accent/50"
                            />
                        </label>
                    </div>
                ) : undefined}
                columns={[
                    { key: "name", label: dict.tasks.template_name || "Nombre de Plantilla" },
                    { key: "description", label: dict.tasks.description || "Descripción" },
                    { key: "price", label: dict.tasks.suggested_price || "Precio Sugerido" },
                    { key: "actions", label: dict.invoices.actions || "Acciones", className: "text-right" },
                ]}
                empty={emptyContent}
                renderCompactRow={(tmpl) => (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--text-main)]">{tmpl.name}</p>
                                <div className="mt-1.5">{renderCleanDescription(tmpl.description)}</div>
                            </div>
                            <ActionPopover align="end" options={getTemplateActions(tmpl)} />
                        </div>
                        <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border-soft)] pt-2.5 text-xs">
                            <span className="font-semibold text-[var(--text-muted)]">
                                {dict.tasks.suggested_price || "Precio Sugerido"}
                            </span>
                            <span className="font-semibold text-[var(--text-main)]">
                                {formatSuggestedPrice(tmpl)}
                            </span>
                        </div>
                    </>
                )}
                renderDesktopRow={(tmpl) => (
                    <>
                        <span className="min-w-0 truncate font-semibold text-[var(--text-main)]">{tmpl.name}</span>
                        <div className="min-w-0">{renderCleanDescription(tmpl.description)}</div>
                        <span className="text-sm font-semibold text-[var(--text-main)]">
                            {formatSuggestedPrice(tmpl)}
                        </span>
                        <span className="flex justify-end">
                            <ActionPopover align="end" options={getTemplateActions(tmpl)} />
                        </span>
                    </>
                )}
            />

            <DeleteConfirmDialog
                open={deleteConfirmId !== null}
                onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
                title={dict.tasks.delete_template_title || "Eliminar Plantilla"}
                description={dict.tasks.delete_template_confirm || "¿Estás seguro de que deseas eliminar esta plantilla? Las tareas existentes creadas a partir de ella no se verán afectadas."}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeletingTemplate}
                confirmText={dict.tasks.delete || "Eliminar"}
                cancelText={dict.tasks.cancel || "Cancelar"}
            />
        </>
    );
}
