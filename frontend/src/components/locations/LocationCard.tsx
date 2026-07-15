"use client"

import Image from "next/image"
import { Location } from "@/services/location.service"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, MapPin, Building2, Pencil, Trash2, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDictionary } from "@/lib/dictionary-context"
import { ActionPopover } from "@/components/ui/action-popover"
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
    const tasksLabel = dict.locations?.sheet?.tab_templates || "Fixed services"

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={location.name}
            onClick={onCardClick}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === "Enter" || event.key === " ") {
                    if (event.key === " ") event.preventDefault()
                    onCardClick()
                }
            }}
            className="surface-glass-card group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35"
        >
            {location.photo_url ? (
                <div className="relative h-32 w-full overflow-hidden border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)] sm:h-36">
                    <Image
                        src={resolveApiMediaUrl(location.photo_url) || ""}
                        alt={location.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <div className="absolute left-2.5 top-2.5 flex max-w-[78%] flex-wrap gap-1">
                        <Badge
                            variant={location.is_active ? "default" : "secondary"}
                            className={
                                location.is_active
                                    ? "border-0 bg-emerald-500/90 px-1.5 py-0 text-[10px] text-white"
                                    : "border-0 bg-black/40 px-1.5 py-0 text-[10px] text-white/85 backdrop-blur-sm"
                            }
                        >
                            {location.is_active ? activeLabel : inactiveLabel}
                        </Badge>
                        <Badge
                            variant="secondary"
                            className="border-0 bg-black/40 px-1.5 py-0 text-[10px] text-white/95 backdrop-blur-sm"
                        >
                            {locationTypeLabel}
                        </Badge>
                    </div>
                </div>
            ) : (
                <div
                    className="relative h-32 w-full overflow-hidden sm:h-36"
                    style={{ background: gradient }}
                >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3">
                        <MapPin className="h-8 w-8 text-white drop-shadow-sm" />
                        <span className="max-w-full truncate text-xs font-semibold text-white/95 drop-shadow-sm">
                            {location.city}
                        </span>
                    </div>
                    <div className="absolute left-2.5 top-2.5 flex max-w-[78%] flex-wrap gap-1">
                        <Badge
                            variant={location.is_active ? "default" : "secondary"}
                            className={
                                location.is_active
                                    ? "border-0 bg-emerald-500/90 px-1.5 py-0 text-[10px] text-white"
                                    : "border-0 bg-black/35 px-1.5 py-0 text-[10px] text-white/85 backdrop-blur-sm"
                            }
                        >
                            {location.is_active ? activeLabel : inactiveLabel}
                        </Badge>
                        <Badge
                            variant="secondary"
                            className="border-0 bg-black/35 px-1.5 py-0 text-[10px] text-white/95 backdrop-blur-sm"
                        >
                            {locationTypeLabel}
                        </Badge>
                    </div>
                </div>
            )}

            <div
                className="absolute right-1.5 top-1.5 z-10"
                onClick={(e) => e.stopPropagation()}
            >
                <ActionPopover
                    align="end"
                    trigger={
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full border border-white/30 bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 hover:text-white"
                        >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                    }
                    options={[
                        {
                            label: tasksLabel,
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

            <div className="flex flex-1 flex-col gap-2.5 p-3.5 sm:p-4">
                <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-bold leading-snug text-[var(--text-main)]">
                        {location.name}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                        {location.address}
                    </p>
                </div>

                <div className="mt-auto flex items-center justify-between gap-1.5 border-t border-[var(--border-soft)] pt-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                        <span className="truncate text-[11px] font-medium text-[var(--text-muted)]">
                            {clientName}
                        </span>
                    </div>
                    {(pendingTasksCount !== undefined || completedTasksCount !== undefined) && (
                        <div className="flex shrink-0 gap-1.5 text-[9px] font-black uppercase tracking-wide">
                            <span className="text-orange-500">{(pendingTasksCount || 0)} P</span>
                            <span className="text-[var(--color-green-500)]">{(completedTasksCount || 0)} C</span>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation()
                        onTasks()
                    }}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] px-2.5 text-[11px] font-bold text-[var(--btn-secondary-text)] transition-colors hover:bg-[var(--btn-secondary-hover-bg)]"
                    title={tasksLabel}
                >
                    <ListChecks className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tasksLabel}</span>
                </button>
            </div>
        </div>
    )
}
