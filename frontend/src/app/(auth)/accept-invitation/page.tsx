"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { PasswordCreationFields } from "@/components/auth/PasswordCreationFields";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField } from "@/components/ui/select-field";
import { useDictionary } from "@/lib/dictionary-context";
import { getAuthErrorMessage } from "@/lib/auth-forms";
import { resolveInvitationToken } from "@/lib/invitation-token";
import { isStrongPassword } from "@/lib/password-strength";
import { useThemeMode } from "@/lib/theme";
import { authService } from "@/services/auth.service";

function AcceptInvitationContent() {
    const searchParams = useSearchParams();
    const [token, setToken] = useState<string | null>(null);
    const hasReadInvitationToken = useRef(false);
    const { locale } = useDictionary();
    const [theme, setTheme] = useThemeMode();
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [acceptLegal, setAcceptLegal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [accountMode, setAccountMode] = useState("new");
    const [existingEmail, setExistingEmail] = useState("");
    const [existingPassword, setExistingPassword] = useState("");

    useEffect(() => {
        if (hasReadInvitationToken.current) return;
        const invitation = resolveInvitationToken({
            hash: window.location.hash,
            queryToken: searchParams.get("token"),
        });
        hasReadInvitationToken.current = true;
        setToken(invitation.token);
        if (invitation.shouldClearUrl) {
            window.history.replaceState(null, "", "/accept-invitation");
        }
    }, [searchParams]);

    const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting || !token || !acceptLegal || (accountMode === "new" && password !== confirmPassword)) return;
        setSubmitting(true);
        try {
            if (accountMode === "existing") await authService.login(existingEmail.trim(), existingPassword);
            await authService.acceptWorkerInvitation(
                token,
                code,
                accountMode === "new" ? password : undefined,
            );
            if (accountMode === "existing") {
                try { await authService.login(existingEmail.trim(), existingPassword); }
                catch { toast.error(locale === "es" ? "La empresa se ha añadido. Inicia sesión de nuevo para entrar." : "Company access was added. Sign in again to enter."); }
            }
            setAccepted(true);
        } catch (error: unknown) {
            const message = getAuthErrorMessage(
                error,
                locale === "es" ? "No se pudo activar tu acceso." : "Could not activate your access.",
            );
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const invalid = !token || !/^\d{8}$/.test(code) || !acceptLegal || (accountMode === "new"
        ? !isStrongPassword(password) || password !== confirmPassword
        : !existingEmail.trim() || !existingPassword);
    const text = locale === "es" ? {
        title: "Activa tu acceso",
        checking: "Comprobando el enlace de invitación…",
        intro: "Introduce el código de tu invitación. Si ya tienes cuenta, acepta con ella para conservar todos tus accesos.",
        code: "Código de verificación",
        password: "Contraseña",
        confirm: "Confirmar contraseña",
        legal: "Acepto los términos y la política de privacidad.",
        submit: "Aceptar invitación",
        creating: "Creando acceso...",
        successTitle: "Acceso activado",
        success: "El acceso a la empresa está activado. Selecciónala en el selector de empresa al entrar. Tus otros accesos se conservan.",
        invalid: "El enlace de invitación no es válido. Pide a tu administrador que te envíe uno nuevo.",
    } : {
        title: "Activate your access",
        checking: "Checking the invitation link…",
        intro: "Enter your invitation code. If you already have an account, accept with it to keep your other access.",
        code: "Verification code",
        password: "Password",
        confirm: "Confirm password",
        legal: "I accept the terms and privacy notice.",
        submit: "Accept invitation",
        creating: "Creating access...",
        successTitle: "Access activated",
        success: "Company access is active. Choose it in the company selector when entering. Your other access is preserved.",
        invalid: "This invitation link is invalid. Ask your administrator to send a new one.",
    };

    return (
        <main className="relative flex min-h-dvh w-full min-w-0 flex-col items-center bg-[var(--bg-primary)] px-4 pb-6 pt-24 text-[var(--text-main)] sm:pt-20 md:p-8">
            <AuthTopControls showThemeToggle theme={theme} onThemeChange={setTheme} />
            <section className="my-auto w-full max-w-md rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-xl sm:p-8">
                <div className="mb-6 flex justify-center"><AuthLogo className="w-32 sm:w-40" priority /></div>
                {accepted ? (
                    <div className="space-y-3 py-6 text-center">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
                        <h1 className="text-2xl font-black">{text.successTitle}</h1>
                        <p className="text-sm text-[var(--text-muted)]">{text.success}</p>
                        <Button asChild className="mt-4"><Link href="/accesos">{locale === "es" ? "Ir a mis aplicaciones" : "Open my applications"}</Link></Button>
                    </div>
                ) : token === null ? (
                    <div className="py-6 text-center"><p className="text-sm text-[var(--text-muted)]">{text.checking}</p></div>
                ) : !token ? (
                    <div className="space-y-3 py-6 text-center">
                        <MailCheck className="mx-auto h-12 w-12 text-red-500" />
                        <p className="text-sm text-[var(--text-muted)]">{text.invalid}</p>
                    </div>
                ) : (
                    <form className="space-y-5" onSubmit={onSubmit} autoComplete="off">
                        <div>
                            <h1 className="text-2xl font-black">{text.title}</h1>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">{text.intro}</p>
                        </div>
                        <Field className="gap-2">
                            <FieldLabel htmlFor="worker-invitation-mode">{locale === "es" ? "Tu cuenta de WorkHive" : "Your WorkHive account"}</FieldLabel>
                            <SelectField id="worker-invitation-mode" aria-label={locale === "es" ? "Tu cuenta de WorkHive" : "Your WorkHive account"} value={accountMode} onValueChange={setAccountMode} options={[
                                { value: "new", label: locale === "es" ? "Es mi primera cuenta" : "This is my first account" },
                                { value: "existing", label: locale === "es" ? "Ya tengo una cuenta" : "I already have an account" },
                            ]} />
                        </Field>
                        <Field className="gap-2">
                            <FieldLabel htmlFor="worker-invitation-code">{text.code}</FieldLabel>
                            <Input
                                id="worker-invitation-code"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={8}
                                required
                                value={code}
                                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                                className="h-12 text-center font-mono text-xl tracking-[0.35em]"
                            />
                        </Field>
                        {accountMode === "new" ? <PasswordCreationFields
                            locale={locale}
                            password={password}
                            confirmPassword={confirmPassword}
                            acceptLegal={acceptLegal}
                            onPasswordChange={setPassword}
                            onConfirmPasswordChange={setConfirmPassword}
                            onAcceptLegalChange={setAcceptLegal}
                            idPrefix="worker-invitation"
                        /> : <div className="space-y-4">
                            <p className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-sm leading-6 text-muted-foreground">{locale === "es" ? "Usa el correo al que se envió la invitación y tu contraseña actual. Aceptar añade esta empresa a tu cuenta; no cambia tu contraseña." : "Use the invited email and your current password. Accepting adds this company to your account and keeps your password."}</p>
                            <Field className="gap-2"><FieldLabel htmlFor="invitation-existing-email">Email</FieldLabel><Input id="invitation-existing-email" type="email" autoComplete="username" value={existingEmail} onChange={event => setExistingEmail(event.target.value)} required /></Field>
                            <Field className="gap-2"><FieldLabel htmlFor="invitation-existing-password">{locale === "es" ? "Contraseña actual" : "Current password"}</FieldLabel><Input id="invitation-existing-password" type="password" autoComplete="current-password" value={existingPassword} onChange={event => setExistingPassword(event.target.value)} required /></Field>
                            <Field orientation="horizontal" className="items-start gap-3"><Checkbox id="invitation-existing-legal" checked={acceptLegal} onCheckedChange={value => setAcceptLegal(value === true)} /><FieldLabel htmlFor="invitation-existing-legal" className="font-normal leading-6">{text.legal} <Link href="/terms" target="_blank" className="text-accent underline">{locale === "es" ? "Términos" : "Terms"}</Link>{" · "}<Link href="/privacy" target="_blank" className="text-accent underline">{locale === "es" ? "Privacidad" : "Privacy"}</Link></FieldLabel></Field>
                        </div>}
                        <Button type="submit" className="w-full" disabled={submitting || invalid}>
                            {submitting ? text.creating : text.submit}
                        </Button>
                    </form>
                )}
            </section>
        </main>
    );
}

export default function AcceptInvitationPage() {
    return <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)]" />}><AcceptInvitationContent /></Suspense>;
}
