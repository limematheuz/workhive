"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocationService, Location } from "@/services/location.service";
import { ClientService, Client } from "@/services/client.service";
import { TaskService, TaskItem } from "@/services/task.service";
import { CollaborationService } from "@/services/collaboration.service";
import { CompanyCollaboration } from "@/types/collaboration";
import { LocationsGrid } from "@/components/locations/LocationsGrid";
import { EditLocationSheet } from "@/components/locations/EditLocationSheet";
import { CreateLocationSheet } from "@/components/locations/CreateLocationSheet";
import { LocationBulkImportDialog } from "@/components/locations/LocationBulkImportDialog";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { toast } from "@/lib/toast";
import { MapPin, Home, Share2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
import { POLL_INTERVALS } from "@/lib/polling";

const getOwnerCompanyId = (location: Location) =>
    location.owner_company_id ?? location.managing_company_id;

export default function LocationsPage() {
    const { dict } = useDictionary();
    const { user } = useUser();
    const [locations, setLocations] = useState<Location[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [collaborations, setCollaborations] = useState<CompanyCollaboration[]>([]);
    const [canReadClients, setCanReadClients] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<number | "ALL">("ALL");

    // Filter and tab state
    const [activeTab, setActiveTab] = useState<"own" | "shared">("own");
    const [collaboratorFilter] = useState<number | "ALL">("ALL");
    const [ownerFilter, setOwnerFilter] = useState<number | "ALL">("ALL");

    const isReadOnly = user?.role?.name === "viewer" || user?.role?.name === "manager";

    // Edit state
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [editSheetOpen, setEditSheetOpen] = useState(false);

    // Delete state
    const deletingLocationRef = useRef<Location | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadInitialData = useCallback(async () => {
        try {
            const [clientsData, collaborationsData] = await Promise.all([
                canReadClients ? ClientService.getClients() : Promise.resolve([] as Client[]),
                CollaborationService.getCollaborations().catch(() => [] as CompanyCollaboration[])
            ]);
            setClients(clientsData);
            setCollaborations(collaborationsData);
        } catch (error) {
            console.error("Error loading initial data", error);
        }
    }, [canReadClients]);

    useEffect(() => {
        let cancelled = false;

        void ClientService.getAccess().then((access) => {
            if (!cancelled) setCanReadClients(access.can_read_clients);
        }).catch(() => {
            if (!cancelled) setCanReadClients(false);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadInitialData();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadInitialData]);

    const loadLocations = useCallback(async () => {
        try {
            const clientIdParam = selectedClientId === "ALL" ? undefined : selectedClientId;
            const data = await LocationService.getLocations(clientIdParam);
            setLocations(data);

            const tasksData = await TaskService.getTaskItems().catch(() => [] as TaskItem[]);
            setTasks(tasksData);
        } catch (error) {
            console.error("Error loading locations", error);
        }
    }, [selectedClientId]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadLocations();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadLocations]);

    useBackgroundPolling(async () => {
        await Promise.all([loadInitialData(), loadLocations()]);
    }, POLL_INTERVALS.locations, POLL_INTERVALS.realtimeSafety);
    useRealtimeInvalidation(["clients", "collaborations", "locations", "tasks"], () => {
        void Promise.all([loadInitialData(), loadLocations()]);
    });

    const handleEdit = (location: Location) => {
        setEditingLocation(location);
        setEditSheetOpen(true);
    };

    const handleDeleteClick = (location: Location) => {
        deletingLocationRef.current = location;
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        const deletingLocation = deletingLocationRef.current;
        if (!deletingLocation || !user || !user.company_id) return;
        setIsDeleting(true);
        try {
            const isOwner = getOwnerCompanyId(deletingLocation) === user.company_id;

            if (isOwner) {
                // Full delete — we own this location
                await LocationService.deleteLocation(deletingLocation.id);
                toast.success(dict.locations.form.delete_success_toast);
            } else {
                // Self-removal — revoke our own shared access
                await LocationService.deleteLocationAccess(deletingLocation.id, user.company_id);
                toast.success("Acceso a la ubicación compartida eliminado correctamente.");
            }

            setDeleteDialogOpen(false);
            deletingLocationRef.current = null;
            loadLocations();
        } catch {
            toast.error(dict.locations.form.delete_error_toast);
        } finally {
            setIsDeleting(false);
        }
    };


    // Map accepted collaborators
    const collaborators = useMemo(() => {
        if (!user) return [];
        return collaborations.flatMap((c) =>
            c.status === "accepted"
                ? [c.initiator_company_id === user.company_id ? c.partner : c.initiator]
                : []
        );
    }, [collaborations, user]);

    // Filter owned locations
    const ownLocations = useMemo(() => {
        if (!user) return [];
        let list = locations.filter(
            (loc) => getOwnerCompanyId(loc) == null || getOwnerCompanyId(loc) === user.company_id
        );
        if (collaboratorFilter !== "ALL") {
            list = list.filter((loc) => loc.shared_companies?.includes(collaboratorFilter));
        }
        return list;
    }, [locations, user, collaboratorFilter]);

    // Filter shared locations
    const sharedLocations = useMemo(() => {
        if (!user) return [];
        let list = locations.filter(
            (loc) => getOwnerCompanyId(loc) != null && getOwnerCompanyId(loc) !== user.company_id
        );
        if (ownerFilter !== "ALL") {
            list = list.filter((loc) => getOwnerCompanyId(loc) === ownerFilter);
        }
        return list;
    }, [locations, user, ownerFilter]);

    const filterSelectTriggerClass = "h-9 w-auto min-w-[11rem] max-w-full text-xs font-semibold uppercase tracking-wider";

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader
                icon={MapPin}
                title={dict.locations.title}
                subtitle={dict.locations.subtitle || "Gestiona los locales, sedes e instalaciones donde presta servicio tu equipo."}
                className="mb-6"
                actions={!isReadOnly ? (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <LocationBulkImportDialog onImported={loadLocations} />
                        <CreateLocationSheet clients={clients} defaultClientId={selectedClientId} onLocationCreated={loadLocations} />
                    </div>
                ) : undefined}
            />

            <section className="billing-surface relative overflow-hidden rounded-[24px] p-4 sm:p-5">
                <div className="space-y-4">
                    <PremiumTabs
                        layout="fit"
                        tabs={[
                            { id: "own" as const, label: `${dict.locations?.tabs?.own || "Propias"} (${locations.filter((l) => getOwnerCompanyId(l) == null || getOwnerCompanyId(l) === user?.company_id).length})`, icon: Home },
                            { id: "shared" as const, label: `${dict.locations?.tabs?.shared || "Compartidas"} (${locations.filter((l) => getOwnerCompanyId(l) != null && getOwnerCompanyId(l) !== user?.company_id).length})`, icon: Share2 }
                        ]}
                        activeTab={activeTab}
                        onChange={(tab) => setActiveTab(tab as "own" | "shared")}
                    />

                    <div className="billing-block inline-flex max-w-full items-center rounded-xl px-2 py-1.5">
                        {activeTab === "own" ? (
                            <Select
                                value={String(selectedClientId)}
                                onValueChange={(value) => setSelectedClientId(value === "ALL" ? "ALL" : parseInt(value))}
                            >
                                <SelectTrigger aria-label={dict.locations?.filter?.all_clients || "Todos los clientes"} className={filterSelectTriggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">{dict.locations?.filter?.all_clients || "Todos los clientes"}</SelectItem>
                                    {clients.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Select
                                value={String(ownerFilter)}
                                onValueChange={(value) => setOwnerFilter(value === "ALL" ? "ALL" : parseInt(value))}
                            >
                                <SelectTrigger aria-label="Todos los colaboradores" className={filterSelectTriggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todos los colaboradores</SelectItem>
                                    {collaborators.map((collab) => (
                                        <SelectItem key={collab.id} value={String(collab.id)}>
                                            {collab.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <LocationsGrid
                        locations={activeTab === "own" ? ownLocations : sharedLocations}
                        clients={clients}
                        tasks={tasks}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                    />
                </div>
            </section>

            <EditLocationSheet
                location={editingLocation}
                clients={clients}
                open={editSheetOpen}
                onOpenChange={setEditSheetOpen}
                onLocationUpdated={loadLocations}
            />
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) deletingLocationRef.current = null;
                }}
                title={dict.locations.delete_dialog.title}
                description={dict.locations.delete_dialog.description}
                onConfirm={handleDeleteConfirm}
                isDeleting={isDeleting}
                confirmText={dict.locations.delete_dialog.confirm}
                cancelText={dict.locations.delete_dialog.cancel}
            />
        </div>
    );
}
