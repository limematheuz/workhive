"use client";

import { useState } from "react";

import { Building2, CalendarDays, CircleDollarSign, ListChecks, Mail, MapPin, Phone, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { SummaryMetricCard } from "@/components/ui/summary-metric-card";
import { DocumentEmailDialog } from "@/components/billing/DocumentEmailDialog";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { ClientWorkspaceRow } from "@/lib/client-workspace";
import { ClientService, type Client } from "@/services/client.service";
import type { InvoiceEmailPayload } from "@/services/invoice.service";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";

type ClientDetailOverviewProps = {
    client: Client;
    row: ClientWorkspaceRow;
    locations: Location[];
    tasks: TaskItem[];
    financialDataAvailable: boolean;
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
    onViewLocationTasks,
    onOpenLocations,
}: ClientDetailOverviewProps) {
    const { locale } = useDictionary();
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const completedTasks = tasks.filter((task) => task.status === "completed").length;
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

            <section className="billing-surface overflow-hidden rounded-[22px] p-3 sm:p-4">
                <DataListTable
                    variant="plain"
                    items={locations.slice(0, 4)}
                    getRowKey={(location) => location.id}
                    gridClassName="grid-cols-[minmax(12rem,1.2fr)_minmax(13rem,1fr)_6rem_7rem]"
                    header={{
                        title: "Ubicaciones",
                        subtitle: locations.length > 0 ? "Acceso rápido a los locales de este cliente." : "Este cliente aún no tiene ubicaciones.",
                        countLabel: `${locations.length}`,
                    }}
                    toolbar={locations.length > 4 ? <Button type="button" variant="ghost" size="xs" onClick={onOpenLocations}>Ver todas las ubicaciones</Button> : undefined}
                    columns={[
                        { key: "name", label: "Nombre" },
                        { key: "address", label: "Dirección" },
                        { key: "type", label: "Tipo" },
                        { key: "actions", label: "", className: "text-right" },
                    ]}
                    empty={<p className="py-6 text-center text-sm text-[var(--text-muted)]">Aún no hay ubicaciones asignadas.</p>}
                    renderCompactRow={(location) => <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{location.address}, {location.city}</p></div><Button type="button" variant="outline" size="xs" onClick={() => onViewLocationTasks(location)}>Ver tareas</Button></div>}
                    renderDesktopRow={(location) => <><span className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</span><span className="truncate text-xs text-[var(--text-muted)]">{location.address}, {location.city}</span><span className="text-xs text-[var(--text-muted)]">{location.location_type || "—"}</span><div className="flex justify-end"><Button type="button" variant="outline" size="xs" onClick={() => onViewLocationTasks(location)}>Ver tareas</Button></div></>}
                />
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
