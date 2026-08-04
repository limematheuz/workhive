"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocationService, Location } from "@/services/location.service";
import { ClientService, Client } from "@/services/client.service";
import { TaskService, TaskItem } from "@/services/task.service";
import { CollaborationService } from "@/services/collaboration.service";
import { CompanyCollaboration } from "@/types/collaboration";
import { LocationsGrid } from "@/components/locations/LocationsGrid";
import { EditLocationSheet } from "@/components/locations/EditLocationSheet";
import { LocationTasksSheet } from "@/components/locations/LocationTasksSheet";
import { CreateLocationSheet } from "@/components/locations/CreateLocationSheet";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { toast } from "@/lib/toast";
import { MapPin, Home, Share2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
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
    const [selectedClientId, setSelectedClientId] = useState<number | "ALL">("ALL");

    // Filter and tab state
    const [activeTab, setActiveTab] = useState<"own" | "shared">("own");
    const [collaboratorFilter] = useState<number | "ALL">("ALL");
    const [ownerFilter, setOwnerFilter] = useState<number | "ALL">("ALL");

    const isReadOnly = user?.role?.name === "viewer" || user?.role?.name === "manager";

    // Edit state
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [editSheetOpen, setEditSheetOpen] = useState(false);

    // Task state
    const [tasksLocation, setTasksLocation] = useState<Location | null>(null);
    const [tasksSheetOpen, setTasksSheetOpen] = useState(false);

    // Delete state
    const deletingLocationRef = useRef<Location | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadInitialData = useCallback(async () => {
        try {
            const [clientsData, collaborationsData] = await Promise.all([
                ClientService.getClients(),
                CollaborationService.getCollaborations().catch(() => [] as CompanyCollaboration[])
            ]);
            setClients(clientsData);
            setCollaborations(collaborationsData);
        } catch (error) {
            console.error("Error loading initial data", error);
        }
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
    }, POLL_INTERVALS.locations);

    const handleEdit = (location: Location) => {
        setEditingLocation(location);
        setEditSheetOpen(true);
    };

    const handleTasksClick = (location: Location) => {
        setTasksLocation(location);
        setTasksSheetOpen(true);
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

    return (
        <div className="px-[3%] py-6 md:p-8 h-full overflow-y-auto">
            <PageHeader
                icon={MapPin}
                title={dict.locations.title}
                subtitle={dict.locations.subtitle || "Gestiona los locales, sedes e instalaciones donde presta servicio tu equipo."}
                className="mb-8"
                actions={!isReadOnly ? <CreateLocationSheet clients={clients} defaultClientId={selectedClientId} onLocationCreated={loadLocations} /> : undefined}
            />

            {/* Owned and shared property tabs */}
            <PremiumTabs
                layout="fit"
                tabs={[
                    { id: "own" as const, label: `${dict.locations?.tabs?.own || "Propias"} (${locations.filter((l) => getOwnerCompanyId(l) == null || getOwnerCompanyId(l) === user?.company_id).length})`, icon: Home },
                    { id: "shared" as const, label: `${dict.locations?.tabs?.shared || "Compartidas"} (${locations.filter((l) => getOwnerCompanyId(l) != null && getOwnerCompanyId(l) !== user?.company_id).length})`, icon: Share2 }
                ]}
                activeTab={activeTab}
                onChange={(tab) => setActiveTab(tab as "own" | "shared")}
                className="mb-6"
            />

            {/* Unified premium filter bar */}
            <div className="flex flex-wrap items-center gap-4 bg-[var(--bg-card)] border border-[var(--border-soft)] p-4 rounded-3xl shadow-sm mb-6">
                {activeTab === "own" ? (
                    <select
                        aria-label={dict.locations?.filter?.all_clients || "Todos los clientes"}
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value === "ALL" ? "ALL" : parseInt(e.target.value))}
                        className="bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/50 font-semibold uppercase tracking-wider cursor-pointer ui-motion w-full md:w-[260px]"
                    >
                        <option value="ALL">{dict.locations?.filter?.all_clients || "Todos los clientes"}</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                ) : (
                    <select
                        aria-label="Todos los colaboradores"
                        value={ownerFilter}
                        onChange={(e) => setOwnerFilter(e.target.value === "ALL" ? "ALL" : parseInt(e.target.value))}
                        className="bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/50 font-semibold uppercase tracking-wider cursor-pointer ui-motion w-full md:w-[260px]"
                    >
                        <option value="ALL">Todos los colaboradores</option>
                        {collaborators.map((collab) => (
                            <option key={collab.id} value={collab.id}>
                                {collab.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Filtered locations grid */}
            <LocationsGrid
                locations={activeTab === "own" ? ownLocations : sharedLocations}
                clients={clients}
                tasks={tasks}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onTasks={handleTasksClick}
            />

            {/* Edit sheet */}
            <EditLocationSheet
                location={editingLocation}
                clients={clients}
                open={editSheetOpen}
                onOpenChange={setEditSheetOpen}
                onLocationUpdated={loadLocations}
            />

            {/* Checklist task sheet */}
            <LocationTasksSheet
                location={tasksLocation}
                open={tasksSheetOpen}
                onOpenChange={setTasksSheetOpen}
                initialTab={user?.role?.name === "viewer" ? "history" : "templates"}
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
