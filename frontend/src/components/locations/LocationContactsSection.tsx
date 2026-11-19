import { Plus, Trash2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEditableLineKey } from "@/lib/editable-line-key";
import type { LocationContact, LocationContactRole } from "@/types/location";
import type { LocationFeaturesStepProps } from "./location-workspace-types";



const CONTACT_ROLE_LABELS: Record<LocationContactRole, string> = {
    operations: "Operaciones",
    access: "Acceso",
    emergency: "Emergencias",
    quality: "Calidad",
    general: "General",
};

const EMPTY_CONTACT: LocationContact = {
    full_name: "",
    email: "",
    phone: "",
    role: "operations",
    is_primary: false,
    is_active: true,
};

export function LocationContactsSection({
    contacts,
    setContacts,

}: Pick<LocationFeaturesStepProps, "contacts" | "setContacts">) {
    const updateContact = (index: number, changes: Partial<LocationContact>) => {
        setContacts(contacts.map((contact, contactIndex) => (
            contactIndex === index ? { ...contact, ...changes } : contact
        )));
    };
    const setPrimaryContact = (index: number, isPrimary: boolean) => {
        setContacts(contacts.map((contact, contactIndex) => ({
            ...contact,
            is_primary: isPrimary && contactIndex === index,
        })));
    };

    return (
            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                            <UserRound className="h-4 w-4 text-accent" />
                            Contactos operativos
                        </div>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                            Personas del lugar para acceso, operación, calidad o emergencias. No sustituyen los contactos comerciales o de facturación de la cuenta.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setContacts([...contacts, { ...EMPTY_CONTACT, draft_id: createEditableLineKey("location-contact") }])}
                    >
                        <Plus className="h-4 w-4" /> Añadir contacto
                    </Button>
                </div>

                {contacts.length === 0 ? (
                    <p className="mt-4 rounded-xl bg-[var(--bg-secondary)] px-3 py-3 text-sm text-[var(--text-muted)]">
                        Aún no hay contactos operativos para esta ubicación.
                    </p>
                ) : (
                    <div className="mt-4 space-y-3">
                        {contacts.map((contact, index) => (
                            <div key={contact.id ?? contact.draft_id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 sm:p-4">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`location-contact-name-${index}`}>Nombre</Label>
                                        <Input
                                            id={`location-contact-name-${index}`}
                                            value={contact.full_name}
                                            onChange={(event) => updateContact(index, { full_name: event.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`location-contact-role-${index}`}>Responsabilidad</Label>
                                        <Select value={contact.role} onValueChange={(value) => updateContact(index, { role: value as LocationContactRole })}>
                                            <SelectTrigger id={`location-contact-role-${index}`}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`location-contact-phone-${index}`}>Teléfono</Label>
                                        <Input
                                            id={`location-contact-phone-${index}`}
                                            type="tel"
                                            value={contact.phone || ""}
                                            onChange={(event) => updateContact(index, { phone: event.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`location-contact-email-${index}`}>Email</Label>
                                        <Input
                                            id={`location-contact-email-${index}`}
                                            type="email"
                                            value={contact.email || ""}
                                            onChange={(event) => updateContact(index, { email: event.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)]">
                                        <label className="flex cursor-pointer items-center gap-2">
                                            <Checkbox
                                                checked={contact.is_primary}
                                                disabled={!contact.is_active}
                                                onCheckedChange={(checked) => setPrimaryContact(index, checked === true)}
                                            />
                                            Contacto principal
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2">
                                            <Checkbox
                                                checked={contact.is_active}
                                                onCheckedChange={(checked) => updateContact(index, {
                                                    is_active: checked === true,
                                                    ...(checked === true ? {} : { is_primary: false }),
                                                })}
                                            />
                                            Activo
                                        </label>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-[var(--text-muted)] hover:text-destructive"
                                        onClick={() => setContacts(contacts.filter((_, contactIndex) => contactIndex !== index))}
                                    >
                                        <Trash2 className="h-4 w-4" /> Eliminar
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </section>
    );
}
