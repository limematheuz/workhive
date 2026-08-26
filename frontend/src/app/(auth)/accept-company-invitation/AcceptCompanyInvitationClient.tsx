"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import {
    CompanyInvitationSignupData,
    CompanyInvitationSignupWizard,
} from "@/components/collaborations/CompanyInvitationSignupWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiResponseError } from "@/lib/api";
import { useDictionary } from "@/lib/dictionary-context";
import { authService } from "@/services/auth.service";
import { CollaborationService } from "@/services/collaboration.service";

type AccessState =
    | "reading"
    | "checking"
    | "new-account"
    | "sign-in"
    | "existing-no-company"
    | "ready"
    | "non-admin"
    | "wrong-account"
    | "error";
type Decision = "accepted" | "declined" | null;

const INVITATION_TOKEN_STORAGE_KEY = "workhive:company-collaboration-invitation-token";

function normalizeInvitationCode(code: string) {
    return code.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function clearStoredInvitationToken() {
    try {
        window.sessionStorage.removeItem(INVITATION_TOKEN_STORAGE_KEY);
    } catch {
        // There is no persisted invitation state to remove.
    }
}

function AcceptCompanyInvitationContent({ initialToken }: { initialToken: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { locale } = useDictionary();
    const [token, setToken] = useState("");
    const [accessState, setAccessState] = useState<AccessState>("reading");
    const [verificationCode, setVerificationCode] = useState("");
    const [initialFullName, setInitialFullName] = useState("");
    const [submitting, setSubmitting] = useState<"accept" | "decline" | null>(null);
    const [decision, setDecision] = useState<Decision>(null);
    const [message, setMessage] = useState("");
    const [errorStatus, setErrorStatus] = useState<number | null>(null);
    const text = invitationText(locale);

    const errorMessage = useCallback((error: unknown, verificationAttempt = false) => {
        if (!(error instanceof ApiResponseError)) return text.error;
        if (error.status === 403) return text.wrong;
        if (error.status === 400 && verificationAttempt) return text.codeInvalid;
        if (error.status === 410) return text.expired;
        if (error.status === 429) return text.rateLimited;
        return error.message || text.error;
    }, [text]);

    useEffect(() => {
        const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
        const queryToken = searchParams.get("token");
        let storedToken = "";
        try {
            storedToken = window.sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY) || "";
        } catch {
            // Browser storage is optional; the fragment remains available if it is disabled.
        }
        const invitationToken = fragmentToken || queryToken || storedToken;
        if ((fragmentToken || queryToken) && invitationToken) {
            try {
                window.sessionStorage.setItem(INVITATION_TOKEN_STORAGE_KEY, invitationToken);
                window.history.replaceState(null, "", "/accept-company-invitation");
            } catch {
                // Keep the token in the fragment for browsers that block session storage.
            }
        }
        const timeoutId = window.setTimeout(() => {
            setToken(invitationToken);
            setAccessState(invitationToken ? "checking" : "error");
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [searchParams]);

    useEffect(() => {
        if (accessState !== "checking" || !token) return;

        let active = true;
        const loadActivationStatus = async () => {
            try {
                const mode = await CollaborationService.getCompanyInvitationActivationStatus(token);
                if (!active) return;
                if (mode === "create_account") {
                    setAccessState("new-account");
                    return;
                }

                try {
                    const user = await authService.getMe();
                    if (!active) return;
                    if (user.company_id === null) {
                        setInitialFullName(user.full_name || "");
                        setAccessState("existing-no-company");
                        return;
                    }
                    if (user.role?.name !== "admin") {
                        setAccessState("non-admin");
                        return;
                    }
                    await CollaborationService.verifyCompanyInvitationAccess(token);
                    if (!active) return;
                    setAccessState("ready");
                } catch (error) {
                    if (!active) return;
                    if (error instanceof ApiResponseError && error.status === 401) {
                        setAccessState("sign-in");
                    } else if (error instanceof ApiResponseError && error.status === 403) {
                        setAccessState("wrong-account");
                    } else {
                        setErrorStatus(error instanceof ApiResponseError ? error.status : null);
                        setMessage(errorMessage(error));
                        setAccessState("error");
                    }
                }
            } catch (error) {
                if (!active) return;
                setErrorStatus(error instanceof ApiResponseError ? error.status : null);
                setMessage(errorMessage(error));
                setAccessState("error");
            }
        };

        void loadActivationStatus();
        return () => {
            active = false;
        };
    }, [accessState, errorMessage, token]);

    const verifyCode = async (code: string) => {
        const normalizedCode = normalizeInvitationCode(code);
        if (!token || !normalizedCode) {
            toast.error(text.codeRequired);
            throw new Error("Missing verification code");
        }
        try {
            return await CollaborationService.verifyCompanyInvitationCode(token, normalizedCode);
        } catch (error) {
            toast.error(errorMessage(error, true));
            throw error;
        }
    };

    const decline = async (code: string): Promise<void> => {
        const normalizedCode = normalizeInvitationCode(code);
        if (!token || !normalizedCode) {
            toast.error(text.codeRequired);
            return;
        }
        setSubmitting("decline");
        try {
            if (accessState === "ready") {
                await CollaborationService.declineCompanyInvitation(token, normalizedCode);
            } else {
                await CollaborationService.declineCompanyInvitationWithoutAccount(token, normalizedCode);
            }
            clearStoredInvitationToken();
            setDecision("declined");
        } catch (error) {
            toast.error(errorMessage(error, true));
        } finally {
            setSubmitting(null);
        }
    };

    const acceptExistingCompany = async () => {
        const normalizedCode = normalizeInvitationCode(verificationCode);
        if (!token || !normalizedCode) return toast.error(text.codeRequired);
        setSubmitting("accept");
        try {
            await CollaborationService.acceptCompanyInvitation(token, normalizedCode);
            clearStoredInvitationToken();
            setDecision("accepted");
            window.setTimeout(() => router.replace("/dashboard/users?tab=companies"), 1600);
        } catch (error) {
            toast.error(errorMessage(error, true));
        } finally {
            setSubmitting(null);
        }
    };

    const activateCompanyAccount = async (data: CompanyInvitationSignupData) => {
        if (!token) return;
        setSubmitting("accept");
        try {
            if (accessState === "existing-no-company") {
                await CollaborationService.activateCompanyInvitationForExistingAccount({
                    token,
                    verificationCode: data.verificationCode,
                    companyName: data.companyName,
                    taxId: data.taxId,
                    address: data.address,
                    phone: data.phone,
                });
            } else {
                await CollaborationService.activateCompanyInvitation({
                    token,
                    verificationCode: data.verificationCode,
                    fullName: data.fullName,
                    companyName: data.companyName,
                    taxId: data.taxId,
                    address: data.address,
                    phone: data.phone,
                    password: data.password,
                });
            }
            clearStoredInvitationToken();
            setDecision("accepted");
            window.setTimeout(() => router.replace(accessState === "new-account" ? "/login" : "/dashboard/users?tab=companies"), 1600);
        } catch (error) {
            toast.error(errorMessage(error, true));
        } finally {
            setSubmitting(null);
        }
    };

    const signOut = async () => {
        try {
            await authService.logout();
            router.replace("/login?next=%2Faccept-company-invitation");
        } catch {
            toast.error(text.error);
        }
    };

    const isCompanySignup = accessState === "new-account" || accessState === "existing-no-company";

    return (
        <AuthShell contentClassName="my-auto w-full max-w-xl">
            <AuthGlassCard className="billing-surface border-[var(--border-soft)] p-6 sm:p-8">
                <AuthLogo className="mb-6 w-32 sm:w-40" priority />
                {decision ? (
                    <InvitationMessage title={decision === "accepted" ? text.successTitle : text.declinedTitle} message={decision === "accepted" ? text.success : text.declined} success />
                ) : accessState === "reading" || accessState === "checking" ? (
                    <p className="py-10 text-center text-sm text-[var(--text-muted)]">{text.checking}</p>
                ) : !token || accessState === "error" ? (
                    <InvitationMessage title={errorStatus === 429 ? text.rateLimitTitle : errorStatus === 410 ? text.expiredTitle : text.invalidTitle} message={message || text.invalid} />
                ) : accessState === "sign-in" ? (
                    <InvitationAction title={text.existingTitle} message={text.existing} buttonLabel={text.signIn} icon={LogIn} href="/login?next=%2Faccept-company-invitation" />
                ) : accessState === "wrong-account" ? (
                    <InvitationAction title={text.wrongTitle} message={text.wrong} buttonLabel={text.otherAccount} icon={LogOut} onClick={() => void signOut()} />
                ) : accessState === "non-admin" ? (
                    <InvitationAction title={text.nonAdminTitle} message={text.nonAdmin} buttonLabel={text.otherAccount} icon={LogOut} onClick={() => void signOut()} />
                ) : accessState === "ready" ? (
                    <CodeDecisionForm text={text} code={verificationCode} onCodeChange={setVerificationCode} onAccept={() => void acceptExistingCompany()} onDecline={() => void decline(verificationCode)} submitting={submitting} />
                ) : isCompanySignup ? (
                    <CompanyInvitationSignupWizard
                        locale={locale}
                        mode={accessState}
                        initialFullName={initialFullName}
                        submitting={submitting !== null}
                        onVerifyCode={verifyCode}
                        onDecline={decline}
                        onComplete={activateCompanyAccount}
                    />
                ) : null}
            </AuthGlassCard>
        </AuthShell>
    );
}

function invitationText(locale: string) {
    return locale === "es" ? {
        checking: "Comprobando la invitación…",
        invalidTitle: "Invitación no disponible",
        invalid: "Este enlace ya no es válido. Pide a quien te invitó que envíe uno nuevo.",
        expiredTitle: "Invitación caducada",
        expired: "Esta invitación ha caducado. Pide a quien te invitó que envíe una nueva.",
        rateLimitTitle: "Demasiados intentos",
        rateLimited: "Has hecho demasiadas comprobaciones en poco tiempo. Espera unos minutos antes de volver a intentarlo.",
        codeInvalid: "El código de verificación no es correcto. Revisa el correo e inténtalo de nuevo.",
        existingTitle: "Inicia sesión para continuar",
        existing: "Este correo ya tiene una cuenta de WorkHive. Inicia sesión con esa misma cuenta y confirma el código del correo.",
        readyTitle: "Confirma el código del correo",
        ready: "Tu cuenta administradora puede aceptar esta invitación después de verificar el código enviado por correo.",
        wrongTitle: "Usa otra cuenta administradora",
        wrong: "La cuenta actual no es la administradora invitada. Cierra sesión y entra con el correo que recibió la invitación.",
        nonAdminTitle: "Esta cuenta no puede representar a una empresa",
        nonAdmin: "Los gestores y trabajadores son miembros internos. Para aceptar una colaboración, usa el correo de un administrador de la empresa invitada.",
        code: "Código del correo",
        accept: "Aceptar invitación",
        decline: "Rechazar invitación",
        signIn: "Iniciar sesión",
        otherAccount: "Usar otra cuenta",
        successTitle: "Colaboración aceptada",
        success: "La colaboración está activa. Ambas empresas han recibido una confirmación.",
        declinedTitle: "Invitación rechazada",
        declined: "Hemos confirmado la decisión por correo a las dos partes.",
        codeRequired: "Introduce el código de verificación del correo.",
        error: "No se pudo completar la invitación. Revisa el código e inténtalo otra vez.",
    } : {
        checking: "Checking the invitation…",
        invalidTitle: "Invitation unavailable",
        invalid: "This link is no longer valid. Ask the sender to send a new invitation.",
        expiredTitle: "Invitation expired",
        expired: "This invitation has expired. Ask the sender to send a new one.",
        rateLimitTitle: "Too many attempts",
        rateLimited: "Too many checks were made in a short time. Please wait a few minutes before trying again.",
        codeInvalid: "The verification code is incorrect. Check the email and try again.",
        existingTitle: "Sign in to continue",
        existing: "This email already has a WorkHive account. Sign in with that account, then confirm the email code.",
        readyTitle: "Confirm the email code",
        ready: "Your administrator account can accept this invitation after verifying the code sent by email.",
        wrongTitle: "Use another administrator account",
        wrong: "The current account is not the invited administrator. Sign out and use the email that received the invitation.",
        nonAdminTitle: "This account cannot represent a company",
        nonAdmin: "Accountants and workers are internal members. To accept a collaboration, use an administrator email for the invited company.",
        code: "Email code",
        accept: "Accept invitation",
        decline: "Decline invitation",
        signIn: "Sign in",
        otherAccount: "Use another account",
        successTitle: "Collaboration accepted",
        success: "The collaboration is active. Both companies have received a confirmation.",
        declinedTitle: "Invitation declined",
        declined: "We have confirmed this decision to both parties by email.",
        codeRequired: "Enter the verification code from the email.",
        error: "We could not complete the invitation. Check the code and try again.",
    };
}

function CodeDecisionForm({ text, code, onCodeChange, onAccept, onDecline, submitting }: {
    text: ReturnType<typeof invitationText>;
    code: string;
    onCodeChange: (value: string) => void;
    onAccept: () => void;
    onDecline: () => void;
    submitting: string | null;
}) {
    return <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onAccept(); }}><div className="space-y-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><ShieldCheck className="h-5 w-5" /></span><h1 className="text-2xl font-bold text-[var(--text-main)]">{text.readyTitle}</h1><p className="text-sm leading-6 text-[var(--text-muted)]">{text.ready}</p></div><div className="space-y-2"><Label htmlFor="invitation-code">{text.code}</Label><Input id="invitation-code" className="h-12 text-center font-mono text-lg tracking-[0.2em]" value={code} onChange={(event) => onCodeChange(event.target.value.toUpperCase())} autoComplete="one-time-code" required /></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="dangerSoft" disabled={submitting !== null} onClick={onDecline}>{text.decline}</Button><Button type="submit" disabled={submitting !== null || !code.trim()}><ShieldCheck />{text.accept}</Button></div></form>;
}

function InvitationAction({ title, message, buttonLabel, icon: Icon, href, onClick }: { title: string; message: string; buttonLabel: string; icon: typeof LogIn; href?: string; onClick?: () => void }) {
    const button = <Button type="button" className="w-full" onClick={onClick}><Icon />{buttonLabel}</Button>;
    return <div className="space-y-5"><InvitationMessage title={title} message={message} />{href ? <Button asChild className="w-full"><Link href={href}><Icon />{buttonLabel}</Link></Button> : button}</div>;
}

function InvitationMessage({ title, message, success = false }: { title: string; message: string; success?: boolean }) {
    return <div className="space-y-3 py-5 text-center"><CheckCircle2 className={`mx-auto h-10 w-10 ${success ? "text-accent" : "text-[var(--text-muted)]"}`} /><h1 className="text-xl font-bold text-[var(--text-main)]">{title}</h1><p className="text-sm leading-6 text-[var(--text-muted)]">{message}</p></div>;
}

export default function AcceptCompanyInvitationClient({ initialToken }: { initialToken: string }) {
    return <AcceptCompanyInvitationContent initialToken={initialToken} />;
}
