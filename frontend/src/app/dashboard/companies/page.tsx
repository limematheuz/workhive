"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { Building2, Plus, Power, RotateCcw, Trash2, Pencil } from "lucide-react";

import { CompaniesListSection } from "@/components/companies/CompaniesListSection";
import type { CompanyMember } from "@/components/companies/company-members";
import { CompanyEditDialog, type CompanyEditFormData } from "@/components/companies/CompanyEditDialog";
import {
    CompanyProvisionDialog,
    type CompanyProvisionData,
} from "@/components/companies/CompanyProvisionDialog";
import { TrialRequestsPanel } from "@/components/companies/TrialRequestsPanel";
import { formatDateForInput, isCompanyAccessEnabled } from "@/components/companies/company-utils";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import type { PopoverOption } from "@/components/ui/action-popover";
import { useDictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { isPlatformSuperadmin } from "@/domain/access/roles";
import { CompanyService, type Company } from "@/services/company.service";

const EMPTY_FORM: CompanyEditFormData = {
    name: "",
    tax_id: "",
    address: "",
    phone: "",
    email: "",
    bank_account: "",
    subscription_plan: "trial",
    subscription_status: "trialing",
    trial_ends_at: "",
};

const EMPTY_PROVISION: CompanyProvisionData = {
    name: "",
    tax_id: "",
    address: "",
    phone: "",
    email: "",
    owner_full_name: "",
    owner_email: "",
    owner_access_code: "",
    subscription_plan: "trial",
    trial_days: "14",
};

function useCompaniesAdminController() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const selectedCompanyRef = useRef<Company | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isProvisionOpen, setIsProvisionOpen] = useState(false);
    const [statusTarget, setStatusTarget] = useState<Company | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [expandedCompanyId, setExpandedCompanyId] = useState<number | null>(null);
    const [loadingCompanyId, setLoadingCompanyId] = useState<number | null>(null);
    const [membersByCompany, setMembersByCompany] = useState<Record<number, CompanyMember[]>>({});
    const [formData, setFormData] = useState<CompanyEditFormData>(EMPTY_FORM);
    const [provisionData, setProvisionData] = useState<CompanyProvisionData>(EMPTY_PROVISION);

    const fetchCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const data = await CompanyService.getCompanies();
            setCompanies(data);
        } catch (error) {
            console.error(error);
            toast.error(dict.companies.toast_error_load);
        } finally {
            setLoading(false);
        }
    }, [dict.companies.toast_error_load]);

    useEffect(() => {
        if (userLoading || !isPlatformSuperadmin(user)) return;
        const timer = window.setTimeout(() => {
            void fetchCompanies();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [fetchCompanies, user, userLoading]);

    if (!userLoading && !isPlatformSuperadmin(user)) {
        redirect("/dashboard");
    }

    const handleEditClick = (company: Company) => {
        selectedCompanyRef.current = company;
        setFormData({
            name: company.name || "",
            tax_id: company.tax_id || company.cif || "",
            address: company.address || "",
            phone: company.phone || "",
            email: company.email || "",
            bank_account: company.bank_account || company.iban || "",
            subscription_plan: company.subscription_plan || "none",
            subscription_status: company.subscription_status || "inactive",
            trial_ends_at: formatDateForInput(company.trial_ends_at),
        });
        setIsEditOpen(true);
    };

    const handleProvisionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const created = await CompanyService.provisionCompany({
                ...provisionData,
                subscription_plan: provisionData.subscription_plan as "trial" | "pro",
                trial_days: provisionData.subscription_plan === "trial"
                    ? Number(provisionData.trial_days || 14)
                    : null,
            });
            setCompanies((prev) => [...prev, created]);
            setIsProvisionOpen(false);
            setProvisionData(EMPTY_PROVISION);
            toast.success("Empresa y propietario activados correctamente");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo activar la empresa");
        } finally {
            setSubmitting(false);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedCompany = selectedCompanyRef.current;
        if (!selectedCompany) return;

        try {
            setSubmitting(true);
            const updated = await CompanyService.updateCompany(selectedCompany.id, {
                ...formData,
                subscription_plan: formData.subscription_plan as Company["subscription_plan"],
                subscription_status: formData.subscription_status as Company["subscription_status"],
                trial_ends_at: formData.subscription_plan === "trial" && formData.trial_ends_at
                    ? new Date(`${formData.trial_ends_at}T23:59:59`).toISOString()
                    : null,
            });
            toast.success(dict.companies.toast_success_update);
            setCompanies((prev) =>
                prev.map((c) => (c.id === selectedCompany.id ? updated : c))
            );
            setIsEditOpen(false);
            selectedCompanyRef.current = null;
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : dict.companies.toast_error_update);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteCompany = async () => {
        if (!deleteTarget) return;
        try {
            setSubmitting(true);
            await CompanyService.deleteCompany(deleteTarget.id);
            setCompanies((prev) => prev.filter((company) => company.id !== deleteTarget.id));
            toast.success("Empresa eliminada definitivamente");
            setDeleteTarget(null);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo eliminar la empresa");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async () => {
        if (!statusTarget) return;
        const hasAccess = isCompanyAccessEnabled(statusTarget);
        try {
            setSubmitting(true);
            const updated = await CompanyService.updateCompany(statusTarget.id, {
                is_active: !hasAccess,
                subscription_plan: hasAccess ? "none" : "pro",
                subscription_status: hasAccess ? "inactive" : "active",
                trial_ends_at: null,
            });
            setCompanies((prev) =>
                prev.map((company) => (company.id === updated.id ? updated : company))
            );
            toast.success(
                isCompanyAccessEnabled(updated)
                    ? "Empresa reactivada. Sus usuarios pueden volver a acceder."
                    : "Empresa desactivada. Se conserva todo su histórico."
            );
            setStatusTarget(null);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado de la empresa");
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleMembers = async (company: Company) => {
        if (expandedCompanyId === company.id) {
            setExpandedCompanyId(null);
            return;
        }
        setExpandedCompanyId(company.id);
        if (membersByCompany[company.id]) return;
        try {
            setLoadingCompanyId(company.id);
            const members = await CompanyService.getCompanyMembers(company.id);
            setMembersByCompany((current) => ({ ...current, [company.id]: members }));
        } catch (error) {
            setExpandedCompanyId(null);
            toast.error(dict.companies.members_error);
            console.error(error);
        } finally {
            setLoadingCompanyId(null);
        }
    };

    const getCompanyActions = (company: Company): PopoverOption[] => {
        const hasAccess = isCompanyAccessEnabled(company);
        return [
            {
                label: dict.companies.edit,
                icon: Pencil,
                variant: "edit",
                onClick: () => handleEditClick(company),
            },
            {
                label: hasAccess ? dict.companies.deactivate : dict.companies.reactivate,
                icon: hasAccess ? Power : RotateCcw,
                variant: hasAccess ? "deactivate" : "edit",
                onClick: () => setStatusTarget(company),
            },
            {
                label: dict.companies.delete,
                icon: Trash2,
                variant: "delete",
                onClick: () => setDeleteTarget(company),
            },
        ];
    };

    return {
        companies,
        deleteTarget,
        dict,
        expandedCompanyId,
        formData,
        getCompanyActions,
        handleDeleteCompany,
        handleFormSubmit,
        handleProvisionSubmit,
        handleStatusChange,
        handleToggleMembers,
        isEditOpen,
        isProvisionOpen,
        loading,
        loadingCompanyId,
        membersByCompany,
        provisionData,
        selectedCompanyRef,
        setDeleteTarget,
        setFormData,
        setIsEditOpen,
        setIsProvisionOpen,
        setProvisionData,
        setStatusTarget,
        statusTarget,
        submitting,
        user,
        userLoading,
    };
}

export default function CompaniesAdminPage() {
    const controller = useCompaniesAdminController();

    if (controller.userLoading || controller.loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (!isPlatformSuperadmin(controller.user)) {
        return null;
    }

    return <CompaniesAdminPageContent controller={controller} />;
}

function CompaniesAdminPageContent({
    controller,
}: {
    controller: ReturnType<typeof useCompaniesAdminController>;
}) {
    const {
        companies,
        deleteTarget,
        dict,
        expandedCompanyId,
        formData,
        getCompanyActions,
        handleDeleteCompany,
        handleFormSubmit,
        handleProvisionSubmit,
        handleStatusChange,
        handleToggleMembers,
        isEditOpen,
        isProvisionOpen,
        loadingCompanyId,
        membersByCompany,
        provisionData,
        selectedCompanyRef,
        setDeleteTarget,
        setFormData,
        setIsEditOpen,
        setIsProvisionOpen,
        setProvisionData,
        setStatusTarget,
        statusTarget,
        submitting,
    } = controller;

    return (
        <div className="max-w-7xl mx-auto space-y-8 text-[var(--text-main)] px-[3%] py-6 md:p-8">
            <PageHeader
                icon={Building2}
                title={dict.companies.title}
                subtitle={dict.companies.subtitle}
                titleAs="h2"
                actions={(
                    <Button
                        onClick={() => setIsProvisionOpen(true)}
                        className="h-11 gap-2 rounded-xl bg-[var(--btn-primary-bg)] px-5 text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]"
                    >
                        <Plus className="h-4 w-4" />
                        Nueva empresa
                    </Button>
                )}
            />

            <TrialRequestsPanel />

            <CompaniesListSection
                companies={companies}
                emptyLabel={dict.companies.empty}
                labels={{
                    name: dict.companies.name,
                    cif: dict.companies.cif,
                    email: dict.companies.email,
                    phone: dict.companies.phone,
                    status: dict.companies.status,
                    actions: dict.companies.actions,
                    active: dict.companies.active,
                    inactive: dict.companies.inactive,
                    viewTeam: dict.companies.view_team,
                    admins: dict.companies.admins,
                    workers: dict.companies.workers,
                    noAdmins: dict.companies.no_admins,
                    noWorkers: dict.companies.no_workers,
                    memberInactive: dict.companies.member_inactive,
                }}
                getCompanyActions={getCompanyActions}
                expandedCompanyId={expandedCompanyId}
                loadingCompanyId={loadingCompanyId}
                membersByCompany={membersByCompany}
                onToggleMembers={(company) => void handleToggleMembers(company)}
            />

            <CompanyProvisionDialog
                open={isProvisionOpen}
                onOpenChange={setIsProvisionOpen}
                provisionData={provisionData}
                setProvisionData={setProvisionData}
                submitting={submitting}
                onSubmit={handleProvisionSubmit}
            />

            <DeleteConfirmDialog
                open={statusTarget !== null}
                onOpenChange={(open) => !open && setStatusTarget(null)}
                title={statusTarget && isCompanyAccessEnabled(statusTarget) ? "¿Desactivar empresa?" : "¿Reactivar empresa?"}
                description={statusTarget && isCompanyAccessEnabled(statusTarget)
                    ? `Los usuarios de ${statusTarget.name} dejarán de poder acceder. No se eliminarán tareas, facturas, clientes ni histórico.`
                    : `Los usuarios de ${statusTarget?.name || "esta empresa"} podrán volver a iniciar sesión y utilizar sus datos existentes.`}
                onConfirm={handleStatusChange}
                isDeleting={submitting}
                confirmText={statusTarget && isCompanyAccessEnabled(statusTarget) ? "Desactivar empresa" : "Reactivar empresa"}
                cancelText="Cancelar"
                confirmIcon={statusTarget && isCompanyAccessEnabled(statusTarget) ? Power : RotateCcw}
                confirmVariant={statusTarget && isCompanyAccessEnabled(statusTarget) ? "soft-danger" : "primary"}
            />

            <DeleteConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="¿Eliminar empresa para siempre?"
                description={`Esta acción es irreversible. Se borrará ${deleteTarget?.name || "esta empresa"} solo si no tiene tareas, reservas, facturas, presupuestos o registros fiscales.`}
                onConfirm={handleDeleteCompany}
                isDeleting={submitting}
                confirmText="Eliminar definitivamente"
                cancelText="Cancelar"
                confirmIcon={Trash2}
                confirmVariant="danger"
            />

            <CompanyEditDialog
                open={isEditOpen}
                onOpenChange={(open) => {
                    setIsEditOpen(open);
                    if (!open) selectedCompanyRef.current = null;
                }}
                formData={formData}
                setFormData={setFormData}
                submitting={submitting}
                onSubmit={handleFormSubmit}
                labels={{
                    editTitle: dict.companies.edit_title,
                    name: dict.companies.name_label,
                    cif: dict.companies.cif,
                    phone: dict.companies.phone,
                    email: dict.companies.email_label,
                    address: dict.companies.address_label,
                    iban: dict.companies.iban_label,
                    cancel: dict.companies.cancel,
                    saving: dict.companies.saving,
                    save: dict.companies.save,
                }}
            />
        </div>
    );
}
