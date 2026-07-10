"use client"

import * as React from "react"
import { LocationCheckoutChecklistBuilder } from "./LocationCheckoutChecklistBuilder"
import { UploadService } from "@/services/upload.service"
import { compressImageFile } from "@/lib/image"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Client } from "@/services/client.service"
import { Location, LocationService } from "@/services/location.service"
import { toast } from "@/lib/toast"
import { useDictionary } from "@/lib/dictionary-context"
import { CollaborationService } from "@/services/collaboration.service"
import { Company } from "@/types/company"
import { normalizeLocationType } from "@/domain/locations/location-type"
import { LocationFormAccommodationSection } from "./LocationFormAccommodationSection"
import { LocationFormAddressFields } from "./LocationFormAddressFields"
import { LocationFormActions } from "./LocationFormActions"
import { LocationFormClientTypeFields } from "./LocationFormClientTypeFields"
import { LocationFormMapCoordinatesSection } from "./LocationFormMapCoordinatesSection"
import { LocationFormPhotoField } from "./LocationFormPhotoField"
import { LocationFormRoomsSection } from "./LocationFormRoomsSection"
import { LocationFormServiceProviderField } from "./LocationFormServiceProviderField"
import { LocationFormRoomItem } from "./location-form-types"

interface EditLocationSheetProps {
    location: Location | null
    clients: Client[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onLocationUpdated?: () => void
}

type EditLocationFormProps = {
    location: Location
    clients: Client[]
    onClose: () => void
    onLocationUpdated?: () => void
}

function EditLocationForm({
    location,
    clients,
    onClose,
    onLocationUpdated,
}: EditLocationFormProps) {
    const { dict } = useDictionary()
    const [isLoading, setIsLoading] = React.useState(false)
    const [photoUrl, setPhotoUrl] = React.useState(location.photo_url || "")
    const [uploadingPhoto, setUploadingPhoto] = React.useState(false)
    const [serviceProviders, setServiceProviders] = React.useState<Company[]>([])
    const [providersLoading, setProvidersLoading] = React.useState(true)
    const [selectedProviderId, setSelectedProviderId] = React.useState(
        () => location.default_service_provider_id?.toString() || ""
    )
    const [roomsList, setRoomsList] = React.useState<LocationFormRoomItem[]>(
        () => ((location.rooms || []) as LocationFormRoomItem[]).slice()
    )
    const [checkoutChecklist, setCheckoutChecklist] = React.useState<string[]>(
        () => (location.checkout_checklist || []).slice()
    )

    React.useEffect(() => {
        let cancelled = false
        React.startTransition(() => setProvidersLoading(true))
        CollaborationService.getServiceProviders()
            .then((providers) => {
                if (!cancelled) setServiceProviders(providers)
            })
            .catch(() => {
                if (!cancelled) {
                    setServiceProviders([])
                    toast.error(dict.locations.form.providers_load_error)
                }
            })
            .finally(() => {
                if (!cancelled) setProvidersLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [dict.locations.form.providers_load_error])

    const handleAddRoom = () => {
        const newId = Date.now().toString()
        setRoomsList([
            ...roomsList,
            {
                id: newId,
                name: dict.locations.form.room_default_name.replace("{number}", String(roomsList.length + 1)),
                double_beds: 0,
                single_beds: 0,
                bunk_beds: 0
            }
        ])
    }

    const updateBedCount = (roomIndex: number, bedType: "double_beds" | "single_beds" | "bunk_beds", change: number) => {
        const newRooms = [...roomsList]
        const val = (newRooms[roomIndex][bedType] || 0) + change
        newRooms[roomIndex][bedType] = Math.max(0, val)
        setRoomsList(newRooms)
    }

    const handleRoomNameChange = (roomIndex: number, name: string) => {
        const newRooms = [...roomsList]
        newRooms[roomIndex].name = name
        setRoomsList(newRooms)
    }

    const handleRemoveRoom = (roomId: string | number | undefined) => {
        setRoomsList(roomsList.filter((r) => r.id !== roomId))
    }

    const totalCapacity = React.useMemo(() => {
        return roomsList.reduce((acc, r) => acc + (r.double_beds * 2 + r.single_beds * 1 + r.bunk_beds * 2), 0)
    }, [roomsList])

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setUploadingPhoto(true)
            const uploadToast = toast.loading(dict.profile.form.toast_compressing)
            const compressedFile = await compressImageFile(file)
            const result = await UploadService.uploadFile(compressedFile, "location")
            setPhotoUrl(result.url)
            toast.success(dict.profile.form.photo_uploaded, { id: uploadToast })
        } catch (error) {
            console.error("Error uploading location photo", error)
            toast.error(dict.profile.form.toast_compress_error)
        } finally {
            setUploadingPhoto(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const formData = new FormData(e.currentTarget)
            const latVal = formData.get("latitude") as string
            const lonVal = formData.get("longitude") as string

            const clientValue = formData.get("client") as string
            await LocationService.updateLocation(location.id, {
                name: formData.get("name") as string,
                address: formData.get("address") as string,
                city: formData.get("city") as string,
                postal_code: (formData.get("postal_code") as string) || undefined,
                client_id: clientValue ? parseInt(clientValue) : null,
                photo_url: photoUrl || undefined,
                map_url: (formData.get("map_url") as string) || undefined,
                location_type: formData.get("location_type") as string,
                latitude: latVal ? parseFloat(latVal) : undefined,
                longitude: lonVal ? parseFloat(lonVal) : undefined,
                num_bathrooms: parseInt(formData.get("num_bathrooms") as string) || 0,
                has_garage: formData.get("has_garage") === "on",
                has_kitchen: formData.get("has_kitchen") === "on",
                has_terrace: formData.get("has_terrace") === "on",
                rooms: roomsList,
                checkout_checklist: checkoutChecklist,
                default_service_provider_id: selectedProviderId ? parseInt(selectedProviderId, 10) : null,
            })

            toast.success(dict.locations.form.update_success_toast)
            onClose()
            onLocationUpdated?.()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.locations.form.update_error_toast)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                <DialogTitle>{dict.locations.form.edit_title}</DialogTitle>
                <DialogDescription>
                    {dict.locations.form.edit_description}
                </DialogDescription>
            </DialogHeader>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="edit-name" className="text-[var(--text-main)]">{dict.locations.form.name_label}</Label>
                    <Input
                        id="edit-name" name="name"
                        defaultValue={location.name}
                        required
                        className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                    />
                </div>

                <LocationCheckoutChecklistBuilder
                    checklist={checkoutChecklist}
                    onChange={setCheckoutChecklist}
                    dict={dict}
                />

                <LocationFormAddressFields
                    idPrefix="edit-"
                    addressDefault={location.address}
                    cityDefault={location.city}
                    postalCodeDefault={location.postal_code}
                    showAddressPlaceholder={false}
                />

                <LocationFormClientTypeFields
                    clients={clients}
                    idPrefix="edit-"
                    clientSelectKey={location.id}
                    clientDefaultValue={location.client_id || ""}
                    locationTypeSelectKey={`type-${location.id}`}
                    locationTypeDefaultValue={normalizeLocationType(location.location_type)}
                />

                <LocationFormServiceProviderField
                    id="edit-default-service-provider"
                    selectedProviderId={selectedProviderId}
                    onProviderChange={setSelectedProviderId}
                    serviceProviders={serviceProviders}
                    providersLoading={providersLoading}
                    hintClassName="text-xs leading-5 text-[var(--text-muted)]"
                />

                <LocationFormAccommodationSection
                    idPrefix="edit-"
                    sectionKey={`features-${location.id}`}
                    numBathroomsDefault={location.num_bathrooms ?? 1}
                    hasKitchenDefault={location.has_kitchen ?? true}
                    hasGarageDefault={location.has_garage ?? true}
                    hasTerraceDefault={location.has_terrace ?? true}
                />

                <LocationFormRoomsSection
                    roomsList={roomsList}
                    totalCapacity={totalCapacity}
                    onAddRoom={handleAddRoom}
                    onUpdateBedCount={updateBedCount}
                    onRoomNameChange={handleRoomNameChange}
                    onRemoveRoom={handleRemoveRoom}
                />

                <LocationFormPhotoField
                    photoUrl={photoUrl}
                    uploadingPhoto={uploadingPhoto}
                    onPhotoUpload={handlePhotoUpload}
                />

                <LocationFormMapCoordinatesSection
                    idPrefix="edit-"
                    mapUrlDefault={location.map_url}
                    latitudeDefault={location.latitude}
                    longitudeDefault={location.longitude}
                />
            </div>

            <LocationFormActions
                isLoading={isLoading}
                onCancel={onClose}
            />
        </form>
    )
}

export function EditLocationSheet({
    location,
    clients,
    open,
    onOpenChange,
    onLocationUpdated,
}: EditLocationSheetProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] flex flex-col p-0 overflow-hidden sm:max-w-xl">
                {open && location ? (
                    <EditLocationForm
                        key={location.id}
                        location={location}
                        clients={clients}
                        onClose={() => onOpenChange(false)}
                        onLocationUpdated={onLocationUpdated}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
