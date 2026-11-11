"use client";

import React from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import { TemplateTask, HouseTemplate } from "@/hooks/useTasksPage";
import { Reservation } from "@/types/reservation";
import type { Dictionary } from "@/lib/dictionary-context";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PremiumTabsNavigation } from "@/components/ui/premium-tabs";
import { buildTaskPlanningDate, getDefaultTaskDate } from "@/domain/tasks/task-create";
import { TaskCreateReview } from "./TaskCreateReview";
import { TaskCreateMainFields } from "./TaskCreateMainFields";
import { TaskCreateReservationSection } from "./TaskCreateReservationSection";
import { TaskCreateHouseChecklistSection } from "./TaskCreateHouseChecklistSection";
import { TaskCreateZonesSection } from "./TaskCreateZonesSection";
import { canLinkTaskReservations } from "@/features/reservations/reservation-helpers";
import type { TaskCreationPricingOverride } from "@/lib/task-pricing";
import type { LocationZone } from "@/services/location.service";
import {
    taskDialogBodyClass,
    taskDialogContentClass,
    taskDialogFooterClass,
    taskDialogHeaderClass,
    taskDialogOverlayClass,
} from "./taskDialogChrome";

const STEP_IDS = ["plan", "work", "review"];

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
    selectedHouseTemplateId: number | null;
    useHouseChecklist: boolean;
    setUseHouseChecklist: (use: boolean) => void;
    selectHouseTemplate: (id: number) => void;
    availableTemplates: TemplateTask[];
    handleLinkHouseTemplate: (templateTaskId: number, customPrice: number | null) => Promise<void>;
    newLocationId: string;
    setNewLocationId: (val: string) => void;
    newUserId: string;
    setNewUserId: (val: string) => void;
    newCreatedAt: string;
    setNewCreatedAt: (val: string) => void;
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
    selectedSpaceTaskTemplateIds: number[];
    setSelectedSpaceTaskTemplateIds: (taskIds: number[]) => void;
    handleCreateTask: (e: React.FormEvent) => void;
    fixedChecklistAssignments: Record<string, string>;
    setFixedChecklistAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    taskPricingOverrides: Record<number, TaskCreationPricingOverride>;
    setTaskPricingOverrides: React.Dispatch<React.SetStateAction<Record<number, TaskCreationPricingOverride>>>;
}

export function TaskCreateModal(props: TaskCreateModalProps) {
    return <TaskCreateWizard key={String(props.createOpen)} {...props} />;
}

function TaskCreateWizard({
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
    selectedHouseTemplateId,
    useHouseChecklist,
    setUseHouseChecklist,
    selectHouseTemplate,
    availableTemplates,
    handleLinkHouseTemplate,
    newLocationId,
    setNewLocationId,
    newUserId,
    setNewUserId,
    newCreatedAt,
    setNewCreatedAt,
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
    selectedSpaceTaskTemplateIds,
    setSelectedSpaceTaskTemplateIds,
    handleCreateTask,
    fixedChecklistAssignments,
    setFixedChecklistAssignments,
    taskPricingOverrides,
    setTaskPricingOverrides,
}: TaskCreateModalProps) {
    const [step, setStep] = React.useState("plan");
    const text = dict.tasks.create_dialog;
    const stepIndex = STEP_IDS.indexOf(step);
    const goToStep = (next: string) => {
        if (saving || !STEP_IDS.includes(next)) return;
        if (next !== "plan" && !planReady) return;
        if (next === "review" && !workReady) return;
        setStep(next);
    };
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        if (step !== "review") { goToStep(step === "plan" ? "work" : "review"); return; }
        if (planReady && workReady && !saving) handleCreateTask(event);
    };
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
        && canLinkTaskReservations(selectedLocation),
    );
    const visibleHouseTemplates = React.useMemo(
        () => houseTemplates.filter((houseTemplate) =>
            templates.some((template) => template.id === houseTemplate.template_task_id)
        ),
        [houseTemplates, templates]
    );
    const planReady = ownLocations.some(location => String(location.id) === newLocationId)
        && !loadingLocationZones && !loadingReservations
        && Boolean(buildTaskPlanningDate(newCreatedAt)) && newCreatedAt >= getDefaultTaskDate()
        && (!newCheckoutReservationId || newCheckoutReservationId !== newNextReservationId);
    const workReady = useHouseChecklist && !loadingHouseTemplates
        && visibleHouseTemplates.some(item => item.template_task_id === selectedHouseTemplateId);
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

                <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col font-sans">
                    <Tabs value={step} onValueChange={goToStep} className="flex min-h-0 flex-1 flex-col">
                        <div className="shrink-0 space-y-2 border-b border-[var(--border-soft)] px-5 py-3 sm:px-6">
                            <p aria-live="polite" className="text-xs font-semibold text-[var(--text-muted)]">{text.wizard_step.replace("{current}", String(stepIndex + 1)).replace("{total}", "3")}</p>
                            <div role="progressbar" aria-label={text.wizard_steps} aria-valuenow={stepIndex + 1} aria-valuemin={0} aria-valuemax={3} className="h-1 overflow-hidden rounded-full bg-[var(--bg-tertiary)]"><div className="h-full bg-accent transition-[width]" style={{ width: `${(stepIndex + 1) / 3 * 100}%` }} /></div>
                            <PremiumTabsNavigation tabs={[
                                { id: "plan", label: `1. ${text.wizard_plan}` },
                                { id: "work", label: `2. ${text.wizard_work}` },
                                { id: "review", label: `3. ${text.wizard_review}` },
                            ]} activeTab={step} onChange={goToStep} mobileLabel={text.wizard_steps} className="mb-0" />
                        </div>
                    <div className={taskDialogBodyClass}>
                        <TabsContent value="plan" className="m-0 space-y-4">
                        <TaskCreateMainFields
                            dict={dict}
                            ownLocations={ownLocations}
                            newLocationId={newLocationId}
                            setNewLocationId={setNewLocationId}
                            newCreatedAt={newCreatedAt}
                            setNewCreatedAt={setNewCreatedAt}
                        />

                        {newLocationId && (
                            <TaskCreateZonesSection
                                zones={locationZones}
                                loading={loadingLocationZones}
                                selectedZoneIds={selectedZoneIds}
                                setSelectedZoneIds={setSelectedZoneIds}
                                selectedSpaceTaskTemplateIds={selectedSpaceTaskTemplateIds}
                                setSelectedSpaceTaskTemplateIds={setSelectedSpaceTaskTemplateIds}
                            />
                        )}

                        {newLocationId && canLinkReservations && (
                            <TaskCreateReservationSection
                                dict={dict}
                                loadingReservations={loadingReservations}
                                availableReservations={availableReservations}
                                newCheckoutReservationId={newCheckoutReservationId}
                                setNewCheckoutReservationId={setNewCheckoutReservationId}
                                newNextReservationId={newNextReservationId}
                                setNewNextReservationId={setNewNextReservationId}
                            />
                        )}

                        {newCheckoutReservationId && newCheckoutReservationId === newNextReservationId && <p role="alert" className="text-sm text-[var(--priority-high-text)]">{text.wizard_distinct_reservations}</p>}
                        </TabsContent>
                        <TabsContent value="work" className="m-0 space-y-4">
                        {newLocationId && (
                            <TaskCreateHouseChecklistSection
                                dict={dict}
                                isAdminOrManager={adminOrManager}
                                users={users}
                                templates={templates}
                                houseTemplates={houseTemplates}
                                visibleHouseTemplates={visibleHouseTemplates}
                                loadingHouseTemplates={loadingHouseTemplates}
                                selectedHouseTemplateId={selectedHouseTemplateId}
                                useHouseChecklist={useHouseChecklist}
                                setUseHouseChecklist={setUseHouseChecklist}
                                selectHouseTemplate={selectHouseTemplate}
                                availableTemplates={availableTemplates}
                                handleLinkHouseTemplate={handleLinkHouseTemplate}
                                fixedChecklistAssignments={fixedChecklistAssignments}
                                setFixedChecklistAssignments={setFixedChecklistAssignments}
                                taskPricingOverrides={taskPricingOverrides}
                                setTaskPricingOverrides={setTaskPricingOverrides}
                                defaultAssigneeId={newUserId}
                                setDefaultAssigneeId={setNewUserId}
                            />
                        )}
                        {!workReady && <p role="status" className="text-sm text-[var(--text-muted)]">{text.wizard_select_service}</p>}
                        </TabsContent>
                        <TabsContent value="review" className="m-0">
                            <TaskCreateReview dict={dict} location={selectedLocation} date={newCreatedAt}
                                template={templates.find(item => item.id === selectedHouseTemplateId)}
                                houseTemplate={houseTemplates.find(item => item.template_task_id === selectedHouseTemplateId)}
                                pricingOverride={selectedHouseTemplateId === null ? undefined : taskPricingOverrides[selectedHouseTemplateId]}
                                users={users} assigneeId={newUserId} zones={locationZones} selectedZoneIds={selectedZoneIds}
                                checkoutReservation={availableReservations.find(item => String(item.id) === newCheckoutReservationId)}
                                nextReservation={availableReservations.find(item => String(item.id) === newNextReservationId)} />
                        </TabsContent>
                    </div>
                    </Tabs>

                    <div className={`${taskDialogFooterClass} flex-nowrap`}>
                        <div>{stepIndex > 0 && <Button type="button" variant="secondary" size="sm" className="px-2.5 sm:px-4" disabled={saving} onClick={() => goToStep(STEP_IDS[stepIndex - 1])}><ChevronLeft className="hidden size-4 sm:block" />{text.wizard_previous}</Button>}</div>
                        <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="cancel"
                            size="sm"
                            className="px-2.5 sm:px-4"
                            onClick={() => setCreateOpen(false)}
                        >
                            {dict.tasks?.create_dialog?.cancel || "Cancel"}
                        </Button>
                        <Button
                            key={step === "review" ? "save" : "next"}
                            type={step === "review" ? "submit" : "button"}
                            size="sm"
                            className="px-2.5 sm:px-4"
                            onClick={step === "review" ? undefined : () => goToStep(step === "plan" ? "work" : "review")}
                            disabled={saving || !planReady || (step !== "plan" && !workReady)}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {dict.tasks?.create_dialog?.creating || "Creating..."}
                                </>
                            ) : (
                                step === "review" ? <><Check className="hidden size-4 sm:block" />{text.register_jobs}</> : <>{text.wizard_next}<ChevronRight className="size-4" /></>
                            )}
                        </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
