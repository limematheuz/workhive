"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import { TemplateTask, HouseTemplate } from "@/hooks/useTasksPage";
import { Reservation } from "@/types/reservation";
import type { Dictionary } from "@/lib/dictionary-context";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { TaskCreateMainFields } from "./TaskCreateMainFields";
import { TaskCreateReservationSection } from "./TaskCreateReservationSection";
import { TaskCreateHouseChecklistSection } from "./TaskCreateHouseChecklistSection";
import { canManageLocationReservations } from "@/features/reservations/reservation-helpers";
import {
    taskDialogBodyClass,
    taskDialogContentClass,
    taskDialogDangerBtnClass,
    taskDialogFooterClass,
    taskDialogHeaderClass,
    taskDialogOverlayClass,
    taskDialogPrimaryBtnClass,
} from "./taskDialogChrome";

interface TaskCreateModalProps {
    dict: Dictionary;
    adminOrManager: boolean;
    currentUser: User | null;
    locations: Location[];
    users: User[];
    templates: TemplateTask[];
    saving: boolean;
    createOpen: boolean;
    setCreateOpen: (open: boolean) => void;
    houseTemplates: HouseTemplate[];
    loadingHouseTemplates: boolean;
    selectedHouseTemplateIds: number[];
    useHouseChecklist: boolean;
    setUseHouseChecklist: (use: boolean) => void;
    toggleHouseTemplateSelection: (id: number) => void;
    availableTemplates: TemplateTask[];
    handleLinkHouseTemplate: (templateTaskId: number, customPrice: number | null) => Promise<void>;
    newLocationId: string;
    setNewLocationId: (val: string) => void;
    newCreatedAt: string;
    setNewCreatedAt: (val: string) => void;
    availableReservations: Reservation[];
    loadingReservations: boolean;
    newCheckoutReservationId: string;
    setNewCheckoutReservationId: (val: string) => void;
    newNextReservationId: string;
    setNewNextReservationId: (val: string) => void;
    handleCreateTask: (e: React.FormEvent) => void;
    fixedChecklistAssignments: Record<string, string>;
    setFixedChecklistAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function TaskCreateModal({
    dict,
    adminOrManager,
    currentUser,
    locations,
    users,
    templates,
    saving,
    createOpen,
    setCreateOpen,
    houseTemplates,
    loadingHouseTemplates,
    selectedHouseTemplateIds,
    useHouseChecklist,
    setUseHouseChecklist,
    toggleHouseTemplateSelection,
    availableTemplates,
    handleLinkHouseTemplate,
    newLocationId,
    setNewLocationId,
    newCreatedAt,
    setNewCreatedAt,
    availableReservations,
    loadingReservations,
    newCheckoutReservationId,
    setNewCheckoutReservationId,
    newNextReservationId,
    setNewNextReservationId,
    handleCreateTask,
    fixedChecklistAssignments,
    setFixedChecklistAssignments,
}: TaskCreateModalProps) {
    const currentCompanyId = currentUser?.company_id;
    const ownLocations = locations.filter(location => (
        !currentCompanyId
        || location.owner_company_id === currentCompanyId
        || location.managing_company_id === currentCompanyId
        || (!location.owner_company_id && !location.managing_company_id)
    ));
    const selectedLocation = locations.find(
        (location) => location.id.toString() === newLocationId,
    );
    const canLinkReservations = Boolean(
        selectedLocation
        && canManageLocationReservations(selectedLocation, currentCompanyId),
    );
    const visibleHouseTemplates = React.useMemo(
        () => houseTemplates.filter((houseTemplate) =>
            templates.some((template) => template.id === houseTemplate.template_task_id)
        ),
        [houseTemplates, templates]
    );
    const calendarOwnerName = React.useMemo(() => {
        const preferredAdmin = users.find(user =>
            user.id === currentUser?.id &&
            ["admin", "manager", "superadmin"].includes(user.role?.name || "")
        );
        const fallbackAdmin = users.find(user =>
            ["admin", "superadmin"].includes(user.role?.name || "")
        ) || users.find(user => user.role?.name === "manager");
        const calendarOwner = preferredAdmin || fallbackAdmin || currentUser;
        return calendarOwner
            ? calendarOwner.full_name || calendarOwner.email
            : "Administrador del calendario";
    }, [currentUser, users]);

    return (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent
                overlayClassName={taskDialogOverlayClass}
                className={`${taskDialogContentClass} max-h-[min(95vh,860px)] sm:max-w-2xl md:max-w-3xl`}
            >
                <DialogHeader className={taskDialogHeaderClass}>
                    <DialogTitle className="text-xl font-bold tracking-tight text-[var(--text-main)]">
                        {dict.tasks?.create_dialog?.title || "Create Checklist / Register Work"}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                        {dict.tasks?.create_dialog?.subtitle || "Select the location, assign workers, and define default checklist tasks."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateTask} className="flex min-h-0 flex-1 flex-col font-sans">
                    <div className={taskDialogBodyClass}>
                        <TaskCreateMainFields
                            dict={dict}
                            ownLocations={ownLocations}
                            calendarOwnerName={calendarOwnerName}
                            newLocationId={newLocationId}
                            setNewLocationId={setNewLocationId}
                            newCreatedAt={newCreatedAt}
                            setNewCreatedAt={setNewCreatedAt}
                        />

                        {newLocationId && canLinkReservations && (
                            <TaskCreateReservationSection
                                loadingReservations={loadingReservations}
                                availableReservations={availableReservations}
                                newCheckoutReservationId={newCheckoutReservationId}
                                setNewCheckoutReservationId={setNewCheckoutReservationId}
                                newNextReservationId={newNextReservationId}
                                setNewNextReservationId={setNewNextReservationId}
                            />
                        )}

                        {newLocationId && (
                            <TaskCreateHouseChecklistSection
                                dict={dict}
                                isAdminOrManager={adminOrManager}
                                users={users}
                                templates={templates}
                                houseTemplates={houseTemplates}
                                visibleHouseTemplates={visibleHouseTemplates}
                                loadingHouseTemplates={loadingHouseTemplates}
                                selectedHouseTemplateIds={selectedHouseTemplateIds}
                                useHouseChecklist={useHouseChecklist}
                                setUseHouseChecklist={setUseHouseChecklist}
                                toggleHouseTemplateSelection={toggleHouseTemplateSelection}
                                availableTemplates={availableTemplates}
                                handleLinkHouseTemplate={handleLinkHouseTemplate}
                                fixedChecklistAssignments={fixedChecklistAssignments}
                                setFixedChecklistAssignments={setFixedChecklistAssignments}
                            />
                        )}
                    </div>

                    <div className={`${taskDialogFooterClass} justify-end`}>
                        <button
                            type="button"
                            onClick={() => setCreateOpen(false)}
                            className={taskDialogDangerBtnClass}
                        >
                            {dict.tasks?.create_dialog?.cancel || "Cancel"}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className={taskDialogPrimaryBtnClass}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {dict.tasks?.create_dialog?.creating || "Creating..."}
                                </>
                            ) : (
                                dict.tasks?.create_dialog?.register_jobs || "Register Work"
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
