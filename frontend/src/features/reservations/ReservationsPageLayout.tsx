"use client";

import { Calendar, Inbox } from "lucide-react";

import { PremiumTabs } from "@/components/ui/premium-tabs";
import { ReservationFormDialog } from "@/features/reservations/ReservationFormDialog";
import { ReservationsCancelDialog } from "@/features/reservations/ReservationsCancelDialog";
import { ReservationsListSection } from "@/features/reservations/ReservationsListSection";
import { ReservationsPageHeader } from "@/features/reservations/ReservationsPageHeader";
import { ReservationsRequestsSection } from "@/features/reservations/ReservationsRequestsSection";
import type {
    ReservationFiltersState,
    ReservationFormState,
    ReservationProviderOption,
    ReservationViewMode,
} from "@/features/reservations/types";
import type { Dictionary, Locale } from "@/lib/dictionary-context";
import type { TaskItem } from "@/services/task.service";
import type { Company } from "@/types/company";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";
import type { User } from "@/types/user";
import type { useTaskCrud } from "@/hooks/useTaskCrud";
import type { FormEvent } from "react";

type TaskCrudState = ReturnType<typeof useTaskCrud>;

type ReservationsPageLayoutProps = {
    dict: Dictionary;
    locale: Locale;
    activeTab: "reservations" | "requests";
    onTabChange: (tab: "reservations" | "requests") => void;
    requestCount: number;
    showCreateButton: boolean;
    onCreate: () => void;
    loading: boolean;
    reservationFilters: ReservationFiltersState;
    onFiltersChange: (filters: ReservationFiltersState) => void;
    onResetFilters: () => void;
    locations: Location[];
    providerOptions: ReservationProviderOption[];
    filteredReservations: Reservation[];
    viewMode: ReservationViewMode;
    onViewModeChange: (mode: ReservationViewMode) => void;
    locationMap: Map<number, Location>;
    companyId?: number;
    onEdit: (reservation: Reservation) => void;
    onCancel: (reservation: Reservation) => void;
    loadingTasks: boolean;
    displayRequestedTasks: TaskItem[];
    user: User | null;
    users: User[];
    canManage: boolean;
    taskCrud: TaskCrudState;
    getLocationName: (locationId: number) => string;
    getAssigneeName: (userId: number | null) => string;
    onAcceptTask: (taskId: number, scheduledStartAt?: string) => Promise<void>;
    onRejectTask: (taskId: number) => Promise<void>;
    onOpenTaskDetail: (task: TaskItem) => void;
    formOpen: boolean;
    onFormOpenChange: (open: boolean) => void;
    editing: Reservation | null;
    form: ReservationFormState;
    onFormChange: (form: ReservationFormState) => void;
    reservableLocations: Location[];
    serviceProviders: Company[];
    saving: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
    isCancelConfirmOpen: boolean;
    onCancelDialogOpenChange: (open: boolean) => void;
    onConfirmCancelReservation: () => Promise<void>;
};

export function ReservationsPageLayout({
    dict,
    locale,
    activeTab,
    onTabChange,
    requestCount,
    showCreateButton,
    onCreate,
    loading,
    reservationFilters,
    onFiltersChange,
    onResetFilters,
    locations,
    providerOptions,
    filteredReservations,
    viewMode,
    onViewModeChange,
    locationMap,
    companyId,
    onEdit,
    onCancel,
    loadingTasks,
    displayRequestedTasks,
    user,
    users,
    canManage,
    taskCrud,
    getLocationName,
    getAssigneeName,
    onAcceptTask,
    onRejectTask,
    onOpenTaskDetail,
    formOpen,
    onFormOpenChange,
    editing,
    form,
    onFormChange,
    reservableLocations,
    serviceProviders,
    saving,
    onSubmit,
    isCancelConfirmOpen,
    onCancelDialogOpenChange,
    onConfirmCancelReservation,
}: ReservationsPageLayoutProps) {
    return (
        <div className="max-w-7xl mx-auto px-[3%] md:px-8 py-6 space-y-6">
            <ReservationsPageHeader
                dict={dict}
                showCreateButton={showCreateButton}
                onCreate={onCreate}
            />

            <PremiumTabs
                layout="fit"
                tabs={[
                    {
                        id: "reservations" as const,
                        label: dict.reservations?.tabs?.own_reservations || "Reservas propias",
                        icon: Calendar,
                    },
                    {
                        id: "requests" as const,
                        label: dict.reservations?.tabs?.requests || "Solicitudes",
                        icon: Inbox,
                        badge: requestCount,
                        attention: requestCount > 0,
                    },
                ]}
                activeTab={activeTab}
                onChange={onTabChange}
                className="mb-6"
            />

            {activeTab === "reservations" ? (
                <ReservationsListSection
                    dict={dict}
                    locale={locale}
                    loading={loading}
                    filters={reservationFilters}
                    onFiltersChange={onFiltersChange}
                    onResetFilters={onResetFilters}
                    locations={locations}
                    providers={providerOptions}
                    resultCount={filteredReservations.length}
                    viewMode={viewMode}
                    onViewModeChange={onViewModeChange}
                    reservations={filteredReservations}
                    locationMap={locationMap}
                    companyId={companyId}
                    onEdit={onEdit}
                    onCancel={onCancel}
                />
            ) : null}

            <ReservationsRequestsSection
                showRequestsList={activeTab === "requests"}
                loadingTasks={loadingTasks}
                requests={displayRequestedTasks}
                locations={locations}
                dict={dict}
                user={user}
                users={users}
                canManage={canManage}
                taskCrud={taskCrud}
                getLocationName={getLocationName}
                getAssigneeName={getAssigneeName}
                onAccept={onAcceptTask}
                onReject={onRejectTask}
                onOpenTaskDetail={onOpenTaskDetail}
            />

            <ReservationFormDialog
                open={formOpen}
                onOpenChange={onFormOpenChange}
                editing={editing}
                form={form}
                onFormChange={onFormChange}
                locations={reservableLocations}
                serviceProviders={serviceProviders}
                saving={saving}
                dict={dict}
                onSubmit={onSubmit}
            />

            <ReservationsCancelDialog
                open={isCancelConfirmOpen}
                onOpenChange={onCancelDialogOpenChange}
                dict={dict}
                onConfirm={onConfirmCancelReservation}
            />
        </div>
    );
}

export function ReservationsAccessDenied() {
    return (
        <div className="max-w-3xl mx-auto p-8 text-center text-sm text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            Las reservas se gestionan desde cuentas administradoras o gestoras.
        </div>
    );
}
