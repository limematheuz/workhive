"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, UserRound, UserRoundX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { ClientService, type Client, type ClientContact, type ClientContactPayload, type ClientContactRole } from "@/services/client.service";

type ClientContactsTabProps = {
    client: Client;
    canManage: boolean;
};

type ContactDraft = ClientContactPayload;

const roleOrder: ClientContactRole[] = ["commercial", "billing", "operations", "quality", "emergency", "general"];

function draftFromContact(contact?: ClientContact): ContactDraft {
    return {
        full_name: contact?.full_name ?? "",
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        job_title: contact?.job_title ?? null,
        roles: contact?.roles ?? [],
        is_primary: contact?.is_primary ?? false,
        is_active: contact?.is_active ?? true,
    };
}

export function ClientContactsTab({ client, canManage }: ClientContactsTabProps) {
    const { dict } = useDictionary();
    const copy = dict.clients.contacts;
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [editorContact, setEditorContact] = useState<ClientContact | null | undefined>(undefined);
    const [deactivateTarget, setDeactivateTarget] = useState<ClientContact | null>(null);
    const [deactivating, setDeactivating] = useState(false);

    const loadContacts = useCallback(async () => {
        try {
            setLoading(true);
            setContacts(await ClientService.getClientContacts(client.id));
        } catch (error) {
            toast.error(getErrorMessage(error, copy.load_error));
        } finally {
            setLoading(false);
        }
    }, [client.id, copy.load_error]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => void loadContacts(), 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadContacts]);

    const deactivate = async () => {
        if (!deactivateTarget) return;
        try {
            setDeactivating(true);
            await ClientService.deactivateClientContact(client.id, deactivateTarget.id);
            setDeactivateTarget(null);
            await loadContacts();
            toast.success(copy.deactivate_success);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.deactivate_error));
        } finally {
            setDeactivating(false);
        }
    };

    if (loading) {
        return <div className="flex min-h-48 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 size-4 animate-spin" />{dict.clients.details.loading}</div>;
    }

    return (
        <section className="space-y-4">
            <header className="flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-base font-semibold text-[var(--text-main)]">{copy.title}</h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.description}</p>
                </div>
                {canManage && <Button type="button" onClick={() => setEditorContact(null)}><Plus className="size-4" />{copy.new}</Button>}
            </header>

            {contacts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-primary)]/30 px-5 py-12 text-center">
                    <UserRound className="mx-auto size-5 text-accent" />
                    <h4 className="mt-3 text-sm font-semibold text-[var(--text-main)]">{copy.empty_title}</h4>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.empty_description}</p>
                </div>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    {contacts.map((contact) => <ContactCard key={contact.id} contact={contact} canManage={canManage} onEdit={() => setEditorContact(contact)} onDeactivate={() => setDeactivateTarget(contact)} />)}
                </div>
            )}

            {editorContact !== undefined && (
                <ContactEditorDialog
                    clientId={client.id}
                    contact={editorContact}
                    onOpenChange={(open) => !open && setEditorContact(undefined)}
                    onSaved={async () => {
                        setEditorContact(undefined);
                        await loadContacts();
                    }}
                />
            )}
            <DeleteConfirmDialog
                open={Boolean(deactivateTarget)}
                onOpenChange={(open) => !open && setDeactivateTarget(null)}
                title={copy.deactivate_title}
                description={copy.deactivate_description}
                confirmText={copy.deactivate}
                cancelText={copy.cancel}
                confirmVariant="soft-danger"
                isDeleting={deactivating}
                onConfirm={deactivate}
                confirmIcon={UserRoundX}
            />
        </section>
    );
}

function ContactCard({ contact, canManage, onEdit, onDeactivate }: { contact: ClientContact; canManage: boolean; onEdit: () => void; onDeactivate: () => void }) {
    const { dict } = useDictionary();
    const copy = dict.clients.contacts;
    const labels: Record<ClientContactRole, string> = {
        commercial: copy.role_commercial,
        billing: copy.role_billing,
        operations: copy.role_operations,
        quality: copy.role_quality,
        emergency: copy.role_emergency,
        general: copy.role_general,
    };

    return (
        <article className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 p-4">
            <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]"><UserRound className="size-5" /></div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-semibold text-[var(--text-main)]">{contact.full_name}</h4>
                        {contact.is_primary && <Badge variant="secondary">{copy.primary_badge}</Badge>}
                        {!contact.is_active && <Badge variant="outline">{copy.inactive}</Badge>}
                    </div>
                    {contact.job_title && <p className="mt-1 text-sm text-[var(--text-muted)]">{contact.job_title}</p>}
                    <div className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
                        {contact.email && <p className="truncate">{contact.email}</p>}
                        {contact.phone && <p>{contact.phone}</p>}
                    </div>
                </div>
            </div>
            {contact.roles.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{contact.roles.map((role) => <Badge key={role} variant="outline">{labels[role]}</Badge>)}</div>}
            {canManage && (
                <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={onEdit}><Pencil className="size-3.5" />{copy.edit}</Button>
                    {contact.is_active && <Button type="button" variant="dangerSoft" size="sm" onClick={onDeactivate}><UserRoundX className="size-3.5" />{copy.deactivate}</Button>}
                </div>
            )}
        </article>
    );
}

function ContactEditorDialog({ clientId, contact, onOpenChange, onSaved }: { clientId: number; contact: ClientContact | null; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
    const { dict } = useDictionary();
    const copy = dict.clients.contacts;
    const [draft, setDraft] = useState<ContactDraft>(() => draftFromContact(contact ?? undefined));
    const [saving, setSaving] = useState(false);
    const editing = contact !== null;
    const roleLabels: Record<ClientContactRole, string> = {
        commercial: copy.role_commercial,
        billing: copy.role_billing,
        operations: copy.role_operations,
        quality: copy.role_quality,
        emergency: copy.role_emergency,
        general: copy.role_general,
    };

    const toggleRole = (role: ClientContactRole, checked: boolean) => {
        setDraft((current) => ({
            ...current,
            roles: checked ? [...current.roles, role] : current.roles.filter((value) => value !== role),
        }));
    };

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setSaving(true);
            const payload: ClientContactPayload = {
                ...draft,
                full_name: draft.full_name.trim(),
                email: draft.email?.trim() || null,
                phone: draft.phone?.trim() || null,
                job_title: draft.job_title?.trim() || null,
            };
            if (editing) {
                await ClientService.updateClientContact(clientId, contact.id, payload);
            } else {
                await ClientService.createClientContact(clientId, payload);
            }
            toast.success(editing ? copy.update_success : copy.create_success);
            await onSaved();
        } catch (error) {
            toast.error(getErrorMessage(error, copy.save_error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                    <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-5 text-left sm:px-6">
                        <DialogTitle>{editing ? copy.edit : copy.new}</DialogTitle>
                        <DialogDescription>{copy.description}</DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <FieldGroup className="gap-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <ContactField id="contact-full-name" label={copy.full_name} value={draft.full_name} required onChange={(full_name) => setDraft((current) => ({ ...current, full_name }))} />
                                <ContactField id="contact-job-title" label={copy.job_title} value={draft.job_title ?? ""} onChange={(job_title) => setDraft((current) => ({ ...current, job_title }))} />
                                <ContactField id="contact-email" label={copy.email} type="email" value={draft.email ?? ""} onChange={(email) => setDraft((current) => ({ ...current, email }))} />
                                <ContactField id="contact-phone" label={copy.phone} value={draft.phone ?? ""} onChange={(phone) => setDraft((current) => ({ ...current, phone }))} />
                            </div>
                            <Field>
                                <FieldLabel>{copy.responsibilities}</FieldLabel>
                                <FieldContent>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {roleOrder.map((role) => <label key={role} className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/35 px-3 py-2.5 text-sm font-medium text-[var(--text-main)]"><Checkbox checked={draft.roles.includes(role)} onCheckedChange={(checked) => toggleRole(role, checked === true)} />{roleLabels[role]}</label>)}
                                    </div>
                                    <FieldDescription>{copy.responsibilities_hint}</FieldDescription>
                                </FieldContent>
                            </Field>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <label className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/35 px-3 py-2.5 text-sm font-medium text-[var(--text-main)]"><Checkbox checked={draft.is_primary} disabled={!draft.is_active} onCheckedChange={(checked) => setDraft((current) => ({ ...current, is_primary: checked === true }))} />{copy.primary}</label>
                                <label className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/35 px-3 py-2.5 text-sm font-medium text-[var(--text-main)]"><Checkbox checked={draft.is_active} onCheckedChange={(checked) => setDraft((current) => ({ ...current, is_active: checked === true, is_primary: checked === true ? current.is_primary : false }))} />{copy.active}</label>
                            </div>
                        </FieldGroup>
                    </div>
                    <DialogFooter className="dialog-glass-chrome shrink-0 border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                        <Button type="button" variant="outline" className="btn-cancel-muted" onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
                        <Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? copy.saving : copy.save}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ContactField({ id, label, value, onChange, required = false, type = "text" }: { id: string; label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
    return <Field><FieldLabel htmlFor={id}>{label}{required && <span className="ml-1 text-destructive">*</span>}</FieldLabel><Input id={id} type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></Field>;
}
