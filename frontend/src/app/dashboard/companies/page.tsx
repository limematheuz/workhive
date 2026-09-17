"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { Building2, Plus, Power, RotateCcw, Trash2, Pencil, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { CompaniesListSection } from "@/components/companies/CompaniesListSection";
import type { CompanyMember } from "@/components/companies/company-members";
import { CompanyEditDialog, type CompanyEditFormData } from "@/components/companies/CompanyEditDialog";
import { CompanyPlanAccessDialog } from "@/components/companies/CompanyPlanAccessDialog";
import { PlanCatalogEditorDialog } from "@/components/companies/PlanCatalogEditorDialog";
import {
    CompanyProvisionDialog,
    type CompanyProvisionData,
} from "@/components/companies/CompanyProvisionDialog";
import { TrialRequestsPanel } from "@/components/companies/TrialRequestsPanel";
import { isCompanyAccessEnabled } from "@/components/companies/company-utils";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { commercialTermsPayload, emptyCommercialTerms } from "@/lib/commercial-terms";
import type { PopoverOption } from "@/components/ui/action-popover";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { isPlatformSuperadmin } from "@/domain/access/roles";
import type { CompanyPlanAccess } from "@/services/company-plan-access.service";
import { CompanyService, type Company } from "@/services/company.service";

const EMPTY_FORM: CompanyEditFormData = {
    name: "",
    tax_id: "",
    address: "",
    phone: "",
    email: "",
    bank_account: "",
    swift_bic: "",
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
    commercial_terms: emptyCommercialTerms(),
};

function useCompaniesAdminController() {
    const { user, loading: userLoading } = useUser();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [companyTotal, setCompanyTotal] = useState(0);
    const [companyPage, setCompanyPage] = useState(1);
    const [companyPageSize, setCompanyPageSize] = useState(10);
    const [loading, setLoading] = useState(true);
    const selectedCompanyRef = useRef<Company | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isProvisionOpen, setIsProvisionOpen] = useState(false);
    const [isPlanCatalogOpen, setIsPlanCatalogOpen] = useState(false);
    const [planAccessTarget, setPlanAccessTarget] = useState<Company | null>(null);
    const [statusTarget, setStatusTarget] = useState<Company | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [expandedCompanyId, setExpandedCompanyId] = useState<number | null>(null);
    const [loadingCompanyId, setLoadingCompanyId] = useState<number | null>(null);
    const [membersByCompany, setMembersByCompany] = useState<Record<number, CompanyMember[]>>({});
    const [formData, setFormData] = useState<CompanyEditFormData>(EMPTY_FORM);
    const [provisionData, setProvisionData] = useState<CompanyProvisionData>(EMPTY_PROVISION);

    const fetchCompanies = useCallback(async (page = companyPage, pageSize = companyPageSize) => {
        try {
            setLoading(true);
            const data = await CompanyService.getCompaniesPage((page - 1) * pageSize, pageSize);
            setCompanies(data.items);
            setCompanyTotal(data.total);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se han podido cargar las empresas");
        } finally {
            setLoading(false);
        }
    }, [companyPage, companyPageSize]);

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
            swift_bic: company.swift_bic || "",
        });
        setIsEditOpen(true);
    };

    const handleProvisionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const commercialTerms = provisionData.subscription_plan === "trial"
            ? undefined
            : commercialTermsPayload(provisionData.commercial_terms);
        if (provisionData.subscription_plan !== "trial" && !commercialTerms) {
            toast.error("Completa el importe, la moneda y la fecha efectiva del acuerdo");
            return;
        }
        try {
            setSubmitting(true);
            await CompanyService.provisionCompany({
                ...provisionData,
                subscription_plan: provisionData.subscription_plan,
                trial_days: provisionData.subscription_plan === "trial"
                    ? Number(provisionData.trial_days || 14)
                    : null,
                commercial_terms: commercialTerms ?? undefined,
            });
            setCompanyPage(1);
            await fetchCompanies(1, companyPageSize);
            setIsProvisionOpen(false);
            setProvisionData(EMPTY_PROVISION);
            toast.success("Empresa y administrador activados");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se ha podido activar la empresa");
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
            });
            toast.success("Datos de empresa guardados");
            setCompanies((prev) =>
                prev.map((c) => (c.id === selectedCompany.id ? updated : c))
            );
            setIsEditOpen(false);
            selectedCompanyRef.current = null;
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "No se han podido guardar los datos de empresa");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteCompany = async () => {
        if (!deleteTarget) return;
        try {
            setSubmitting(true);
            await CompanyService.deleteCompany(deleteTarget.id);
            const remaining = Math.max(companyTotal - 1, 0);
            const nextPage = Math.min(companyPage, Math.max(1, Math.ceil(remaining / companyPageSize)));
            setCompanyPage(nextPage);
            await fetchCompanies(nextPage, companyPageSize);
            toast.success("Empresa eliminada permanentemente");
            setDeleteTarget(null);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se ha podido eliminar la empresa");
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
            });
            setCompanies((prev) =>
                prev.map((company) => (company.id === updated.id ? updated : company))
            );
            toast.success(
                isCompanyAccessEnabled(updated)
                    ? "Empresa reactivada. Sus personas ya pueden acceder de nuevo."
                    : "Empresa desactivada. Su historial se ha conservado."
            );
            setStatusTarget(null);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se ha podido cambiar el estado de la empresa");
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
            toast.error(error instanceof Error ? error.message : "No se han podido cargar las personas de la empresa");
        } finally {
            setLoadingCompanyId(null);
        }
    };

    const handlePlanAccessUpdated = (access: CompanyPlanAccess) => {
        const applyAccess = (company: Company): Company => company.id === access.company_id
            ? {
                ...company,
                subscription_plan: access.subscription.plan_code,
                subscription_status: access.subscription.status,
                trial_ends_at: access.subscription.trial_ends_at,
            }
            : company;
        setCompanies((current) => current.map(applyAccess));
        setPlanAccessTarget((current) => current ? applyAccess(current) : null);
    };

    const handlePageChange = (nextPage: number) => {
        setCompanyPage(nextPage);
    };

    const handlePageSizeChange = (nextPageSize: number) => {
        setCompanyPage(1);
        setCompanyPageSize(nextPageSize);
    };

    const getCompanyActions = (company: Company): PopoverOption[] => {
        const hasAccess = isCompanyAccessEnabled(company);
        return [
            {
                label: "Plan",
                icon: ShieldCheck,
                variant: "edit",
                onClick: () => setPlanAccessTarget(company),
            },
            {
                label: "Editar",
                icon: Pencil,
                variant: "edit",
                onClick: () => handleEditClick(company),
            },
            {
                label: hasAccess ? "Desactivar" : "Reactivar",
                icon: hasAccess ? Power : RotateCcw,
                variant: hasAccess ? "deactivate" : "edit",
                onClick: () => setStatusTarget(company),
            },
            {
                label: "Eliminar",
                icon: Trash2,
                variant: "delete",
                onClick: () => setDeleteTarget(company),
            },
        ];
    };

    return {
        companies,
        companyPage,
        companyPageSize,
        companyTotal,
        deleteTarget,
        expandedCompanyId,
        formData,
        getCompanyActions,
        handleDeleteCompany,
        handleFormSubmit,
        handlePlanAccessUpdated,
        handlePageChange,
        handlePageSizeChange,
        handleProvisionSubmit,
        handleStatusChange,
        handleToggleMembers,
        isEditOpen,
        isProvisionOpen,
        isPlanCatalogOpen,
        loading,
        loadingCompanyId,
        membersByCompany,
        provisionData,
        planAccessTarget,
        selectedCompanyRef,
        setDeleteTarget,
        setFormData,
        setIsEditOpen,
        setIsProvisionOpen,
        setIsPlanCatalogOpen,
        setProvisionData,
        setPlanAccessTarget,
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
        companyPage,
        companyPageSize,
        companyTotal,
        deleteTarget,
        expandedCompanyId,
        formData,
        getCompanyActions,
        handleDeleteCompany,
        handleFormSubmit,
        handlePlanAccessUpdated,
        handlePageChange,
        handlePageSizeChange,
        handleProvisionSubmit,
        handleStatusChange,
        handleToggleMembers,
        isEditOpen,
        isProvisionOpen,
        isPlanCatalogOpen,
        loadingCompanyId,
        membersByCompany,
        provisionData,
        planAccessTarget,
        selectedCompanyRef,
        setDeleteTarget,
        setFormData,
        setIsEditOpen,
        setIsProvisionOpen,
        setIsPlanCatalogOpen,
        setProvisionData,
        setPlanAccessTarget,
        setStatusTarget,
        statusTarget,
        submitting,
    } = controller;

    return (
        <div className="mx-auto max-w-7xl space-y-4 px-[3%] py-6 text-[var(--text-main)] md:p-8">
            <PageHeader
                icon={Building2}
                title="Administración de empresas"
                subtitle="Vista global de todas las empresas registradas en WorkHive."
                titleAs="h2"
                className="mb-0"
                actions={(
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsPlanCatalogOpen(true)}>
                            <SlidersHorizontal className="h-4 w-4" />
                            Gestionar planes
                        </Button>
                        <Button
                            onClick={() => setIsProvisionOpen(true)}
                            className={PAGE_ACTION_BUTTON_PRIMARY}
                        >
                            <Plus className="h-4 w-4" />
                            Nueva empresa
                        </Button>
                    </div>
                )}
            />

            <TrialRequestsPanel />

            <CompaniesListSection
                companies={companies}
                total={companyTotal}
                page={companyPage}
                pageSize={companyPageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                emptyLabel="Todavía no se ha activado ninguna empresa."
                labels={{
                    listTitle: "Empresas activadas",
                    listSubtitle: "Pulsa el nombre de una empresa para ver a sus administradores y trabajadores.",
                    countOne: "empresa",
                    countMany: "empresas",
                    name: "Empresa",
                    cif: "CIF / NIF",
                    email: "Contacto principal",
                    phone: "Teléfono",
                    status: "Plan y estado",
                    actions: "Acciones",
                    active: "Activa",
                    inactive: "Sin acceso",
                    viewTeam: "Ver personas",
                    admins: "Administradores",
                    workers: "Trabajadores",
                    noAdmins: "No hay administradores",
                    noWorkers: "No hay trabajadores",
                    memberInactive: "Inactiva",
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

            <CompanyPlanAccessDialog
                company={planAccessTarget}
                onOpenChange={(open) => !open && setPlanAccessTarget(null)}
                onUpdated={handlePlanAccessUpdated}
            />

            <PlanCatalogEditorDialog
                open={isPlanCatalogOpen}
                onOpenChange={setIsPlanCatalogOpen}
            />

            <DeleteConfirmDialog
                open={statusTarget !== null}
                onOpenChange={(open) => !open && setStatusTarget(null)}
                title={statusTarget && isCompanyAccessEnabled(statusTarget) ? "¿Desactivar empresa?" : "¿Reactivar empresa?"}
                description={statusTarget && isCompanyAccessEnabled(statusTarget)
                    ? `Las personas de ${statusTarget.name} ya no podrán acceder. Se conservarán los trabajos, facturas, clientes e historial.`
                    : `Las personas de ${statusTarget?.name || "esta empresa"} podrán volver a acceder y utilizar sus datos existentes.`}
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
                title="¿Eliminar empresa permanentemente?"
                description={`Esta acción no se puede deshacer. ${deleteTarget?.name || "Esta empresa"} solo se puede eliminar si no tiene trabajos, reservas, facturas, presupuestos ni registros fiscales.`}
                onConfirm={handleDeleteCompany}
                isDeleting={submitting}
                confirmText="Eliminar permanentemente"
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
                    editTitle: "Editar empresa",
                    name: "Nombre / razón social",
                    cif: "CIF / NIF",
                    phone: "Teléfono",
                    email: "Email de la empresa",
                    address: "Dirección legal",
                    iban: "IBAN",
                    swiftBic: "SWIFT / BIC",
                    cancel: "Cancelar",
                    saving: "Guardando…",
                    save: "Guardar cambios",
                }}
            />
        </div>
    );
}
