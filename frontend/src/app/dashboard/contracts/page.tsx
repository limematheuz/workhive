"use client"

import * as React from "react"
import { FileSignature, Loader2, MapPin } from "lucide-react"
import { redirect } from "next/navigation"

import { ServiceContractDetailDialog } from "@/components/contracts/ServiceContractDetailDialog"
import { Badge } from "@/components/ui/badge"
import { DataListTable } from "@/components/ui/data-list-table"
import { PageHeader } from "@/components/ui/page-header"
import { canManageFinance, canViewFinance, isPlatformSuperadmin } from "@/domain/access/roles"
import { formatCurrency, formatDate } from "@/lib/format"
import { getErrorMessage } from "@/lib/errors"
import { toast } from "@/lib/toast"
import { useUser } from "@/lib/user-context"
import { ClientService, type Client } from "@/services/client.service"
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

export default function ContractsPage() {
    const { user, loading: userLoading } = useUser()
    const [contracts, setContracts] = React.useState<ServiceContract[]>([])
    const [clients, setClients] = React.useState<Client[]>([])
    const [loading, setLoading] = React.useState(true)
    const [selectedContract, setSelectedContract] = React.useState<ServiceContract | null>(null)
    const [detailOpen, setDetailOpen] = React.useState(false)
    const canViewContracts = canViewFinance(user) && !isPlatformSuperadmin(user)
    const canManageContracts = canManageFinance(user) && !isPlatformSuperadmin(user)

    if (!userLoading && (!user || !canViewContracts)) {
        redirect("/dashboard")
    }

    const loadContracts = React.useCallback(async () => {
        if (!canViewContracts) return
        setLoading(true)
        try {
            const [contractData, clientData] = await Promise.all([
                ServiceContractService.getContracts(),
                ClientService.getClients().catch(() => [] as Client[]),
            ])
            setContracts(contractData)
            setClients(clientData)
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "No se pudieron cargar los contratos"))
        } finally {
            setLoading(false)
        }
    }, [canViewContracts])

    React.useEffect(() => {
        const timer = window.setTimeout(() => void loadContracts(), 0)
        return () => window.clearTimeout(timer)
    }, [loadContracts])

    const openContract = async (contract: ServiceContract) => {
        try {
            setSelectedContract(await ServiceContractService.getContract(contract.id))
        } catch {
            setSelectedContract(contract)
        }
        setDetailOpen(true)
    }

    const receiveContractUpdate = (updated: ServiceContract) => {
        setContracts((current) => current.map((contract) => contract.id === updated.id ? updated : contract))
        setSelectedContract(updated)
    }

    if (userLoading || loading) {
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
                empty={<div><FileSignature className="mx-auto mb-3 size-10 text-[var(--text-muted)] opacity-50" aria-hidden="true" /><p className="text-sm font-medium text-[var(--text-muted)]">Los contratos aparecerán cuando aceptes un presupuesto.</p></div>}
            />

            <ServiceContractDetailDialog
                contract={selectedContract}
                clientName={selectedContract ? contractClientName(selectedContract, clients) : ""}
                canManage={canManageContracts}
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
