"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import { Client, ClientService } from "@/services/client.service";
import {
    InvoiceEmailContact,
    InvoiceEmailContactService,
} from "@/services/invoice-email-contact.service";
import { InvoiceEmailPayload } from "@/services/invoice.service";
import { InvoiceEmailDialogFooter } from "./InvoiceEmailDialogFooter";
import { InvoiceEmailFormSection } from "./InvoiceEmailFormSection";
import { InvoiceEmailSuggestionsAside } from "./InvoiceEmailSuggestionsAside";
import {
    addEmailValues,
    buildEmailSuggestions,
    getKnownRecipientEmails,
    isValidEmail,
    normalized,
    splitEmailInput,
    uniqueEmails,
    withoutRecipientDuplicates,
} from "./invoice-email-utils";

interface InvoiceEmailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoiceNumber: string;
    defaultSubject: string;
    defaultMessage: string;
    documentLabel?: string;
    submitLabel?: string;
    description?: string;
    defaultEmail?: string;
    fromName?: string;
    fromEmail?: string;
    recipientClient?: Pick<Client, "id" | "name" | "email"> | null;
    isSending: boolean;
    onSend: (data: InvoiceEmailPayload) => Promise<boolean>;
}

type InvoiceEmailDialogBodyProps = Omit<InvoiceEmailDialogProps, "open">;

function InvoiceEmailDialogBody({
    onOpenChange,
    invoiceNumber,
    defaultSubject,
    defaultMessage,
    documentLabel = "factura",
    submitLabel,
    description,
    defaultEmail = "",
    fromName = "WorkHive",
    fromEmail = "",
    recipientClient = null,
    isSending,
    onSend,
}: InvoiceEmailDialogBodyProps) {
    const { dict, locale } = useDictionary();
    const invoiceText = dict.invoices;
    const initialEmail = defaultEmail.trim();
    const [directory, setDirectory] = useState<{
        clients: Client[];
        savedContacts: InvoiceEmailContact[];
        isLoadingClients: boolean;
    }>({ clients: [], savedContacts: [], isLoadingClients: true });
    const [search, setSearch] = useState("");
    const [copySearch, setCopySearch] = useState("");
    const [recipients, setRecipients] = useState<string[]>(
        () => (initialEmail && isValidEmail(initialEmail) ? [initialEmail] : []),
    );
    const [copyRecipients, setCopyRecipients] = useState<string[]>([]);
    const [subject, setSubject] = useState(defaultSubject);
    const [message, setMessage] = useState(defaultMessage);
    const [sendCopy, setSendCopy] = useState(false);
    const [saveRecipients, setSaveRecipients] = useState(false);
    const [saveRecipientToClient, setSaveRecipientToClient] = useState(false);
    const [isRecipientMenuOpen, setIsRecipientMenuOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            ClientService.getClients(true).catch(() => []),
            InvoiceEmailContactService.getContacts("", 100).catch(() => []),
        ])
            .then(([loadedClients, loadedContacts]) => {
                if (cancelled) return;
                setDirectory({
                    clients: loadedClients,
                    savedContacts: loadedContacts,
                    isLoadingClients: false,
                });
            })
            .catch(() => {
                if (cancelled) return;
                setDirectory({
                    clients: [],
                    savedContacts: [],
                    isLoadingClients: false,
                });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const { clients, savedContacts, isLoadingClients } = directory;

    const addRecipients = (emails: string[]) => {
        const nextRecipients = uniqueEmails(recipients, emails);
        if (nextRecipients.length === recipients.length) {
            setSearch("");
            return;
        }
        setRecipients(nextRecipients);
        setCopyRecipients((current) =>
            withoutRecipientDuplicates(current, nextRecipients),
        );
        setSaveRecipientToClient(false);
        setSearch("");
    };

    const addCopyRecipients = (emails: string[]) => {
        addEmailValues(
            setCopyRecipients,
            withoutRecipientDuplicates(emails, recipients),
            () => setCopySearch(""),
        );
    };

    const removeRecipient = (email: string) => {
        setRecipients((current) => current.filter((item) => item !== email));
        setSaveRecipientToClient(false);
    };

    const removeCopyRecipient = (email: string) => {
        setCopyRecipients((current) => current.filter((item) => item !== email));
    };

    const emailSuggestions = useMemo(
        () => buildEmailSuggestions({
            clients,
            savedContacts,
            recipients,
            search,
            invoiceText,
        }),
        [clients, invoiceText, recipients, savedContacts, search],
    );

    const typedEmails = splitEmailInput(search);
    const validTypedEmails = typedEmails.filter(isValidEmail);
    const typedCopyEmails = splitEmailInput(copySearch);
    const validTypedCopyEmails = typedCopyEmails.filter(isValidEmail);
    const canAddTypedEmails = validTypedEmails.length > 0;
    const canAddTypedCopyEmails = validTypedCopyEmails.length > 0;
    const canSend = recipients.length > 0 && !isSending;
    const knownRecipientEmails = useMemo(
        () => getKnownRecipientEmails(clients, savedContacts),
        [clients, savedContacts],
    );
    const newExternalRecipients = recipients.filter(
        (email) => !knownRecipientEmails.has(normalized(email)),
    );
    const canSaveRecipientToClient = Boolean(
        recipientClient
        && recipients.length === 1
        && normalized(recipientClient.email) !== normalized(recipients[0]),
    );
    const saveRecipientToClientLabel = canSaveRecipientToClient
        ? invoiceText.email_save_to_client.replace("{client}", recipientClient!.name)
        : undefined;

    const handleRecipientKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (!["Enter", "Tab", ","].includes(event.key) || !canAddTypedEmails) return;
        event.preventDefault();
        addRecipients(validTypedEmails);
    };

    const handleCopyKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (!["Enter", "Tab", ","].includes(event.key) || !canAddTypedCopyEmails) return;
        event.preventDefault();
        addCopyRecipients(validTypedCopyEmails);
    };

    const handleSend = async () => {
        if (!canSend) return;
        const sent = await onSend({
            recipient_emails: recipients,
            copy_emails: withoutRecipientDuplicates(copyRecipients, recipients),
            subject: subject.trim() || undefined,
            message: message.trim() || undefined,
            send_copy: sendCopy,
            save_recipients: (
                saveRecipients
                && newExternalRecipients.length > 0
                && !canSaveRecipientToClient
            ),
            save_recipient_to_client_id: (
                saveRecipientToClient && canSaveRecipientToClient
                    ? recipientClient!.id
                    : undefined
            ),
            locale,
        });
        if (sent) {
            onOpenChange(false);
        }
    };

    const handleDeleteSavedContact = async (contactId: number) => {
        try {
            await InvoiceEmailContactService.deleteContact(contactId);
            setDirectory((current) => ({
                ...current,
                savedContacts: current.savedContacts.filter((contact) => contact.id !== contactId),
            }));
        } catch {
            toast.error(invoiceText.email_remove_saved_error);
        }
    };

    return (
        <>
            <DialogHeader className="dialog-glass-chrome border-b border-[var(--border-soft)] px-5 py-5 pr-16 sm:px-7">
                <DialogTitle className="flex min-w-0 items-center gap-3 text-xl font-black tracking-tight text-[var(--text-main)] sm:text-2xl">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25 sm:h-11 sm:w-11">
                        <Mail className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 break-words">
                        {invoiceText.email_dialog_title.replace("{document}", documentLabel)}
                    </span>
                </DialogTitle>
                <DialogDescription className="text-sm text-[var(--text-muted)]">
                    {description || invoiceText.email_invoice_description.replace("{number}", invoiceNumber)}
                </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto bg-[var(--bg-secondary)]/45 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <InvoiceEmailFormSection
                    fromName={fromName}
                    fromEmail={fromEmail}
                    recipients={recipients}
                    search={search}
                    onSearchChange={(value) => {
                        setSearch(value);
                        setIsRecipientMenuOpen(true);
                    }}
                    onSearchFocus={() => setIsRecipientMenuOpen(true)}
                    onSearchBlur={() => {
                        addRecipients(validTypedEmails);
                        window.setTimeout(() => setIsRecipientMenuOpen(false), 120);
                    }}
                    onRecipientKeyDown={handleRecipientKeyDown}
                    onRemoveRecipient={removeRecipient}
                    onAddRecipients={addRecipients}
                    validTypedEmails={validTypedEmails}
                    canAddTypedEmails={canAddTypedEmails}
                    emailSuggestions={emailSuggestions}
                    isLoadingClients={isLoadingClients}
                    isRecipientMenuOpen={isRecipientMenuOpen}
                    copyRecipients={copyRecipients}
                    copySearch={copySearch}
                    onCopySearchChange={setCopySearch}
                    onCopyKeyDown={handleCopyKeyDown}
                    onCopyBlur={() => addCopyRecipients(validTypedCopyEmails)}
                    onRemoveCopyRecipient={removeCopyRecipient}
                    subject={subject}
                    onSubjectChange={setSubject}
                    message={message}
                    onMessageChange={setMessage}
                    invoiceNumber={invoiceNumber}
                    invoiceText={invoiceText}
                />

                <InvoiceEmailSuggestionsAside
                    isLoadingClients={isLoadingClients}
                    canAddTypedEmails={canAddTypedEmails}
                    validTypedEmails={validTypedEmails}
                    emailSuggestions={emailSuggestions}
                    onAddRecipients={addRecipients}
                    onDeleteSavedContact={handleDeleteSavedContact}
                    invoiceText={invoiceText}
                />
            </div>

            <InvoiceEmailDialogFooter
                sendCopy={sendCopy}
                onSendCopyChange={setSendCopy}
                saveRecipients={saveRecipients}
                onSaveRecipientsChange={setSaveRecipients}
                showSaveRecipients={newExternalRecipients.length > 0 && !canSaveRecipientToClient}
                saveRecipientToClient={saveRecipientToClient}
                onSaveRecipientToClientChange={setSaveRecipientToClient}
                saveRecipientToClientLabel={saveRecipientToClientLabel}
                canSend={canSend}
                isSending={isSending}
                onCancel={() => onOpenChange(false)}
                onSend={() => void handleSend()}
                submitLabel={submitLabel}
                invoiceText={invoiceText}
            />
        </>
    );
}

export function InvoiceEmailDialog({
    open,
    onOpenChange,
    invoiceNumber,
    defaultSubject,
    defaultMessage,
    documentLabel = "factura",
    submitLabel,
    description,
    defaultEmail = "",
    fromName = "WorkHive",
    fromEmail = "",
    recipientClient = null,
    isSending,
    onSend,
}: InvoiceEmailDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!flex max-h-[92dvh] !w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] !flex-col !gap-0 overflow-hidden !p-0 sm:!w-[min(70rem,calc(100vw-3rem))] sm:!max-w-[min(70rem,calc(100vw-3rem))]">
                {open ? (
                    <InvoiceEmailDialogBody
                        key={`${invoiceNumber}|${defaultSubject}|${defaultEmail}`}
                        onOpenChange={onOpenChange}
                        invoiceNumber={invoiceNumber}
                        defaultSubject={defaultSubject}
                        defaultMessage={defaultMessage}
                        documentLabel={documentLabel}
                        submitLabel={submitLabel}
                        description={description}
                        defaultEmail={defaultEmail}
                        fromName={fromName}
                        fromEmail={fromEmail}
                        recipientClient={recipientClient}
                        isSending={isSending}
                        onSend={onSend}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
