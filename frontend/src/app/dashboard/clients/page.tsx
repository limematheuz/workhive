"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClientService, Client } from "@/services/client.service";
import { ClientsTable } from "@/components/clients/ClientsTable";
import { CreateClientSheet } from "@/components/clients/CreateClientSheet";
import { EditClientSheet } from "@/components/clients/EditClientSheet";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { toast } from "@/lib/toast";
import { ClientDetailDialog } from "@/components/clients/ClientDetailDialog";
import { ClientTaskDetailDialog } from "@/components/clients/ClientTaskDetailDialog";
import { LocationTasksSheet } from "@/components/locations/LocationTasksSheet";
import { Location } from "@/services/location.service";
import { TaskItem } from "@/services/task.service";
import { Building2, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import {
    filterClients,
    type ClientStatusFilter,
} from "@/lib/client-filters";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

export default function ClientsPage() {
    const { dict } = useDictionary();
    const { user } = useUser();
    const [clients, setClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>("active");

    const isReadOnly = user?.role?.name === "viewer" || user?.role?.name === "manager";

    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [editSheetOpen, setEditSheetOpen] = useState(false);

    const deletingClientRef = useRef<Client | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [detailsClient, setDetailsClient] = useState<Client | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

    const [tasksLocation, setTasksLocation] = useState<Location | null>(null);
    const [tasksSheetOpen, setTasksSheetOpen] = useState(false);

    const [viewingTask, setViewingTask] = useState<TaskItem | null>(null);
    const [backToClient, setBackToClient] = useState(false);

    const loadClients = useCallback(async () => {
        try {
            const data = await ClientService.getClients(null);
            setClients(data);
        } catch (error) {
            console.error("Error loading clients", error);
            toast.error("Error loading clients");
        }
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadClients();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadClients]);

    useBackgroundPolling(loadClients, POLL_INTERVALS.clients);

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setEditSheetOpen(true);
    };

    const handleDeleteClick = (client: Client) => {
        deletingClientRef.current = client;
        setDeleteDialogOpen(true);
    };

    const handleToggleActive = async (client: Client) => {
        try {
            await ClientService.updateClient(client.id, { is_active: !client.is_active });
            setClients((current) =>
                current.map((item) =>
                    item.id === client.id
                        ? { ...item, is_active: !client.is_active }
                        : item
                )
            );
            setDetailsClient((current) =>
                current?.id === client.id
                    ? { ...current, is_active: !client.is_active }
                    : current
            );
            toast.success(
                client.is_active
                    ? "Cliente desactivado."
                    : "Cliente activado."
            );
            void loadClients();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.clients.form.update_error_toast);
        }
    };

    const handleDeleteConfirm = async () => {
        const deletingClient = deletingClientRef.current;
        if (!deletingClient) return;
        setIsDeleting(true);
        try {
            await ClientService.deleteClient(deletingClient.id);
            toast.success(dict.clients.form.delete_success_toast);
            setDeleteDialogOpen(false);
            deletingClientRef.current = null;
            loadClients();
        } catch {
            toast.error(dict.clients.form.delete_error_toast);
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredClients = filterClients(clients, searchTerm, statusFilter);

    return (
        <div className="px-[3%] py-6 md:p-8 h-full overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-accent" />
                        {dict.clients.title}
                    </h1>
                    <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
                        {dict.clients.subtitle || "Gestiona los clientes de tu empresa y su información de facturación y contacto."}
                    </p>
                </div>
                {!isReadOnly && <CreateClientSheet onClientCreated={loadClients} />}
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-stretch mb-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <Input
                        type="text"
                        placeholder={dict.clients.search_placeholder || "Buscar por nombre, NIF/CIF, email..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-[var(--bg-secondary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus-visible:ring-1 focus-visible:ring-[var(--border-color)]"
                    />
                </div>
                <div className="relative md:w-52">
                    <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <select
                        aria-label={dict.clients.filter_status_label}
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                        className="h-9 w-full rounded-md border border-[var(--border-soft)] bg-[var(--bg-secondary)] pl-10 pr-3 text-sm font-semibold text-[var(--text-main)] outline-none"
                    >
                        <option value="active">{dict.clients.filter_active}</option>
                        <option value="inactive">{dict.clients.filter_inactive}</option>
                        <option value="all">{dict.clients.filter_all}</option>
                    </select>
                </div>
            </div>

            <ClientsTable
                clients={filteredClients}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onToggleActive={handleToggleActive}
                onDetails={(client) => {
                    setDetailsClient(client);
                    setDetailsDialogOpen(true);
                }}
            />

            <EditClientSheet
                client={editingClient}
                open={editSheetOpen}
                onOpenChange={setEditSheetOpen}
                onClientUpdated={loadClients}
            />

            <ClientDetailDialog
                client={detailsClient}
                open={detailsDialogOpen}
                onOpenChange={setDetailsDialogOpen}
                onViewLocationTasks={(loc) => {
                    setTasksLocation(loc);
                    setTasksSheetOpen(true);
                }}
                onViewTaskDetails={(task) => {
                    setBackToClient(true);
                    setViewingTask(task);
                }}
                onEditClient={handleEdit}
                onToggleActiveClient={handleToggleActive}
                onDeleteClient={handleDeleteClick}
                canManage={!isReadOnly}
            />

            <LocationTasksSheet
                location={tasksLocation}
                open={tasksSheetOpen}
                onOpenChange={setTasksSheetOpen}
                initialCreateForm={false}
                readOnly={true}
            />

            <ClientTaskDetailDialog
                task={viewingTask}
                showBackToClient={backToClient}
                onClose={() => setViewingTask(null)}
                onBackToClient={() => {
                    setViewingTask(null);
                    setDetailsDialogOpen(true);
                    setBackToClient(false);
                }}
            />

            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) deletingClientRef.current = null;
                }}
                title={dict.clients.delete_dialog.title}
                description={dict.clients.delete_dialog.description}
                onConfirm={handleDeleteConfirm}
                isDeleting={isDeleting}
                confirmText={dict.clients.delete_dialog.confirm}
                cancelText={dict.clients.delete_dialog.cancel}
            />
        </div>
    );
}
