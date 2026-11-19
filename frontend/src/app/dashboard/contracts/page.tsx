"use client"

import * as React from "react"
import { FileSignature, Loader2, MapPin } from "lucide-react"
import { redirect, useRouter, useSearchParams } from "next/navigation"

import { ServiceContractDetailDialog } from "@/components/contracts/ServiceContractDetailDialog"
import { Badge } from "@/components/ui/badge"
import { DataListTable } from "@/components/ui/data-list-table"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { canManageFinance, canViewFinance, canViewLaborCosts, isPlatformSuperadmin } from "@/domain/access/roles"
import { useContractList } from "@/hooks/useContractList"
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner"
import type { User } from "@/types/user"
import { useDictionary } from "@/lib/dictionary-context"
import { formatCurrency, formatDate } from "@/lib/format"
import { getErrorMessage } from "@/lib/errors"
import { toast } from "@/lib/toast"
import { useUser } from "@/lib/user-context"
import type { Client } from "@/services/client.service"
import { ServiceContractService } from "@/services/service-contract.service"
import type { ServiceContract } from "@/types/service-contract"

const statusCopy = {
    draft: "Borrador",
    active: "Activo",
    terminated: "Finalizado",
} as const

function contractClientName(contract: ServiceContract, clients: Client[]) {
    if (contract.client_id === null) return "Cliente sin registrar"
    return clients.find((client) => client.id === contract.client_id)?.name ?? `Cliente #${contract.client_id}`
}

function ContractsPageContent() {
    const { user, loading } = useUser()
    if (loading) return <ContractsPageLoading />
    if (!user || !canViewFinance(user) || isPlatformSuperadmin(user)) redirect("/dashboard")
    return <ContractsWorkspace key={`${user.id}:${user.company_id}:${user.role?.name}`} user={user} />
}

function ContractsWorkspace({ user }: { user: User }) {
    const { dict } = useDictionary()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { contracts, clients, loading, refreshing, error: loadError, reload: loadContracts, updateContract } = useContractList(`${user.id}:${user.company_id}:${user.role?.name}`)
    const [selectedContract, setSelectedContract] = React.useState<ServiceContract | null>(null)
    const [detailOpen, setDetailOpen] = React.useState(false)
    const canManageContracts = canManageFinance(user)
    const canViewMargin = canViewLaborCosts(user)

    const openContract = React.useCallback(async (contract: ServiceContract) => {
        try {
            setSelectedContract(await ServiceContractService.getContract(contract.id, `contracts:${user.id}:${user.company_id}:${user.role?.name}:detail`))
            setDetailOpen(true)
        } catch (error: unknown) {
            setSelectedContract(null)
            setDetailOpen(false)
            toast.error(getErrorMessage(error, "No se pudo cargar el contrato"))
        }
    }, [user])

    React.useEffect(() => {
        const timer = window.setTimeout(() => void loadContracts(), 0)
        return () => window.clearTimeout(timer)
    }, [loadContracts])

    const sourceQuoteId = Number(searchParams.get("quote"))
    React.useEffect(() => {
        if (loading || loadError || !Number.isSafeInteger(sourceQuoteId) || sourceQuoteId < 1) return

        const contract = contracts.find((item) => item.source_quote_id === sourceQuoteId)
        const timer = window.setTimeout(() => {
            if (contract) void openContract(contract)
        }, 0)
        router.replace("/dashboard/contracts", { scroll: false })
        return () => window.clearTimeout(timer)
    }, [contracts, loadError, loading, openContract, router, sourceQuoteId])

    const today = new Date()
    const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    const renewals = contracts.flatMap(contract => {
        if (contract.status !== "active" || !contract.ends_at) return []
        const endDay = Date.parse(contract.ends_at.slice(0, 10) + "T00:00:00Z")
        const days = Math.round((endDay - todayDay) / 86400000)
        return days <= contract.renewal_notice_days ? [{ contract, days }] : []
    }).sort((a, b) => a.days - b.days)

    const receiveContractUpdate = (updated: ServiceContract) => {
        updateContract(updated)
        setSelectedContract(updated)
    }

    if (loading) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
                <Loader2 className="size-8 animate-spin text-accent" aria-hidden="true" />
                <span className="text-xs text-[var(--text-muted)]">Cargando contratos…</span>
            </div>
        )
    }

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader
                icon={FileSignature}
                title="Contratos"
                subtitle="Acuerdos generados desde presupuestos aceptados. Activarlos nunca crea trabajos automáticamente."
                className="mb-8"
            />

            {loadError && contracts.length > 0 && <ReadRecoveryBanner kind={loadError} message={loadError === "denied" ? dict.contracts.error_denied : dict.contracts.error_load} retryLabel={dict.contracts.retry} onRetry={() => void loadContracts()} retrying={refreshing} />}

            {renewals.length > 0 && <section className="mb-4 rounded-lg border border-orange-300 p-3">
                <h2 className="font-semibold">Contratos que requieren revisión ({renewals.length})</h2>
                {renewals.map(({contract, days}) => <button type="button" key={contract.id} onClick={() => void openContract(contract)} className="flex w-full flex-wrap justify-between gap-2 border-b py-2 text-left text-sm">
                    <span>{contract.contract_number} · {contract.title}</span>
                    <strong className="text-orange-700 dark:text-orange-300">{days < 0 ? "Vigencia finalizada" : days === 0 ? "Vence hoy" : `Vence en ${days} días`}</strong>
                </button>)}
            </section>}
            <DataListTable
                items={contracts}
                getRowKey={(contract) => contract.id}
                desktopFrom="lg"
                header={{
                    title: "Contratos registrados",
                    subtitle: "Revisa servicios, ubicaciones cubiertas, SLA, vigencia y renovación.",
                    countLabel: `${contracts.length} ${contracts.length === 1 ? "contrato" : "contratos"}`,
                }}
                columns={[
                    { key: "number", label: "Contrato", className: "w-[16%]" },
                    { key: "client", label: "Cliente", className: "w-[18%]" },
                    { key: "services", label: "Servicios", className: "w-[25%]" },
                    { key: "locations", label: "Ubicaciones", className: "w-[14%] text-center" },
                    { key: "renewal", label: "Renovación", className: "w-[13%]" },
                    { key: "status", label: "Estado", className: "w-[14%] text-center" },
                ]}
                renderDesktopRow={(contract) => [
                    <div key="number" className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold text-accent">{contract.contract_number}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{formatDate(contract.created_at)}</p>
                    </div>,
                    <p key="client" className="truncate text-sm font-medium text-[var(--text-main)]">{contractClientName(contract, clients)}</p>,
                    <div key="services" className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-main)]">{contract.title}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{contract.service_lines.length} {contract.service_lines.length === 1 ? "servicio" : "servicios"} · {formatCurrency(contract.quote_snapshot.total_amount ?? 0)}</p>
                    </div>,
                    <div key="locations" className="flex items-center justify-center gap-1.5 text-sm font-semibold text-[var(--text-main)]"><MapPin className="size-4 text-accent" aria-hidden="true" />{contract.covered_locations.filter((location) => location.is_active).length}</div>,
                    <div key="renewal" className="min-w-0 text-sm text-[var(--text-main)]"><p className="truncate">{contract.renewal_mode === "automatic" ? "Automática" : "Manual"}</p><p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">Aviso {contract.renewal_notice_days} días</p></div>,
                    <div key="status" className="flex justify-center"><Badge variant={contract.status === "active" ? "default" : "secondary"}>{statusCopy[contract.status]}</Badge></div>,
                ]}
                renderCompactRow={(contract) => (
                    <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-mono text-xs font-semibold text-accent">{contract.contract_number}</p>
                                <p className="mt-1 truncate text-sm font-semibold text-[var(--text-main)]">{contract.title}</p>
                                <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{contractClientName(contract, clients)}</p>
                            </div>
                            <Badge variant={contract.status === "active" ? "default" : "secondary"}>{statusCopy[contract.status]}</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--table-divider)] pt-3 text-xs text-[var(--text-muted)]">
                            <span>{contract.service_lines.length} servicios · {contract.covered_locations.filter((location) => location.is_active).length} ubicaciones</span>
                            <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(contract.quote_snapshot.total_amount ?? 0)}</span>
                        </div>
                    </div>
                )}
                onRowClick={(contract) => void openContract(contract)}
                rowAriaLabel={(contract) => `Abrir contrato ${contract.contract_number}`}
                empty={loadError ? (
                    <div role="alert" className="space-y-3 py-4 text-center">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                            {loadError === "denied"
                                ? (dict.contracts?.error_denied ?? "No tienes permisos para consultar contratos.")
                                : (dict.contracts?.error_load ?? "No se pudieron cargar los contratos.")}
                        </p>
                        {loadError === "unavailable" && <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={() => void loadContracts()}>
                            {dict.contracts?.retry ?? "Reintentar"}
                        </Button>}
                    </div>
                ) : (
                    <div><FileSignature className="mx-auto mb-3 size-10 text-[var(--text-muted)] opacity-50" aria-hidden="true" /><p className="text-sm font-medium text-[var(--text-muted)]">Los contratos aparecerán cuando aceptes un presupuesto.</p></div>
                )}
            />

            <ServiceContractDetailDialog
                contract={selectedContract}
                clientName={selectedContract ? contractClientName(selectedContract, clients) : ""}
                canManage={canManageContracts}
                canViewMargin={canViewMargin}
                open={detailOpen}
                onOpenChange={(open) => {
                    setDetailOpen(open)
                    if (!open) setSelectedContract(null)
                }}
                onContractUpdated={receiveContractUpdate}
            />
        </div>
    )
}

function ContractsPageLoading() {
    return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-accent" aria-hidden="true" />
            <span className="text-xs text-[var(--text-muted)]">Cargando contratos…</span>
        </div>
    )
}

export default function ContractsPage() {
    return (
        <React.Suspense fallback={<ContractsPageLoading />}>
            <ContractsPageContent />
        </React.Suspense>
    )
}
