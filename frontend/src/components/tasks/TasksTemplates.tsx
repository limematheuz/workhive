"use client";

import React, { useMemo, useState } from "react";
import { Library, Edit2, Trash2, Copy, Search, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateTask } from "@/hooks/useTasksPage";
import { useDictionary } from "@/lib/dictionary-context";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { cleanChecklistDescription } from "@/lib/format";

interface TasksTemplatesProps {
    templates: TemplateTask[];
    handleOpenTemplateModal: (template: TemplateTask | null) => void;
    onDeleteTemplate: (templateId: number) => void;
    isDeletingTemplate: boolean;
    onDuplicateTemplate: (template: TemplateTask) => Promise<void>;
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
        if (!desc) return <span className="text-[var(--text-muted)] italic font-semibold">{dict.tasks?.no_description || "Sin descripción"}</span>;
        
        const lines = desc.split("\n");
        const cleanLines: string[] = [];
        lines.forEach(line => {
            const match = line.match(/^\s*[-*]?\s*\[\s*[xX\s]\s*\]\s*(.+?)(?:\s*\(@\d+.*?\))?$/);
            if (match) {
                cleanLines.push(match[1].trim());
            } else {
                const clean = line.replace(/^\s*[-*]\s+/, "").trim();
                if (clean) cleanLines.push(clean);
            }
        });

        if (cleanLines.length === 0) return <span>{desc}</span>;

        return (
            <div className="flex flex-wrap gap-1 max-w-xs md:max-w-md">
                {cleanLines.map((item) => (
                    <span 
                        key={item}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-soft)] select-none shrink-0"
                    >
                        {item}
                    </span>
                ))}
            </div>
        );
    };

    const handleDeleteClick = (tmpl: TemplateTask) => {
        setDeleteConfirmId(tmpl.id);
    };

    const handleConfirmDelete = () => {
        if (deleteConfirmId !== null) {
            onDeleteTemplate(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    return (
        <>
            <div className="surface-glass-card rounded-3xl p-6">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-2">
                            <Library className="w-5 h-5 text-accent" />
                            Catálogo de servicios
                        </h3>
                        <p className="text-sm text-[var(--text-muted)] font-medium mt-1">
                            {templates.length} {templates.length === 1 ? "servicio definido" : "servicios definidos"}
                        </p>
                    </div>
                    {templates.length > 0 && (
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Buscar servicio o paso"
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-accent"
                            />
                        </div>
                    )}
                </div>

                {templates.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-[var(--border-soft)] rounded-2xl bg-[var(--bg-primary)]/10">
                        <p className="text-sm text-[var(--text-muted)] font-semibold">
                            Todavía no hay servicios en el catálogo
                        </p>
                        <Button
                            onClick={() => handleOpenTemplateModal(null)}
                            className="bg-accent text-white mt-4 text-xs font-semibold rounded-xl"
                        >
                            Crear primer servicio
                        </Button>
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-14 border border-dashed border-[var(--border-soft)] rounded-2xl bg-[var(--bg-primary)]/10">
                        <Search className="w-7 h-7 mx-auto text-[var(--text-muted)] mb-3" />
                        <p className="text-sm font-semibold text-[var(--text-muted)]">
                            No hay servicios que coincidan con la búsqueda
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Table for medium and large screens */}
                        <div className="hidden md:block overflow-x-auto border border-[var(--border-soft)] rounded-2xl">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-primary)]/40 text-2xs uppercase font-bold text-[var(--text-muted)]">
                                        <th className="p-4">{dict.tasks.template_name || "Nombre de Plantilla"}</th>
                                        <th className="p-4">{dict.tasks.description || "Descripción"}</th>
                                        <th className="p-4">{dict.tasks.suggested_price || "Precio Sugerido"}</th>
                                        <th className="p-4 text-right">{dict.invoices.actions || "Acciones"}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-soft)]">
                                    {filteredTemplates.map(tmpl => (
                                        <tr key={tmpl.id} className="hover:bg-[var(--bg-primary)]/20 transition-colors">
                                            <td className="p-4 font-bold text-[var(--text-main)]">{tmpl.name}</td>
                                            <td className="p-4 text-[var(--text-muted)]">
                                                {renderCleanDescription(tmpl.description)}
                                            </td>
                                            <td className="p-4 font-bold">
                                                {tmpl.default_price !== null ? `${tmpl.default_price} € / ${tmpl.unit}` : `--`}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <Button
                                                        onClick={() => handleOpenTemplateModal(tmpl)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="bg-transparent border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-[var(--text-main)] text-2xs font-semibold rounded-xl flex items-center gap-1.5 border-none cursor-pointer"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                        {dict.tasks.edit || "Editar"}
                                                    </Button>
                                                    <Button
                                                        onClick={() => onDuplicateTemplate(tmpl)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="bg-transparent border-[var(--border-soft)] hover:bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] text-2xs font-semibold rounded-xl flex items-center gap-1.5 border-none cursor-pointer"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                        {dict.tasks.duplicate || "Duplicar"}
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleDeleteClick(tmpl)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="bg-transparent border-[var(--border-soft)] hover:bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] text-2xs font-semibold rounded-xl flex items-center gap-1.5 border-none cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        {dict.tasks.delete || "Eliminar"}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Responsive Bento cards for mobile */}
                        <div className="md:hidden grid grid-cols-1 gap-4">
                            {filteredTemplates.map(tmpl => (
                                <div key={tmpl.id} className="bg-[var(--bg-primary)]/15 border border-[var(--border-soft)] rounded-2xl p-4 space-y-3 shadow-xs">
                                        <div>
                                        <h4 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                                            <ListChecks className="w-4 h-4 text-accent" />
                                            {tmpl.name}
                                        </h4>
                                        <div className="mt-1">
                                            {renderCleanDescription(tmpl.description)}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-[var(--text-muted)] font-semibold">{dict.tasks.suggested_price || "Precio Sugerido"}:</span>
                                        <span className="font-bold text-[var(--text-main)]">
                                            {tmpl.default_price !== null ? `${tmpl.default_price} € / ${tmpl.unit}` : `--`}
                                        </span>
                                    </div>
                                    <div className="flex justify-end gap-1.5 pt-2.5 border-t border-[var(--border-soft)]">
                                        <Button
                                            onClick={() => handleOpenTemplateModal(tmpl)}
                                            variant="outline"
                                            size="sm"
                                            className="bg-transparent text-[var(--text-main)] hover:bg-[var(--bg-secondary)] text-2xs font-semibold rounded-xl flex items-center gap-1 border-none cursor-pointer"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                            {dict.tasks.edit || "Editar"}
                                        </Button>
                                        <Button
                                            onClick={() => onDuplicateTemplate(tmpl)}
                                            variant="outline"
                                            size="sm"
                                            className="bg-transparent text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-bg)] text-2xs font-semibold rounded-xl flex items-center gap-1 border-none cursor-pointer"
                                        >
                                            <Copy className="w-3 h-3" />
                                            {dict.tasks.duplicate || "Duplicar"}
                                        </Button>
                                        <Button
                                            onClick={() => handleDeleteClick(tmpl)}
                                            variant="outline"
                                            size="sm"
                                            className="bg-transparent text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-bg)] text-2xs font-semibold rounded-xl flex items-center gap-1 border-none cursor-pointer"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            {dict.tasks.delete || "Eliminar"}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

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
