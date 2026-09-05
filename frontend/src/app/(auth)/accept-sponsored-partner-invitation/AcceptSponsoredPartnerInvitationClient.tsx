"use client";

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LogIn, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordCreationFields } from "@/components/auth/PasswordCreationFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiResponseError } from "@/lib/api";
import { useDictionary } from "@/lib/dictionary-context";
import { resolveInvitationToken } from "@/lib/invitation-token";
import { cn } from "@/lib/utils";
import { sponsoredPartnerInvitationService } from "@/services/sponsored-partner-invitation.service";

type PortalForm = {
    verificationCode: string;
    companyName: string;
    taxId: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
    phone: string;
    fullName: string;
    password: string;
    confirmPassword: string;
    acceptLegal: boolean;
};

const initialForm: PortalForm = {
    verificationCode: "",
    companyName: "",
    taxId: "",
    address: "",
    postalCode: "",
    city: "",
    province: "",
    phone: "",
    fullName: "",
    password: "",
    confirmPassword: "",
    acceptLegal: false,
};

function textFor(locale: string) {
    return locale === "es" ? {
        eyebrow: "Portal de inmobiliaria",
        title: "Crea tu acceso limitado",
        description: "Completa los datos de tu inmobiliaria para gestionar propiedades y solicitar limpiezas a la empresa que te ha invitado.",
        code: "Código del correo",
        company: "Nombre o razón social",
        taxId: "NIF / CIF",
        address: "Dirección fiscal",
        postalCode: "Código postal",
        city: "Ciudad",
        province: "Provincia",
        phone: "Teléfono",
        fullName: "Tu nombre completo",
        submit: "Crear portal",
        creating: "Creando portal…",
        invalidTitle: "Invitación no disponible",
        invalid: "Este enlace ya no es válido. Pide a la empresa que te invitó que envíe una nueva invitación.",
        successTitle: "Portal creado",
        success: "Tu acceso está listo. Inicia sesión para gestionar propiedades y solicitudes de limpieza.",
        login: "Iniciar sesión",
        passwordMismatch: "Las contraseñas no coinciden.",
        legalRequired: "Debes aceptar los términos y la política de privacidad.",
        codeInvalid: "El código de verificación no es correcto. Revisa el correo e inténtalo de nuevo.",
        expired: "Esta invitación ha caducado. Pide una nueva a la empresa que te invitó.",
        accountExists: "Este correo ya tiene una cuenta de WorkHive. Contacta con la empresa que te invitó para definir el acceso correcto.",
        unavailable: "No se pudo crear el portal. Revisa los datos e inténtalo de nuevo.",
    } : {
        eyebrow: "Property manager portal",
        title: "Create your limited access",
        description: "Complete your property manager details to manage properties and request cleaning from the company that invited you.",
        code: "Email code",
        company: "Legal company name",
        taxId: "Tax ID",
        address: "Business address",
        postalCode: "Postal code",
        city: "City",
        province: "Region",
        phone: "Phone",
        fullName: "Your full name",
        submit: "Create portal",
        creating: "Creating portal…",
        invalidTitle: "Invitation unavailable",
        invalid: "This link is no longer valid. Ask the company that invited you to send a new invitation.",
        successTitle: "Portal created",
        success: "Your access is ready. Sign in to manage properties and cleaning requests.",
        login: "Sign in",
        passwordMismatch: "Passwords do not match.",
        legalRequired: "You must accept the terms and privacy notice.",
        codeInvalid: "The verification code is incorrect. Check the email and try again.",
        expired: "This invitation has expired. Ask the company that invited you for a new one.",
        accountExists: "This email already has a WorkHive account. Contact the inviting company to define the correct access.",
        unavailable: "We could not create the portal. Check the details and try again.",
    };
}

function errorMessage(error: unknown, text: ReturnType<typeof textFor>) {
    if (!(error instanceof ApiResponseError)) return text.unavailable;
    if (error.status === 400) return text.codeInvalid;
    if (error.status === 409) return text.accountExists;
    if (error.status === 410) return text.expired;
    return error.message || text.unavailable;
}

export default function AcceptSponsoredPartnerInvitationClient() {
    const { locale } = useDictionary();
    const searchParams = useSearchParams();
    const hasReadToken = useRef(false);
    const [token, setToken] = useState("");
    const [form, setForm] = useState<PortalForm>(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [complete, setComplete] = useState(false);
    const text = textFor(locale);

    useEffect(() => {
        if (hasReadToken.current) return;
        hasReadToken.current = true;
        const invitation = resolveInvitationToken({
            hash: window.location.hash,
            queryToken: searchParams.get("token"),
        });
        setToken(invitation.token);
        if (invitation.shouldClearUrl) {
            window.history.replaceState(null, "", "/accept-sponsored-partner-invitation");
        }
    }, [searchParams]);

    const update = <Key extends keyof PortalForm>(key: Key, value: PortalForm[Key]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!token || submitting) return;
        if (form.password !== form.confirmPassword) {
            toast.error(text.passwordMismatch);
            return;
        }
        if (!form.acceptLegal) {
            toast.error(text.legalRequired);
            return;
        }
        try {
            setSubmitting(true);
            await sponsoredPartnerInvitationService.accept({
                token,
                verification_code: form.verificationCode.trim().toUpperCase(),
                company_name: form.companyName.trim(),
                tax_id: form.taxId.trim(),
                address: form.address.trim(),
                postal_code: form.postalCode.trim() || undefined,
                city: form.city.trim() || undefined,
                province: form.province.trim() || undefined,
                phone: form.phone.trim(),
                full_name: form.fullName.trim(),
                password: form.password,
                accept_terms: true,
                accept_privacy: true,
                marketing_consent: false,
            });
            setComplete(true);
        } catch (error) {
            toast.error(errorMessage(error, text));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell contentClassName="my-auto w-full max-w-2xl">
            <AuthGlassCard className="billing-surface border-[var(--border-soft)] p-6 sm:p-8">
                <AuthLogo className="mb-6 w-32 sm:w-40" priority />
                {!token ? (
                    <PortalMessage title={text.invalidTitle} message={text.invalid} />
                ) : complete ? (
                    <PortalMessage title={text.successTitle} message={text.success} success action={(
                        <Button asChild className="mt-3"><Link href="/login"><LogIn />{text.login}</Link></Button>
                    )} />
                ) : (
                    <form className="space-y-6" onSubmit={(event) => void submit(event)}>
                        <header className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{text.eyebrow}</p>
                            <h1 className="text-2xl font-bold text-[var(--text-main)]">{text.title}</h1>
                            <p className="text-sm leading-6 text-[var(--text-muted)]">{text.description}</p>
                        </header>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormInput id="portal-invite-code" label={text.code} value={form.verificationCode} onChange={(value) => update("verificationCode", value)} wrapperClassName="sm:col-span-2" inputClassName="font-mono uppercase tracking-[0.18em]" required />
                            <FormInput id="portal-company-name" label={text.company} value={form.companyName} onChange={(value) => update("companyName", value)} autoComplete="organization" required />
                            <FormInput id="portal-tax-id" label={text.taxId} value={form.taxId} onChange={(value) => update("taxId", value)} required />
                            <FormInput id="portal-address" label={text.address} value={form.address} onChange={(value) => update("address", value)} autoComplete="street-address" wrapperClassName="sm:col-span-2" required />
                            <FormInput id="portal-postal-code" label={text.postalCode} value={form.postalCode} onChange={(value) => update("postalCode", value)} autoComplete="postal-code" />
                            <FormInput id="portal-city" label={text.city} value={form.city} onChange={(value) => update("city", value)} autoComplete="address-level2" />
                            <FormInput id="portal-province" label={text.province} value={form.province} onChange={(value) => update("province", value)} autoComplete="address-level1" />
                            <FormInput id="portal-phone" label={text.phone} value={form.phone} onChange={(value) => update("phone", value)} autoComplete="tel" required />
                            <FormInput id="portal-full-name" label={text.fullName} value={form.fullName} onChange={(value) => update("fullName", value)} autoComplete="name" wrapperClassName="sm:col-span-2" required />
                        </div>
                        <PasswordCreationFields
                            locale={locale}
                            password={form.password}
                            confirmPassword={form.confirmPassword}
                            acceptLegal={form.acceptLegal}
                            onPasswordChange={(value) => update("password", value)}
                            onConfirmPasswordChange={(value) => update("confirmPassword", value)}
                            onAcceptLegalChange={(value) => update("acceptLegal", value)}
                            idPrefix="sponsored-partner"
                        />
                        <Button type="submit" className="w-full" disabled={submitting}>
                            {submitting ? <ShieldCheck className="animate-spin" /> : <ShieldCheck />}
                            {submitting ? text.creating : text.submit}
                        </Button>
                    </form>
                )}
            </AuthGlassCard>
        </AuthShell>
    );
}

function FormInput({
    id,
    label,
    value,
    onChange,
    required = false,
    autoComplete,
    wrapperClassName,
    inputClassName,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    autoComplete?: string;
    wrapperClassName?: string;
    inputClassName?: string;
}) {
    return (
        <div className={cn("space-y-1.5", wrapperClassName)}>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                required={required}
                autoComplete={autoComplete}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={cn("mt-1.5", inputClassName)}
            />
        </div>
    );
}

function PortalMessage({
    title,
    message,
    success = false,
    action,
}: {
    title: string;
    message: string;
    success?: boolean;
    action?: ReactNode;
}) {
    return (
        <div className="space-y-3 py-5 text-center">
            <CheckCircle2 className={`mx-auto h-10 w-10 ${success ? "text-accent" : "text-[var(--text-muted)]"}`} />
            <h1 className="text-xl font-bold text-[var(--text-main)]">{title}</h1>
            <p className="text-sm leading-6 text-[var(--text-muted)]">{message}</p>
            {action}
        </div>
    );
}
