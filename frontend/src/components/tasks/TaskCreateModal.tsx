"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl p-0 overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                <DialogHeader className="p-6 pr-20 border-b border-[var(--border-color)] bg-[var(--dialog-bg)] flex-shrink-0 text-left sm:text-left">
                    <DialogTitle className="text-xl font-black text-[var(--text-main)] flex items-center gap-2">
                        {dict.tasks?.create_dialog?.title || "Create Checklist / Register Work"}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-[var(--text-muted)] mt-1 font-medium">
                        {dict.tasks?.create_dialog?.subtitle || "Select the location, assign workers, and define default checklist tasks."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateTask} className="p-6 overflow-y-auto space-y-5 flex-1 font-sans bg-[var(--dialog-bg)]">
                    <TaskCreateMainFields
                        dict={dict}
                        ownLocations={ownLocations}
                        calendarOwnerName={calendarOwnerName}
                        newLocationId={newLocationId}
                        setNewLocationId={setNewLocationId}
                        newCreatedAt={newCreatedAt}
                        setNewCreatedAt={setNewCreatedAt}
                    />

                    {newLocationId && (
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

                    <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border-soft)]">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCreateOpen(false)}
                            className="bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-4 py-2.5 cursor-pointer transition-all"
                        >
                            {dict.tasks?.create_dialog?.cancel || "Cancel"}
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving}
                            className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {dict.tasks?.create_dialog?.creating || "Creating..."}
                                </>
                            ) : (
                                dict.tasks?.create_dialog?.register_jobs || "Register Work"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
