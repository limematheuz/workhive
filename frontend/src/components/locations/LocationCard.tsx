"use client"

import Image from "next/image"
import { Location } from "@/services/location.service"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, MapPin, Building2, Pencil, Trash2, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDictionary } from "@/lib/dictionary-context"
import { ActionPopover } from "@/components/ui/action-popover"
import * as React from "react"
import { resolveApiMediaUrl } from "@/lib/api"
import { getLocationTypeLabel } from "@/domain/locations/location-type"

interface LocationCardProps {
    location: Location
    clientName: string
    activeLabel: string
    inactiveLabel: string
    onCardClick: () => void
    onEdit: () => void
    onDelete: () => void
    onTasks: () => void
    gradient: string
    pendingTasksCount?: number
    completedTasksCount?: number
    isReadOnly?: boolean
}

export function LocationCard({
    location,
    clientName,
    activeLabel,
    inactiveLabel,
    onCardClick,
    onEdit,
    onDelete,
    onTasks,
    gradient,
    pendingTasksCount,
    completedTasksCount,
    isReadOnly,
}: LocationCardProps) {
    const { dict } = useDictionary()
    const locationTypeLabel = getLocationTypeLabel(location.location_type, {
        private: dict.locations?.type_private,
        real_estate: dict.locations?.type_real_estate,
        business: dict.locations?.type_business,
        exterior: dict.locations?.type_exterior,
        other: dict.locations?.type_other,
    })
    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={location.name}
            onClick={onCardClick}
            onKeyDown={(event) => {
                // Only handle keys on the card itself, not on nested interactive elements
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                    if (event.key === " ") event.preventDefault();
                    onCardClick();
                }
            }}
            className="group relative rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
            {/* Header: image or gradient */}
            {location.photo_url ? (
                <div className="relative h-40 w-full overflow-hidden bg-[var(--bg-tertiary)] border-b border-[var(--border-soft)]">
                    <Image
                        src={resolveApiMediaUrl(location.photo_url) || ""}
                        alt={location.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />

                    <div className="absolute top-3 left-3 flex gap-1.5">
                        <Badge
                            variant={location.is_active ? "default" : "secondary"}
                            className={
                                location.is_active
                                    ? "bg-emerald-500/90 text-white border-0 shadow-sm text-xs"
                                    : "bg-black/40 text-white/80 border-0 shadow-sm text-xs backdrop-blur-sm"
                            }
                        >
                            {location.is_active ? activeLabel : inactiveLabel}
                        </Badge>
                        <Badge
                            variant="secondary"
                            className="bg-black/40 text-white/95 border-0 shadow-sm text-xs backdrop-blur-sm"
                        >
                            {locationTypeLabel}
                        </Badge>
                    </div>
                </div>
            ) : (
                <div
                    className="relative h-40 w-full overflow-hidden"
                    style={{ background: gradient }}
                >
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <MapPin className="w-10 h-10 mx-auto mb-1 opacity-60" style={{ color: "white" }} />
                            <span className="text-xs font-medium text-white/70">{location.city}</span>
                        </div>
                    </div>

                    <div className="absolute top-3 left-3 flex gap-1.5">
                        <Badge
                            variant={location.is_active ? "default" : "secondary"}
                            className={
                                location.is_active
                                    ? "bg-emerald-500/90 text-white border-0 shadow-sm text-xs"
                                    : "bg-black/40 text-white/80 border-0 shadow-sm text-xs backdrop-blur-sm"
                            }
                        >
                            {location.is_active ? activeLabel : inactiveLabel}
                        </Badge>
                        <Badge
                            variant="secondary"
                            className="bg-black/40 text-white/95 border-0 shadow-sm text-xs backdrop-blur-sm"
                        >
                            {locationTypeLabel}
                        </Badge>
                    </div>
                </div>
            )}

            {/* Actions button */}
            <div 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={(e) => e.stopPropagation()}
            >
                <ActionPopover
                    align="end"
                    trigger={
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 hover:text-white"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    }
                    options={[
                        {
                            label: dict.locations?.sheet?.tab_templates || "Configure services",
                            icon: ListChecks,
                            onClick: onTasks,
                        },
                        ...(!isReadOnly
                            ? [
                                  {
                                      label: dict.locations.table.edit,
                                      icon: Pencil,
                                      onClick: onEdit,
                                      variant: "edit" as const,
                                  },
                                  {
                                      label: dict.locations.table.delete,
                                      icon: Trash2,
                                      onClick: onDelete,
                                      variant: "delete" as const,
                                  },
                              ]
                            : []),
                    ]}
                />
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-semibold text-[var(--text-main)] text-base truncate mb-1">
                    {location.name}
                </h3>
                <p className="text-xs text-[var(--text-muted)] truncate mb-3">{location.address}</p>
 
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-soft)]">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                        <Building2 className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                        <span className="text-2xs text-[var(--text-muted)] truncate">{clientName}</span>
                    </div>
                    {(pendingTasksCount !== undefined || completedTasksCount !== undefined) && (
                        <div className="flex gap-1.5 shrink-0 text-[9px] font-black uppercase tracking-wide">
                            <span className="text-orange-500">{(pendingTasksCount || 0)} P</span>
                            <span className="text-emerald-500">{(completedTasksCount || 0)} C</span>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation()
                        onTasks()
                    }}
                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-sm font-semibold text-[var(--text-main)] transition-colors hover:border-accent/40 hover:text-accent"
                >
                    <ListChecks className="h-4 w-4 text-accent" />
                    {dict.locations?.sheet?.tab_templates || "Fixed services"}
                </button>
            </div>
        </div>
    )
}
