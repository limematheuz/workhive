"use client";

import React from "react";
import { TaskItem } from "@/services/task.service";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import { TemplateTask, HouseTemplate } from "@/hooks/useTasksPage";
import { Reservation } from "@/types/reservation";
import { TaskCreateModal } from "./TaskCreateModal";
import { TaskEditModal } from "./TaskEditModal";
import { TemplateModal } from "./TemplateModal";
import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskPriority, TaskStatus } from "@/types/task";
import type { TaskPricingMode } from "@/domain/tasks/task-edit";
import type { TaskAcceptanceInput } from "@/domain/tasks/task-acceptance";
import type { TaskCreationPricingOverride } from "@/lib/task-pricing";
import type { LocationZone } from "@/services/location.service";

interface TaskFormModalsProps {
    dict: Dictionary;
    currentUser: User | null;
    locations: Location[];
    users: User[];
    templates: TemplateTask[];
    adminOrManager: boolean;
    saving: boolean;
    deletingTask: boolean;

    // Create Task Modal
    createOpen: boolean;
    setCreateOpen: (open: boolean) => void;
    houseTemplates: HouseTemplate[];
    loadingHouseTemplates: boolean;
    selectedHouseTemplateId: number | null;
    useHouseChecklist: boolean;
    setUseHouseChecklist: (use: boolean) => void;
    selectHouseTemplate: (id: number) => void;
    availableTemplates: TemplateTask[];
    handleLinkHouseTemplate: (templateTaskId: number, customPrice: number | null) => Promise<void>;
    newLocationId: string;
    setNewLocationId: (val: string) => void;
    newCreatedAt: string;
    setNewCreatedAt: (val: string) => void;
    newUserId: string;
    setNewUserId: (val: string) => void;
    availableReservations: Reservation[];
    loadingReservations: boolean;
    newCheckoutReservationId: string;
    setNewCheckoutReservationId: (val: string) => void;
    newNextReservationId: string;
    setNewNextReservationId: (val: string) => void;
    locationZones: LocationZone[];
    loadingLocationZones: boolean;
    selectedZoneIds: number[];
    setSelectedZoneIds: (zoneIds: number[]) => void;
    handleCreateTask: (e: React.FormEvent) => void;
    fixedChecklistAssignments: Record<string, string>;
    setFixedChecklistAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    taskPricingOverrides: Record<number, TaskCreationPricingOverride>;
    setTaskPricingOverrides: React.Dispatch<React.SetStateAction<Record<number, TaskCreationPricingOverride>>>;

    // Edit Task Modal
    selectedTask: TaskItem | null;
    setSelectedTask: (task: TaskItem | null) => void;
    editNotes: string;
    setEditNotes: (val: string) => void;
    editDescription: string;
    setEditDescription: (val: string) => void;
    editPrice: string;
    setEditPrice: (val: string) => void;
    editPricingMode: TaskPricingMode;
    setEditPricingMode: (val: TaskPricingMode) => void;
    editQuantity: string;
    setEditQuantity: (val: string) => void;
    editUnit: string;
    setEditUnit: (val: string) => void;
    editLocationId: string;
    setEditLocationId: (val: string) => void;
    editUserId: string;
    editStatus: TaskStatus;
    setEditStatus: (val: TaskStatus) => void;
    editTitle: string;
    setEditTitle: (val: string) => void;
    editPriority: TaskPriority;
    setEditPriority: (val: TaskPriority) => void;
    editCreatedAt: string;
    setEditCreatedAt: (val: string) => void;
    editPlanningTime: string;
    setEditPlanningTime: (val: string) => void;
    handleSaveTaskDetails: (e: React.FormEvent) => void;
    handleDeleteTask: (task: TaskItem) => void;
    handleDuplicateTask: (task: TaskItem) => Promise<void>;
    getAssigneeName: (userId: number | null) => string;
    onAccept?: (taskId: number, input: TaskAcceptanceInput) => Promise<void> | void;
    onReject?: (taskId: number) => Promise<void> | void;
 
     // Templates Modal
     templateModalOpen: boolean;
     setTemplateModalOpen: (open: boolean) => void;
     selectedTemplate: TemplateTask | null;
     tmplName: string;
     setTmplName: (val: string) => void;
     tmplDescription: string;
     setTmplDescription: (val: string) => void;
     tmplPrice: string;
     setTmplPrice: (val: string) => void;
     tmplUnit: string;
     setTmplUnit: (val: string) => void;
     tmplPricingMode: "fixed" | "hourly";
     setTmplPricingMode: (val: "fixed" | "hourly") => void;
     handleSaveTemplate: (e: React.FormEvent) => void;
 }
 
 export function TaskFormModals({
     dict,
     currentUser,
     locations,
     users,
     templates,
     adminOrManager,
     saving,
     deletingTask,
 
     createOpen,
     setCreateOpen,
     houseTemplates,
     loadingHouseTemplates,
     selectedHouseTemplateId,
     useHouseChecklist,
     setUseHouseChecklist,
     selectHouseTemplate,
     availableTemplates,
     handleLinkHouseTemplate,
     newLocationId,
     setNewLocationId,
     newCreatedAt,
     setNewCreatedAt,
     newUserId,
     setNewUserId,
     availableReservations,
     loadingReservations,
     newCheckoutReservationId,
     setNewCheckoutReservationId,
     newNextReservationId,
     setNewNextReservationId,
    locationZones,
    loadingLocationZones,
    selectedZoneIds,
    setSelectedZoneIds,
     handleCreateTask,
    fixedChecklistAssignments,
    setFixedChecklistAssignments,
    taskPricingOverrides,
    setTaskPricingOverrides,
 
     selectedTask,
     setSelectedTask,
     editNotes,
     setEditNotes,
     editDescription,
     setEditDescription,
     editPrice,
     setEditPrice,
     editPricingMode,
     setEditPricingMode,
     editQuantity,
     setEditQuantity,
     editUnit,
     setEditUnit,
     editLocationId,
     setEditLocationId,
     editUserId,
    editStatus,
    setEditStatus,
    editTitle,
    setEditTitle,
     editPriority,
     setEditPriority,
     editCreatedAt,
     setEditCreatedAt,
     editPlanningTime,
     setEditPlanningTime,
     handleSaveTaskDetails,
     handleDeleteTask,
     handleDuplicateTask,
     getAssigneeName,
     onAccept,
     onReject,
 
     templateModalOpen,
     setTemplateModalOpen,
     selectedTemplate,
     tmplName,
     setTmplName,
     tmplDescription,
     setTmplDescription,
     tmplPrice,
     setTmplPrice,
     tmplUnit,
     setTmplUnit,
     tmplPricingMode,
     setTmplPricingMode,
     handleSaveTemplate,
 }: TaskFormModalsProps) {
     return (
         <>
             <TaskCreateModal
                 dict={dict}
                 adminOrManager={adminOrManager}
                 currentUser={currentUser}
                 locations={locations}
                 users={users}
                 templates={templates}
                 saving={saving}
                 createOpen={createOpen}
                 setCreateOpen={setCreateOpen}
                 houseTemplates={houseTemplates}
                 loadingHouseTemplates={loadingHouseTemplates}
                 selectedHouseTemplateId={selectedHouseTemplateId}
                 useHouseChecklist={useHouseChecklist}
                 setUseHouseChecklist={setUseHouseChecklist}
                 selectHouseTemplate={selectHouseTemplate}
                 availableTemplates={availableTemplates}
                 handleLinkHouseTemplate={handleLinkHouseTemplate}
                 newLocationId={newLocationId}
                 setNewLocationId={setNewLocationId}
                 newCreatedAt={newCreatedAt}
                 setNewCreatedAt={setNewCreatedAt}
                 newUserId={newUserId}
                 setNewUserId={setNewUserId}
                 availableReservations={availableReservations}
                 loadingReservations={loadingReservations}
                 newCheckoutReservationId={newCheckoutReservationId}
                 setNewCheckoutReservationId={setNewCheckoutReservationId}
                 newNextReservationId={newNextReservationId}
                 setNewNextReservationId={setNewNextReservationId}
                locationZones={locationZones}
                loadingLocationZones={loadingLocationZones}
                selectedZoneIds={selectedZoneIds}
                setSelectedZoneIds={setSelectedZoneIds}
                 handleCreateTask={handleCreateTask}
                 fixedChecklistAssignments={fixedChecklistAssignments}
                 setFixedChecklistAssignments={setFixedChecklistAssignments}
                 taskPricingOverrides={taskPricingOverrides}
                 setTaskPricingOverrides={setTaskPricingOverrides}
             />
 
             <TaskEditModal
                 dict={dict}
                 currentUser={currentUser}
                 locations={locations}
                 users={users}
                 adminOrManager={adminOrManager}
                 saving={saving}
                 deletingTask={deletingTask}
                 selectedTask={selectedTask}
                 setSelectedTask={setSelectedTask}
                 editNotes={editNotes}
                 setEditNotes={setEditNotes}
                 editDescription={editDescription}
                 setEditDescription={setEditDescription}
                 editPrice={editPrice}
                 setEditPrice={setEditPrice}
                 editPricingMode={editPricingMode}
                 setEditPricingMode={setEditPricingMode}
                 editQuantity={editQuantity}
                 setEditQuantity={setEditQuantity}
                 editUnit={editUnit}
                 setEditUnit={setEditUnit}
                 editLocationId={editLocationId}
                 setEditLocationId={setEditLocationId}
                 editUserId={editUserId}
                 editStatus={editStatus}
                 setEditStatus={setEditStatus}
                 editTitle={editTitle}
                 setEditTitle={setEditTitle}
                 editPriority={editPriority}
                 setEditPriority={setEditPriority}
                 editCreatedAt={editCreatedAt}
                 setEditCreatedAt={setEditCreatedAt}
                 editPlanningTime={editPlanningTime}
                 setEditPlanningTime={setEditPlanningTime}
                 handleSaveTaskDetails={handleSaveTaskDetails}
                 handleDeleteTask={handleDeleteTask}
                 handleDuplicateTask={handleDuplicateTask}
                 getAssigneeName={getAssigneeName}
                 onAccept={onAccept}
                 onReject={onReject}
             />

            <TemplateModal
                dict={dict}
                isSaving={saving}
                isTemplateModalOpen={templateModalOpen}
                setIsTemplateModalOpen={setTemplateModalOpen}
                selectedTemplate={selectedTemplate}
                tmplName={tmplName}
                setTmplName={setTmplName}
                tmplDescription={tmplDescription}
                setTmplDescription={setTmplDescription}
                tmplPrice={tmplPrice}
                setTmplPrice={setTmplPrice}
                tmplUnit={tmplUnit}
                setTmplUnit={setTmplUnit}
                tmplPricingMode={tmplPricingMode}
                setTmplPricingMode={setTmplPricingMode}
                handleSaveTemplate={handleSaveTemplate}
            />
        </>
    );
}
