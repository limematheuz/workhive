"use client";

import { useState } from "react";

import { Building2, CalendarDays, CircleDollarSign, ListChecks, Mail, MapPin, Phone, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { SummaryMetricCard } from "@/components/ui/summary-metric-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocumentEmailDialog } from "@/components/billing/DocumentEmailDialog";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { ClientWorkspaceRow } from "@/lib/client-workspace";
import { ClientService, type Client } from "@/services/client.service";
import type { InvoiceEmailPayload } from "@/services/invoice.service";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";

import { ClientContactsTab } from "./ClientContactsTab";

type ClientDetailOverviewProps = {
    client: Client;
    row: ClientWorkspaceRow;
    locations: Location[];
    tasks: TaskItem[];
    financialDataAvailable: boolean;
    canManage: boolean;
    onViewLocationTasks: (location: Location) => void;
    onOpenLocations: () => void;
};

function clientTypeLabel(client: Client): string {
    if (client.client_type === "business") return "Empresa";
    if (client.client_type === "company") return "Colaborador";
    return "Particular";
}

function address(client: Client): string {
    return [client.address, client.postal_code, client.city, client.province, client.country].filter(Boolean).join(", ");
}

export function ClientDetailOverview({
    client,
    row,
    locations,
    tasks,
    financialDataAvailable,
    canManage,
    onViewLocationTasks,
    onOpenLocations,
}: ClientDetailOverviewProps) {
    const { locale } = useDictionary();
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const completedTasks = tasks.filter((task) => task.status === "completed").length;
    const locationPagination = useDataTablePagination(locations, 10);
    const stats = [
        { label: "Trabajos realizados", value: String(completedTasks), detail: "Este año", icon: ListChecks },
        { label: "Próximo trabajo", value: row.nextScheduledAt ? formatDate(row.nextScheduledAt) : "Sin programar", detail: row.nextScheduledAt ? "Planificado" : "Añádelo desde Trabajos", icon: CalendarDays },
        ...(financialDataAvailable ? [
            { label: "Facturación", value: formatCurrency(row.annualBillingTotal), detail: "Sin IVA", icon: ReceiptText },
            { label: "Saldo pendiente", value: formatCurrency(row.pendingBalance), detail: row.pendingBalance > 0 ? "Pendiente de cobro" : "Al día", icon: CircleDollarSign },
        ] : []),
        { label: "Ubicaciones", value: String(row.locationCount), detail: "Activas y compartidas", icon: MapPin },
    ];

    const sendEmail = async (data: InvoiceEmailPayload): Promise<boolean> => {
        const recipientEmails = data.recipient_emails ?? (data.recipient_email ? [data.recipient_email] : []);
        if (recipientEmails.length === 0) return false;
        try {
            setSendingEmail(true);
            await ClientService.sendClientEmail(client.id, {
                recipient_emails: recipientEmails,
                copy_emails: data.copy_emails ?? [],
                subject: data.subject,
                message: data.message,
                send_copy: data.send_copy ?? false,
                save_recipients: data.save_recipients ?? false,
                save_recipient_to_client_id: data.save_recipient_to_client_id,
                locale: data.locale ?? locale,
            });
            toast.success(locale === "en" ? "Email sent." : "Email enviado.");
            return true;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : locale === "en" ? "Could not send the email." : "No se pudo enviar el email.");
            return false;
        } finally {
            setSendingEmail(false);
        }
    };

    return (
        <div className="space-y-5">
            <section className={`grid gap-3 ${financialDataAvailable ? "xl:grid-cols-5" : "md:grid-cols-3"}`} aria-label="Resumen operativo">
                {stats.map((stat) => <SummaryMetricCard key={stat.label} label={stat.label} value={stat.value} description={stat.detail} icon={stat.icon} />)}
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,.9fr)]">
                <section className="billing-surface rounded-[22px] p-5">
                    <h3 className="text-sm font-semibold text-[var(--text-main)]">Información general</h3>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        <InfoItem icon={Building2} label="Razón social" value={client.name} />
                        <InfoItem icon={Building2} label="NIF / CIF" value={client.legal_number || "No informado"} />
                        <InfoItem icon={MapPin} label="Dirección" value={address(client) || "No informada"} />
                        <InfoItem icon={Building2} label="Tipo de cliente" value={clientTypeLabel(client)} />
                    </div>
                    <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Estado</p>
                        <Badge className={`mt-2 ${client.is_active ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>{client.is_active ? "Activo" : "Inactivo"}</Badge>
                    </div>
                </section>

                <section className="billing-surface rounded-[22px] p-5">
                    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-[var(--text-main)]">Contacto principal</h3><span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand-blue-soft)] text-accent"><Phone className="h-4 w-4" /></span></div>
                    <div className="mt-5 space-y-4">
                        <InfoItem icon={Mail} label="Email" value={client.email || "No informado"} />
                        <InfoItem icon={Phone} label="Teléfono" value={client.phone || "No informado"} />
                    </div>
                    {(client.email || client.phone) && <div className="mt-5 flex flex-wrap gap-2">
                        {client.email && <Button type="button" variant="secondary" size="sm" onClick={() => setEmailDialogOpen(true)}><Mail aria-hidden="true" />Enviar email</Button>}
                        {client.phone && <Button asChild type="button" variant="outline" size="sm"><a href={`tel:${client.phone}`}><Phone aria-hidden="true" />Llamar</a></Button>}
                    </div>}
                </section>
            </div>

            <ClientContactsTab client={client} canManage={canManage} />

            <section className="billing-surface overflow-hidden rounded-[22px]">
                <header className="flex items-center justify-between gap-3 px-5 py-4"><div><h3 className="text-sm font-semibold text-[var(--text-main)]">Ubicaciones</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Acceso rápido a los locales de este cliente.</p></div><Button type="button" variant="ghost" size="xs" onClick={onOpenLocations}>Ver todas</Button></header>
                {locations.length === 0 ? <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">Aún no hay ubicaciones asignadas.</p> : <>
                    <Table className="min-w-[42rem] table-fixed"><TableHeader><TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--btn-secondary-text)]"><TableHead className="w-[30%] text-[var(--btn-secondary-text)]">Nombre</TableHead><TableHead className="w-[40%] text-[var(--btn-secondary-text)]">Dirección</TableHead><TableHead className="w-[16%] text-[var(--btn-secondary-text)]">Tipo</TableHead><TableHead className="w-[14%] text-right text-[var(--btn-secondary-text)]">Acciones</TableHead></TableRow></TableHeader><TableBody>{locationPagination.pageItems.map((location) => <TableRow key={location.id} className="bg-[var(--bg-secondary)]/20"><TableCell className="truncate font-semibold text-[var(--text-main)]">{location.name}</TableCell><TableCell className="truncate text-xs text-[var(--text-muted)]">{location.address}, {location.city}</TableCell><TableCell className="text-xs text-[var(--text-muted)]">{location.location_type || "—"}</TableCell><TableCell className="text-right"><Button type="button" variant="outline" size="xs" onClick={() => onViewLocationTasks(location)}>Ver tareas</Button></TableCell></TableRow>)}</TableBody></Table>
                    <DataTablePagination page={locationPagination.page} totalItems={locations.length} pageSize={locationPagination.pageSize} onPageChange={locationPagination.setPage} onPageSizeChange={locationPagination.setPageSize} summary={`${(locationPagination.page - 1) * locationPagination.pageSize + 1}-${Math.min(locationPagination.page * locationPagination.pageSize, locations.length)} de ${locations.length} ubicaciones`} rowsPerPageLabel="Filas por página" previousLabel="Página anterior" nextLabel="Página siguiente" />
                </>}
            </section>
            <DocumentEmailDialog
                open={emailDialogOpen}
                onOpenChange={setEmailDialogOpen}
                invoiceNumber={client.name}
                documentLabel={locale === "en" ? "message" : "mensaje"}
                defaultSubject={locale === "en" ? `Message for ${client.name}` : `Mensaje para ${client.name}`}
                defaultMessage=""
                defaultEmail={client.email || ""}
                recipientClient={client}
                isSending={sendingEmail}
                onSend={sendEmail}
            />
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
    return <div className="flex min-w-0 items-start gap-2.5"><span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-tertiary)] text-accent"><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-sm font-semibold text-[var(--text-main)]">{value}</p></div></div>;
}
