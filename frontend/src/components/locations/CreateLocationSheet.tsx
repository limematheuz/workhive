"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LocationCheckoutChecklistBuilder } from "./LocationCheckoutChecklistBuilder"
import { UploadService } from "@/services/upload.service"
import { compressImageFile } from "@/lib/image"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Client } from "@/services/client.service"
import { toast } from "@/lib/toast"
import { LocationService } from "@/services/location.service"
import { useDictionary } from "@/lib/dictionary-context"
import { CollaborationService } from "@/services/collaboration.service"
import { Company } from "@/types/company"
import { LocationFormAccommodationSection } from "./LocationFormAccommodationSection"
import { LocationFormAddressFields } from "./LocationFormAddressFields"
import { LocationFormActions } from "./LocationFormActions"
import { LocationFormClientTypeFields } from "./LocationFormClientTypeFields"
import { LocationFormMapCoordinatesSection } from "./LocationFormMapCoordinatesSection"
import { LocationFormPhotoField } from "./LocationFormPhotoField"
import { LocationFormRoomsSection } from "./LocationFormRoomsSection"
import { LocationFormServiceProviderField } from "./LocationFormServiceProviderField"
import { LocationFormRoomItem } from "./location-form-types"

interface CreateLocationSheetProps {
    clients: Client[]
    defaultClientId: number | "ALL"
    onLocationCreated?: () => void
}

type CreateLocationFormProps = {
    clients: Client[]
    defaultClientId: number | "ALL"
    onClose: () => void
    onLocationCreated?: () => void
}

function CreateLocationForm({
    clients,
    defaultClientId,
    onClose,
    onLocationCreated,
}: CreateLocationFormProps) {
    const { dict } = useDictionary()
    const [isLoading, setIsLoading] = React.useState(false)
    const [photoUrl, setPhotoUrl] = React.useState("")
    const [uploadingPhoto, setUploadingPhoto] = React.useState(false)
    const [serviceProviders, setServiceProviders] = React.useState<Company[]>([])
    const [providersLoading, setProvidersLoading] = React.useState(true)
    const [selectedProviderId, setSelectedProviderId] = React.useState("")
    const [roomsList, setRoomsList] = React.useState<LocationFormRoomItem[]>([])
    const [checkoutChecklist, setCheckoutChecklist] = React.useState<string[]>([])

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
            await LocationService.createLocation({
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
                default_service_provider_id: selectedProviderId ? parseInt(selectedProviderId, 10) : null,
                num_bathrooms: parseInt(formData.get("num_bathrooms") as string) || 0,
                has_garage: formData.get("has_garage") === "on",
                has_kitchen: formData.get("has_kitchen") === "on",
                has_terrace: formData.get("has_terrace") === "on",
                rooms: roomsList,
                checkout_checklist: checkoutChecklist,
            })

            toast.success(dict.locations.form.success_toast)
            onClose()
            onLocationCreated?.()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.locations.form.error_toast)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                <DialogTitle>{dict.locations.form.create_title}</DialogTitle>
                <DialogDescription>
                    {dict.locations.form.create_description}
                </DialogDescription>
            </DialogHeader>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="name" className="text-[var(--text-main)]">{dict.locations.form.name_label}</Label>
                    <Input
                        id="name" name="name"
                        placeholder={dict.locations.form.name_placeholder}
                        required
                        className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                    />
                </div>

                <LocationFormAddressFields />

                <LocationFormClientTypeFields
                    clients={clients}
                    clientDefaultValue={defaultClientId === "ALL" ? "" : defaultClientId}
                    locationTypeDefaultValue="private"
                />

                <LocationCheckoutChecklistBuilder
                    checklist={checkoutChecklist}
                    onChange={setCheckoutChecklist}
                    dict={dict}
                />

                <LocationFormServiceProviderField
                    id="default_service_provider"
                    selectedProviderId={selectedProviderId}
                    onProviderChange={setSelectedProviderId}
                    serviceProviders={serviceProviders}
                    providersLoading={providersLoading}
                />

                <LocationFormAccommodationSection />

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

                <LocationFormMapCoordinatesSection />
            </div>

            <LocationFormActions
                isLoading={isLoading}
                onCancel={onClose}
            />
        </form>
    )
}

export function CreateLocationSheet({ clients, defaultClientId, onLocationCreated }: CreateLocationSheetProps) {
    const { dict } = useDictionary()
    const [open, setOpen] = React.useState(false)
    const [formKey, setFormKey] = React.useState(0)

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen)
        if (nextOpen) setFormKey((key) => key + 1)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] font-semibold rounded-xl px-5 py-2.5 text-xs border border-[var(--border-soft)] shadow-sm w-full md:w-auto ui-motion cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    {dict.locations.form.new_location}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] flex flex-col p-0 overflow-hidden sm:max-w-xl">
                {open ? (
                    <CreateLocationForm
                        key={formKey}
                        clients={clients}
                        defaultClientId={defaultClientId}
                        onClose={() => handleOpenChange(false)}
                        onLocationCreated={onLocationCreated}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
