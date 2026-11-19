"use client"

import * as React from "react"
import { CalendarClock, CircleCheck, FilePenLine, FileSignature, Loader2, MapPin } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FormSelect } from "@/components/ui/form-select"
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card"
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton"
import { FinanceLoadError } from "@/components/finance/FinanceLoadError"
import { useViewState } from "@/hooks/useViewState"
import { redirect, useRouter, useSearchParams } from "next/navigation"

import { ServiceContractDetailDialog } from "@/components/contracts/ServiceContractDetailDialog"
import { Badge } from "@/components/ui/badge"
import { DataListTable } from "@/components/ui/data-list-table"
import { PageHeader } from "@/components/ui/page-header"
import { canManageFinance, canViewFinance, canViewLaborCosts, isPlatformSuperadmin } from "@/domain/access/roles"
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

function ContractsPageContent() {
    const { user, loading: userLoading } = useUser()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [contracts, setContracts] = React.useState<ServiceContract[]>([])
    const [clients, setClients] = React.useState<Client[]>([])
    const [loading, setLoading] = React.useState(true)
    const [loadError, setLoadError] = React.useState(false)
    const [search, setSearch] = useViewState("contracts.search", "")
    const [status, setStatus] = useViewState("contracts.status", "")
    const [attention, setAttention] = useViewState("contracts.renewals", false)
    const [selectedContract, setSelectedContract] = React.useState<ServiceContract | null>(null)
    const [detailOpen, setDetailOpen] = React.useState(false)
    const canViewContracts = canViewFinance(user) && !isPlatformSuperadmin(user)
    const canManageContracts = canManageFinance(user) && !isPlatformSuperadmin(user)
    const canViewMargin = canViewLaborCosts(user) && canViewContracts

    if (!userLoading && (!user || !canViewContracts)) {
        redirect("/dashboard")
    }

    const loadContracts = React.useCallback(async () => {
        if (!canViewContracts) return
        setLoading(true)
        setLoadError(false)
        try {
            const [contractData, clientData] = await Promise.all([
                ServiceContractService.getAllContracts(),
                ClientService.getAllClients().catch(() => [] as Client[]),
            ])
            setContracts(contractData)
            setClients(clientData)
        } catch (error: unknown) {
            setLoadError(true)
            toast.error(getErrorMessage(error, "No se pudieron cargar los contratos"))
        } finally {
            setLoading(false)
        }
    }, [canViewContracts])

    const openContract = React.useCallback(async (contract: ServiceContract) => {
        try {
            setSelectedContract(await ServiceContractService.getContract(contract.id))
            setDetailOpen(true)
        } catch (error: unknown) {
            setSelectedContract(null)
            setDetailOpen(false)
            toast.error(getErrorMessage(error, "No se pudo cargar el contrato"))
        }
    }, [])

    React.useEffect(() => {
        const timer = window.setTimeout(() => void loadContracts(), 0)
        return () => window.clearTimeout(timer)
    }, [loadContracts])

    const sourceQuoteId = Number(searchParams.get("quote"))
    React.useEffect(() => {
        if (loading || !Number.isSafeInteger(sourceQuoteId) || sourceQuoteId < 1) return

        const contract = contracts.find((item) => item.source_quote_id === sourceQuoteId)
        const timer = window.setTimeout(() => {
            if (contract) void openContract(contract)
        }, 0)
        router.replace("/dashboard/contracts", { scroll: false })
        return () => window.clearTimeout(timer)
    }, [contracts, loading, openContract, router, sourceQuoteId])

    const today = new Date()
    const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    const renewals = contracts.flatMap(contract => {
        if (contract.status !== "active" || !contract.ends_at) return []
        const endDay = Date.parse(contract.ends_at.slice(0, 10) + "T00:00:00Z")
        const days = Math.round((endDay - todayDay) / 86400000)
        return days <= contract.renewal_notice_days ? [{ contract, days }] : []
    }).sort((a, b) => a.days - b.days)
    const renewalIds = new Set(renewals.map(({ contract }) => contract.id))
    const visibleContracts = contracts.filter((contract) => (!status || contract.status === status) && (!attention || renewalIds.has(contract.id)) && (!search.trim() || `${contract.contract_number} ${contract.title} ${contractClientName(contract, clients)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
    const quoteAmount = (contract: ServiceContract) => typeof contract.quote_snapshot.total_amount === "number" && Number.isFinite(contract.quote_snapshot.total_amount) ? formatCurrency(contract.quote_snapshot.total_amount) : "Importe no disponible"

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
                className="mb-4"
                actions={canManageContracts ? <Button asChild><Link href="/dashboard/quotes">Preparar presupuesto</Link></Button> : undefined}
            />

            {loadError ? <FinanceLoadError message="No se han podido consultar todos los contratos." onRetry={() => void loadContracts()} /> : <SummaryMetricGrid desktopColumns={3} className="mb-4"><FinanceMetricButton label="Requieren revisión" value={String(renewals.length)} description="Vigencia finalizada o dentro del aviso de renovación" icon={CalendarClock} attention={renewals.length > 0} active={attention} onClick={() => { setAttention(true); setStatus(""); setSearch(""); }} /><FinanceMetricButton label="Contratos activos" value={String(contracts.filter((item) => item.status === "active").length)} description="Acuerdos activos · ver registros" icon={CircleCheck} active={!attention && status === "active"} onClick={() => { setAttention(false); setStatus("active"); setSearch(""); }} /><FinanceMetricButton label="Pendientes de activar" value={String(contracts.filter((item) => item.status === "draft").length)} description="Borradores procedentes de presupuestos aceptados" icon={FilePenLine} active={!attention && status === "draft"} onClick={() => { setAttention(false); setStatus("draft"); setSearch(""); }} /></SummaryMetricGrid>}

            {renewals.length > 0 && <section className="mb-4 rounded-lg border border-orange-300 p-3">
                <h2 className="font-semibold">Contratos que requieren revisión ({renewals.length})</h2>
                {renewals.slice(0, 3).map(({contract, days}) => <button type="button" key={contract.id} onClick={() => void openContract(contract)} className="flex w-full flex-wrap justify-between gap-2 border-b py-2 text-left text-sm">
                    <span>{contract.contract_number} · {contract.title}</span>
                    <strong className="text-orange-700 dark:text-orange-300">{days < 0 ? "Vigencia finalizada" : days === 0 ? "Vence hoy" : `Vence en ${days} días`}</strong>
                </button>)}
            </section>}
            <div className="billing-surface mb-4 flex flex-wrap items-center gap-3 rounded-xl p-3"><Input className="min-w-48 flex-1" aria-label="Buscar contrato" placeholder="Referencia, título o cliente…" value={search} onChange={(event) => setSearch(event.target.value)} /><FormSelect aria-label="Estado del contrato" value={status} onValueChange={setStatus}><option value="">Todos los estados</option>{Object.entries(statusCopy).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</FormSelect>{attention && <span className="text-xs text-orange-600 dark:text-orange-300">Requieren revisión</span>}{(status || attention || search) && <Button variant="ghost" size="sm" onClick={() => { setStatus(""); setAttention(false); setSearch(""); }}>Restablecer</Button>}</div>
            <DataListTable
                items={loadError ? [] : visibleContracts}
                getRowKey={(contract) => contract.id}
                desktopFrom="lg"
                header={{
                    title: "Contratos registrados",
                    subtitle: "Revisa servicios, ubicaciones cubiertas, SLA, vigencia y renovación.",
                    countLabel: `${visibleContracts.length} contratos`,
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
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{contract.service_lines.length} servicios · Presupuesto: {quoteAmount(contract)}</p>
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
                            <span className="font-mono font-semibold text-[var(--text-main)]">Presupuesto: {quoteAmount(contract)}</span>
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
