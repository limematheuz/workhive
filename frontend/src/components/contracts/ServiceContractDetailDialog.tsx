"use client"

import * as React from "react"
import {
    CheckCircle2,
    FileSignature,
    MapPin,
    Plus,
    RotateCcw,
    Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDate } from "@/lib/format"
import { getErrorMessage } from "@/lib/errors"
import { toast } from "@/lib/toast"
import { MarginForecastPanel } from "@/components/margin-forecast/MarginForecastPanel"
import { ServiceContractService } from "@/services/service-contract.service"
import type { Location, LocationSpace } from "@/types/location"
import type { ServiceContract, ServiceContractLocation } from "@/types/service-contract"

type ServiceContractDetailDialogProps = {
    contract: ServiceContract | null
    clientName: string
    canManage: boolean
    canViewMargin: boolean
    open: boolean
    onOpenChange: (open: boolean) => void
    onContractUpdated: (contract: ServiceContract) => void
}

type ServiceContractDetailDialogContentProps = Omit<
    ServiceContractDetailDialogProps,
    "contract"
> & {
    contract: ServiceContract
}

const statusCopy = {
    draft: "Borrador",
    active: "Activo",
    terminated: "Finalizado",
} as const

const dateInputValue = (value: string | null) => value?.slice(0, 10) ?? ""
const isoDateValue = (value: string) => value ? `${value}T00:00:00Z` : null

export function ServiceContractDetailDialog({
    contract,
    ...props
}: ServiceContractDetailDialogProps) {
    if (!contract) return null
    return (
        <ServiceContractDetailDialogContent
            key={`${contract.id}:${props.open}`}
            contract={contract}
            {...props}
        />
    )
}

function ServiceContractDetailDialogContent({
    contract,
    clientName,
    canManage,
    canViewMargin,
    open,
    onOpenChange,
    onContractUpdated,
}: ServiceContractDetailDialogContentProps) {
    const [saving, setSaving] = React.useState(false)
    const [selectedLocationId, setSelectedLocationId] = React.useState("")
    const [locationCandidates, setLocationCandidates] = React.useState<Location[]>([])
    const [zoneCandidates, setZoneCandidates] = React.useState<Record<number, LocationSpace[]>>({})
    const [managedLocationId, setManagedLocationId] = React.useState<number | null>(null)
    const [selectedZoneIds, setSelectedZoneIds] = React.useState<number[]>([])
    const [startsAt, setStartsAt] = React.useState(() => dateInputValue(contract.starts_at))
    const [endsAt, setEndsAt] = React.useState(() => dateInputValue(contract.ends_at))
    const [renewalMode, setRenewalMode] = React.useState<"manual" | "automatic">(contract.renewal_mode)
    const [renewalNoticeDays, setRenewalNoticeDays] = React.useState(() => String(contract.renewal_notice_days))
    const [responseTimeHours, setResponseTimeHours] = React.useState(() => contract.response_time_hours?.toString() ?? "")
    const [resolutionTimeHours, setResolutionTimeHours] = React.useState(() => contract.resolution_time_hours?.toString() ?? "")
    const [serviceWindow, setServiceWindow] = React.useState(() => contract.service_window ?? "")
    const [notes, setNotes] = React.useState(() => contract.notes ?? "")

    React.useEffect(() => {
        if (!open || !canManage) return
        let cancelled = false
        void ServiceContractService.getLocationCandidates(contract.id)
            .then((candidates) => {
                if (!cancelled) setLocationCandidates(candidates)
            })
            .catch((error: unknown) => {
                if (!cancelled) toast.error(getErrorMessage(error, "No se pudieron cargar las ubicaciones del cliente"))
            })
        return () => { cancelled = true }
    }, [canManage, contract, open])

    const activeLocationIds = contract.covered_locations.reduce<Set<number>>(
        (ids, location) => {
            if (location.is_active) ids.add(location.location_id)
            return ids
        },
        new Set(),
    )
    const eligibleLocations = locationCandidates.filter(
        (location) => location.is_active
            && location.client_id === contract.client_id
            && !activeLocationIds.has(location.id),
    )
    const selectedZoneIdSet = new Set(selectedZoneIds)

    const updateContract = async (work: () => Promise<ServiceContract>, success: string) => {
        setSaving(true)
        try {
            const updated = await work()
            onContractUpdated(updated)
            toast.success(success)
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "No se pudieron guardar los cambios"))
        } finally {
            setSaving(false)
        }
    }

    const handleSaveTerms = () => void updateContract(
        () => ServiceContractService.updateTerms(contract.id, {
            ...(startsAt === dateInputValue(contract.starts_at) ? {} : { starts_at: isoDateValue(startsAt) }),
            ...(endsAt === dateInputValue(contract.ends_at) ? {} : { ends_at: isoDateValue(endsAt) }),
            renewal_mode: renewalMode,
            renewal_notice_days: Number(renewalNoticeDays || 0),
            response_time_hours: responseTimeHours ? Number(responseTimeHours) : null,
            resolution_time_hours: resolutionTimeHours ? Number(resolutionTimeHours) : null,
            service_window: serviceWindow || null,
            notes: notes || null,
        }),
        "Condiciones del contrato guardadas",
    )

    const handleAddLocation = () => {
        const locationId = Number(selectedLocationId)
        if (!Number.isSafeInteger(locationId) || locationId < 1) return
        void updateContract(
            () => ServiceContractService.addLocations(contract.id, [locationId]),
            "Ubicación añadida al contrato",
        )
    }

    const handleManageZones = async (location: ServiceContractLocation) => {
        if (managedLocationId === location.location_id) {
            setManagedLocationId(null)
            return
        }
        setManagedLocationId(location.location_id)
        setSelectedZoneIds(location.covered_zones.map((zone) => zone.zone_id))
        if (zoneCandidates[location.location_id]) return
        try {
            const candidates = await ServiceContractService.getLocationZoneCandidates(contract.id, location.location_id)
            setZoneCandidates((current) => ({ ...current, [location.location_id]: candidates }))
        } catch (error: unknown) {
            setManagedLocationId(null)
            toast.error(getErrorMessage(error, "No se pudieron cargar los espacios de la ubicación"))
        }
    }

    const handleSaveZones = (locationId: number) => void updateContract(
        () => ServiceContractService.updateLocationZones(contract.id, locationId, selectedZoneIds),
        selectedZoneIds.length > 0 ? "Cobertura por zonas actualizada" : "La cobertura vuelve a incluir toda la ubicación",
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl" confirmDiscard={canManage}>
                <DialogHeader className="border-b border-[var(--border-soft)] px-5 py-5 pr-14 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-accent">
                            <FileSignature className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <DialogTitle className="font-mono text-lg">{contract.contract_number}</DialogTitle>
                                <Badge variant={contract.status === "active" ? "default" : "secondary"}>
                                    {statusCopy[contract.status]}
                                </Badge>
                            </div>
                            <DialogDescription className="mt-1 truncate">{contract.title} · {clientName}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="max-h-[calc(92vh-10rem)] overflow-y-auto px-5 py-5 sm:px-6">
                    <section className="grid gap-4 border-b border-[var(--border-soft)] pb-5 sm:grid-cols-3">
                        <div>
                            <p className="text-xs font-medium text-[var(--text-muted)]">Presupuesto aceptado</p>
                            <p className="mt-1 font-mono text-sm font-semibold text-accent">#{contract.source_quote_id} · v{contract.source_quote_revision_id}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--text-muted)]">Importe acordado</p>
                            <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-main)]">
                                {formatCurrency(contract.quote_snapshot.total_amount ?? 0)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[var(--text-muted)]">Creado</p>
                            <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{formatDate(contract.created_at)}</p>
                        </div>
                    </section>

                    <section className="border-b border-[var(--border-soft)] py-5">
                        <h3 className="text-sm font-semibold text-[var(--text-main)]">Servicios contratados</h3>
                        <div className="mt-3 divide-y divide-[var(--table-divider)]">
                            {contract.service_lines.map((line) => (
                                <div key={line.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-[var(--text-main)]">{line.description}</p>
                                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{line.quantity} × {formatCurrency(line.unit_price)}</p>
                                    </div>
                                    <p className="shrink-0 font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(line.subtotal)}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="border-b border-[var(--border-soft)] py-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text-main)]">Ubicaciones cubiertas</h3>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Solo se pueden cubrir ubicaciones de este cliente.</p>
                            </div>
                            {canManage && eligibleLocations.length > 0 && (
                                <div className="flex min-w-[14rem] gap-2">
                                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                                        <SelectTrigger aria-label="Añadir ubicación cubierta" className="h-9 min-w-0"><SelectValue placeholder="Selecciona ubicación" /></SelectTrigger>
                                        <SelectContent>
                                            {eligibleLocations.map((location) => (
                                                <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" size="sm" onClick={handleAddLocation} disabled={saving || !selectedLocationId} aria-label="Añadir ubicación">
                                        <Plus className="size-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="mt-3 divide-y divide-[var(--table-divider)]">
                            {contract.covered_locations.length === 0 ? (
                                <p className="py-3 text-sm text-[var(--text-muted)]">Todavía no hay ubicaciones cubiertas.</p>
                            ) : contract.covered_locations.map((location) => (
                                <div key={location.id} className="py-3 first:pt-0 last:pb-0">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <MapPin className="size-4 shrink-0 text-accent" aria-hidden="true" />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[var(--text-main)]">{location.location_name ?? `Ubicación #${location.location_id}`}</p>
                                                <p className="text-xs text-[var(--text-muted)]">
                                                    Desde {formatDate(location.covered_from)} · {location.covered_zones.length > 0
                                                        ? `${location.covered_zones.length} zona${location.covered_zones.length === 1 ? "" : "s"} seleccionada${location.covered_zones.length === 1 ? "" : "s"}`
                                                        : "Toda la ubicación"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <Badge variant={location.is_active ? "default" : "secondary"}>{location.is_active ? "Cubierta" : "Finalizada"}</Badge>
                                            {canManage && location.is_active && (
                                                <>
                                                    <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => void handleManageZones(location)}>
                                                        Zonas
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={saving}
                                                        onClick={() => void updateContract(
                                                            () => ServiceContractService.removeLocation(contract.id, location.location_id),
                                                            "Ubicación retirada del contrato",
                                                        )}
                                                        aria-label={`Retirar ${location.location_name ?? "ubicación"}`}
                                                    >
                                                        <Trash2 className="size-4" aria-hidden="true" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {managedLocationId === location.location_id && (
                                        <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3">
                                            <p className="text-xs text-[var(--text-muted)]">
                                                Elige zonas concretas o deja la selección vacía para cubrir toda la ubicación.
                                            </p>
                                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                {(zoneCandidates[location.location_id] ?? []).map((zone) => (
                                                    <label key={zone.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-primary)]">
                                                        <Checkbox
                                                            checked={selectedZoneIdSet.has(zone.id ?? -1)}
                                                            onCheckedChange={(checked) => setSelectedZoneIds((current) => (
                                                                checked === true
                                                                    ? [...current, zone.id as number]
                                                                    : current.filter((id) => id !== zone.id)
                                                            ))}
                                                        />
                                                        {zone.name}
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="mt-3 flex justify-end gap-2">
                                                <Button type="button" variant="secondary" size="sm" onClick={() => setManagedLocationId(null)}>Cancelar</Button>
                                                <Button type="button" size="sm" disabled={saving} onClick={() => handleSaveZones(location.location_id)}>Guardar zonas</Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {canViewMargin && <MarginForecastPanel
                        scopeType="contract"
                        scopeId={contract.id}
                        canManage={canManage}
                    />}

                    <section className="py-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text-main)]">Condiciones de servicio</h3>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">SLA, vigencia y renovación. No modifica el presupuesto aceptado.</p>
                            </div>
                            {contract.status === "active" && <CheckCircle2 className="size-5 text-accent" aria-label="Contrato activo" />}
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-1.5"><Label htmlFor="contract-start">Inicio</Label><DatePicker id="contract-start" value={startsAt} disabled={!canManage || saving} onValueChange={setStartsAt} /></div>
                            <div className="space-y-1.5"><Label htmlFor="contract-end">Fin</Label><DatePicker id="contract-end" value={endsAt} disabled={!canManage || saving} onValueChange={setEndsAt} /></div>
                            <div className="space-y-1.5"><Label>Renovación</Label><Select value={renewalMode} onValueChange={(value) => setRenewalMode(value as "manual" | "automatic")} disabled={!canManage || saving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="automatic">Automática</SelectItem></SelectContent></Select></div>
                            <div className="space-y-1.5"><Label htmlFor="contract-notice">Aviso previo (días)</Label><Input id="contract-notice" type="number" min="0" max="365" value={renewalNoticeDays} disabled={!canManage || saving} onChange={(event) => setRenewalNoticeDays(event.target.value)} /></div>
                            <div className="space-y-1.5"><Label htmlFor="contract-response">Respuesta SLA (horas)</Label><Input id="contract-response" type="number" min="0" max="720" value={responseTimeHours} disabled={!canManage || saving} onChange={(event) => setResponseTimeHours(event.target.value)} /></div>
                            <div className="space-y-1.5"><Label htmlFor="contract-resolution">Resolución SLA (horas)</Label><Input id="contract-resolution" type="number" min="0" max="720" value={resolutionTimeHours} disabled={!canManage || saving} onChange={(event) => setResolutionTimeHours(event.target.value)} /></div>
                            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="contract-window">Ventana de servicio</Label><Input id="contract-window" value={serviceWindow} placeholder="Ej.: lunes a viernes, 08:00–18:00" disabled={!canManage || saving} onChange={(event) => setServiceWindow(event.target.value)} /></div>
                            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4"><Label htmlFor="contract-notes">Notas internas</Label><Textarea id="contract-notes" value={notes} disabled={!canManage || saving} onChange={(event) => setNotes(event.target.value)} /></div>
                        </div>
                        {canManage && (
                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary" disabled={saving}>Cerrar</Button>
                                </DialogClose>
                                <Button type="button" disabled={saving} onClick={handleSaveTerms}>Guardar condiciones</Button>
                                {contract.status === "draft" && (
                                    <Button type="button" disabled={saving} onClick={() => void updateContract(
                                        () => ServiceContractService.activate(contract.id),
                                        "Contrato activado",
                                    )}>
                                        <RotateCcw className="size-4" aria-hidden="true" /> Activar contrato
                                    </Button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    )
}
