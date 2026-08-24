"use client";

import { Location } from "@/services/location.service";
import { useLocationTasksSheet } from "@/hooks/useLocationTasksSheet";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { LocationHistoryTab } from "./LocationHistoryTab";
import { LocationSpacesTab } from "./LocationSpacesTab";
import { LocationTemplatesTab } from "./LocationTemplatesTab";

interface LocationTasksWorkspaceProps {
    location: Location | null;
    open: boolean;
    initialCreateForm?: boolean;
    initialTab?: "history" | "templates" | "spaces";
    readOnly?: boolean;
    showSpaces?: boolean;
    className?: string;
}

export function LocationTasksWorkspace({
    location,
    open,
    initialCreateForm,
    initialTab,
    readOnly,
    showSpaces = true,
    className = "",
}: LocationTasksWorkspaceProps) {
    const state = useLocationTasksSheet({ location, open, initialCreateForm, initialTab });

    return (
        <section className={`flex min-h-0 flex-1 flex-col ${className}`}>
            <div className="shrink-0">
                <PremiumTabs
                    tabs={[
                        ...(state.isAdminOrManager ? [
                            { id: "templates" as const, label: "Servicios habituales" },
                            ...(showSpaces ? [{ id: "spaces" as const, label: "Espacios" }] : []),
                        ] : []),
                        { id: "history" as const, label: "Registro" },
                    ]}
                    activeTab={state.activeTab}
                    onChange={state.setActiveTab}
                />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pt-5">
                {state.activeTab === "history" && location && <LocationHistoryTab locationId={location.id} dict={state.dict} tasks={state.tasks} users={state.users} isAdminOrManager={state.isAdminOrManager} submitting={state.submitting} showCreateForm={state.showCreateForm} setShowCreateForm={state.setShowCreateForm} title={state.title} setTitle={state.setTitle} description={state.description} setDescription={state.setDescription} assignedUserId={state.assignedUserId} setAssignedUserId={state.setAssignedUserId} price={state.price} setPrice={state.setPrice} quantity={state.quantity} setQuantity={state.setQuantity} unit={state.unit} setUnit={state.setUnit} handleCreateTask={state.handleCreateTask} handleToggleStatus={state.handleToggleStatus} getAssigneeName={state.getAssigneeName} loadingTasks={state.loadingTasks} readOnly={readOnly} />}
                {state.activeTab === "templates" && state.isAdminOrManager && <LocationTemplatesTab handleLinkTemplates={state.handleLinkTemplates} selectedGlobalTemplateIds={state.selectedGlobalTemplateIds} setSelectedGlobalTemplateIds={state.setSelectedGlobalTemplateIds} availableTemplates={state.availableTemplates} templatePrices={state.templatePrices} setTemplatePrices={state.setTemplatePrices} isLinking={state.isLinking} loadingHouseTemplates={state.loadingHouseTemplates} houseTemplates={state.houseTemplates} globalTemplates={state.globalTemplates} handleUnlinkTemplate={state.handleUnlinkTemplate} readOnly={!state.canManageLocationTemplates} editingTemplateId={state.editingTemplateId} setEditingTemplateId={state.setEditingTemplateId} editingTemplateValues={state.editingTemplateValues} setEditingTemplateValues={state.setEditingTemplateValues} handleUpdateTemplate={state.handleUpdateTemplate} />}
                {showSpaces && state.activeTab === "spaces" && location && state.isAdminOrManager && <LocationSpacesTab locationId={location.id} open={open} canManage={state.canManageLocationTemplates} />}
            </div>
        </section>
    );
}
