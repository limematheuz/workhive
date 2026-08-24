"use client"

import { Location } from "@/services/location.service"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, MapPin, Building2, Pencil, Trash2, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDictionary } from "@/lib/dictionary-context"
import { ActionPopover } from "@/components/ui/action-popover"
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

const statusBadgeActive =
    "border-0 bg-accent/90 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm"
const statusBadgeInactive =
    "border-0 bg-black/40 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-white/85 backdrop-blur-sm"
const typeBadge =
    "border-0 bg-black/40 px-1.5 py-0 text-[10px] font-semibold text-white/95 backdrop-blur-sm"

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

    const headerBadges = (
        <div className="absolute left-2.5 top-2.5 flex max-w-[78%] flex-wrap gap-1">
            <Badge
                variant={location.is_active ? "default" : "secondary"}
                className={location.is_active ? statusBadgeActive : statusBadgeInactive}
            >
                {location.is_active ? activeLabel : inactiveLabel}
            </Badge>
            <Badge variant="secondary" className={typeBadge}>
                {locationTypeLabel}
            </Badge>
        </div>
    )

    return (
        <article className="billing-block group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-soft)] transition-[border-color,box-shadow] duration-200 hover:border-accent/30 hover:shadow-[0_8px_20px_rgba(52,74,94,0.08)]">
            <div
                className="relative h-28 w-full overflow-hidden border-b border-[var(--border-soft)] sm:h-32"
                style={{ background: gradient }}
            >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3">
                    <MapPin className="h-7 w-7 text-white drop-shadow-sm" />
                    <span className="max-w-full truncate text-[11px] font-semibold text-white/95 drop-shadow-sm">
                        {location.city}
                    </span>
                </div>
                {headerBadges}
            </div>

            <div
                className="absolute right-1.5 top-1.5 z-10"
                onClick={(e) => e.stopPropagation()}
            >
                <ActionPopover
                    align="end"
                    trigger={
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            className="rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm hover:bg-black/55 hover:text-white"
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

            <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
                <div className="min-w-0">
                    <h3 className="truncate">
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onCardClick()
                            }}
                            className="cursor-pointer text-left text-sm font-semibold leading-snug text-[var(--text-main)] hover:text-accent"
                        >
                            {location.name}
                        </button>
                    </h3>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                        {location.address}
                    </p>
                </div>

                <div className="mt-auto flex items-center justify-between gap-1.5 border-t border-[var(--border-soft)] pt-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                        <span className="truncate text-[11px] font-medium text-[var(--text-muted)]">
                            {clientName}
                        </span>
                    </div>
                    {(pendingTasksCount !== undefined || completedTasksCount !== undefined) && (
                        <div className="flex shrink-0 items-center gap-1">
                            <span className="rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-orange-600">
                                {pendingTasksCount || 0} P
                            </span>
                            <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-accent">
                                {completedTasksCount || 0} C
                            </span>
                        </div>
                    )}
                </div>

                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation()
                        onTasks()
                    }}
                    className="h-8 w-full gap-1.5 text-[11px]"
                    title={tasksLabel}
                >
                    <ListChecks className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tasksLabel}</span>
                </Button>
            </div>
        </article>
    )
}
