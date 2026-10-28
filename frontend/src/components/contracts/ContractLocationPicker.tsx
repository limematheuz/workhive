"use client"

import { useRef, useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDialogFormGuardReset } from "@/components/ui/dialog-form-guard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Location } from "@/types/location"

type ContractLocationPickerProps = {
    locations: Location[]
    saving: boolean
    onAdd: (locationId: number, onAdded: () => void) => void
}

export function ContractLocationPicker({ locations, saving, onAdd }: ContractLocationPickerProps) {
    const [selectedLocationId, setSelectedLocationId] = useState("")
    const picker = useRef<HTMLDivElement>(null)
    const resetDirty = useDialogFormGuardReset()
    const addLocation = () => {
        const locationId = Number(selectedLocationId)
        if (!Number.isSafeInteger(locationId) || locationId < 1) return
        onAdd(locationId, () => {
            // Clear only this saved picker before the refreshed coverage removes it.
            if (picker.current) resetDirty(picker.current)
            setSelectedLocationId("")
        })
    }

    return <div ref={picker} className="flex min-w-[14rem] gap-2">
        <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={saving}>
            <SelectTrigger aria-label="Añadir ubicación cubierta" className="h-9 min-w-0"><SelectValue placeholder="Selecciona ubicación" /></SelectTrigger>
            <SelectContent>{locations.map(location => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={addLocation} disabled={saving || !selectedLocationId} aria-label="Añadir ubicación">
            <Plus className="size-4" aria-hidden="true" />
        </Button>
    </div>
}
