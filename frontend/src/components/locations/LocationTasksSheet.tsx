"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Location } from "@/services/location.service";
import { useLocationTasksSheet } from "@/hooks/useLocationTasksSheet";
import { LocationHistoryTab } from "./LocationHistoryTab";
import { LocationTemplatesTab } from "./LocationTemplatesTab";
import { LocationZonesTab } from "./LocationZonesTab";
import { PremiumTabs } from "@/components/ui/premium-tabs";

interface LocationTasksSheetProps {
    location: Location | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialCreateForm?: boolean;
    initialTab?: "history" | "templates" | "zones";
    readOnly?: boolean;
}

export function LocationTasksSheet({
    location,
    open,
    onOpenChange,
    initialCreateForm,
    initialTab,
    readOnly
}: LocationTasksSheetProps) {
    const state = useLocationTasksSheet({ location, open, initialCreateForm, initialTab });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl w-full max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--border-soft)] flex-shrink-0">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        {state.dict.locations?.sheet?.title || "Configuración de la ubicación"}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-[var(--text-muted)] font-semibold">
                        {location?.name} ({location?.city})
                    </DialogDescription>
                </DialogHeader>

                {/* Tab sub-navigation */}
                <div className="px-6 flex-shrink-0">
                    <PremiumTabs
                        tabs={[
                            ...(state.isAdminOrManager
                                ? [
                                    { id: "templates" as const, label: "Servicios" },
                                    { id: "zones" as const, label: "Zonas" },
                                ]
                                : []),
                            { id: "history" as const, label: "Registro" },
                        ]}
                        activeTab={state.activeTab}
                        onChange={state.setActiveTab}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {state.activeTab === "history" && location && (
                        <LocationHistoryTab
                            locationId={location.id}
                            dict={state.dict}
                            tasks={state.tasks}
                            users={state.users}
                            isAdminOrManager={state.isAdminOrManager}
                            submitting={state.submitting}
                            showCreateForm={state.showCreateForm}
                            setShowCreateForm={state.setShowCreateForm}
                            title={state.title}
                            setTitle={state.setTitle}
                            description={state.description}
                            setDescription={state.setDescription}
                            assignedUserId={state.assignedUserId}
                            setAssignedUserId={state.setAssignedUserId}
                            price={state.price}
                            setPrice={state.setPrice}
                            quantity={state.quantity}
                            setQuantity={state.setQuantity}
                            unit={state.unit}
                            setUnit={state.setUnit}
                            handleCreateTask={state.handleCreateTask}
                            handleToggleStatus={state.handleToggleStatus}
                            getAssigneeName={state.getAssigneeName}
                            loadingTasks={state.loadingTasks}
                            readOnly={readOnly}
                        />
                    )}

                    {state.activeTab === "templates" && state.isAdminOrManager && (
                        <LocationTemplatesTab
                            handleLinkTemplates={state.handleLinkTemplates}
                            selectedGlobalTemplateIds={state.selectedGlobalTemplateIds}
                            setSelectedGlobalTemplateIds={state.setSelectedGlobalTemplateIds}
                            availableTemplates={state.availableTemplates}
                            templatePrices={state.templatePrices}
                            setTemplatePrices={state.setTemplatePrices}
                            isLinking={state.isLinking}
                            loadingHouseTemplates={state.loadingHouseTemplates}
                            houseTemplates={state.houseTemplates}
                            globalTemplates={state.globalTemplates}
                            handleUnlinkTemplate={state.handleUnlinkTemplate}
                            readOnly={!state.canManageLocationTemplates}
                            editingTemplateId={state.editingTemplateId}
                            setEditingTemplateId={state.setEditingTemplateId}
                            editingTemplateValues={state.editingTemplateValues}
                            setEditingTemplateValues={state.setEditingTemplateValues}
                            handleUpdateTemplate={state.handleUpdateTemplate}
                        />
                    )}

                    {state.activeTab === "zones" && location && state.isAdminOrManager && (
                        <LocationZonesTab
                            locationId={location.id}
                            open={open}
                            canManage={state.canManageLocationTemplates}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
