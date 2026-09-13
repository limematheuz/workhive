"use client";

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LogIn, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiResponseError } from "@/lib/api";
import { resolveInvitationToken } from "@/lib/invitation-token";
import { ClientPortalService } from "@/services/client-portal.service";

export default function AcceptClientPortalInvitationClient() {
    const searchParams = useSearchParams();
    const tokenRead = useRef(false);
    const [token, setToken] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [fullName, setFullName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [acceptedLegal, setAcceptedLegal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [complete, setComplete] = useState(false);

    useEffect(() => {
        if (tokenRead.current) return;
        tokenRead.current = true;
        const invitation = resolveInvitationToken({ hash: window.location.hash, queryToken: searchParams.get("token") });
        setToken(invitation.token);
        if (invitation.shouldClearUrl) window.history.replaceState(null, "", "/accept-client-portal-invitation");
    }, [searchParams]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!token || submitting) return;
        if (password && password !== confirmPassword) {
            toast.error("Las contraseñas no coinciden.");
            return;
        }
        if (!acceptedLegal) {
            toast.error("Debes aceptar los términos y la política de privacidad.");
            return;
        }
        try {
            setSubmitting(true);
            await ClientPortalService.acceptInvitation({
                token,
                verification_code: verificationCode.trim().toUpperCase(),
                full_name: fullName.trim(),
                ...(password ? { password } : {}),
                accept_terms: true,
                accept_privacy: true,
                marketing_consent: false,
            });
            setComplete(true);
        } catch (error) {
            if (error instanceof ApiResponseError && error.status === 410) toast.error("Esta invitación ha caducado. Pide una nueva a la empresa que te invitó.");
            else toast.error(error instanceof Error ? error.message : "No se pudo activar el portal de cliente.");
        } finally {
            setSubmitting(false);
        }
    };

    return <AuthShell contentClassName="my-auto w-full max-w-xl"><AuthGlassCard className="billing-surface border-[var(--border-soft)] p-6 sm:p-8"><AuthLogo className="mb-6 w-32 sm:w-40" priority />
        {!token ? <Message title="Invitación no disponible" description="Este enlace ya no es válido. Pide a la empresa que te invitó que envíe una nueva invitación." /> : complete ? <Message title="Portal activado" description="Tu acceso documental está listo. Inicia sesión para ver los presupuestos, contratos y facturas de tu empresa." success action={<Button asChild className="mt-4"><Link href="/login"><LogIn />Iniciar sesión</Link></Button>} /> : <form className="space-y-6" onSubmit={(event) => void submit(event)}><header className="space-y-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Portal de cliente</p><h1 className="text-2xl font-bold text-[var(--text-main)]">Activa tu acceso documental</h1><p className="text-sm leading-6 text-[var(--text-muted)]">Podrás consultar los presupuestos enviados, contratos y facturas de la empresa que te ha invitado. No tendrás acceso a su espacio de trabajo.</p></header><div className="space-y-4"><Field id="client-portal-code" label="Código del correo" value={verificationCode} onChange={setVerificationCode} className="font-mono uppercase tracking-[0.18em]" required /><Field id="client-portal-name" label="Tu nombre completo" value={fullName} onChange={setFullName} autoComplete="name" required /><Field id="client-portal-password" label="Contraseña (necesaria si es tu primer acceso)" value={password} onChange={setPassword} type="password" autoComplete="new-password" /><Field id="client-portal-password-confirm" label="Repite la contraseña" value={confirmPassword} onChange={setConfirmPassword} type="password" autoComplete="new-password" disabled={!password} /></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 p-3 text-sm text-[var(--text-muted)]"><input type="checkbox" checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" /><span>Acepto los términos de servicio y la política de privacidad para activar este acceso.</span></label><Button type="submit" className="w-full" disabled={submitting}><ShieldCheck />{submitting ? "Activando acceso…" : "Activar portal"}</Button><p className="text-center text-xs text-[var(--text-muted)]">¿Ya tienes una cuenta? <Link className="font-semibold text-accent hover:underline" href="/login">Inicia sesión</Link></p></form>}</AuthGlassCard></AuthShell>;
}

function Field({ id, label, value, onChange, type = "text", required = false, disabled = false, autoComplete, className }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; disabled?: boolean; autoComplete?: string; className?: string }) {
    return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} autoComplete={autoComplete} className={className} /></div>;
}

function Message({ title, description, success = false, action }: { title: string; description: string; success?: boolean; action?: ReactNode }) {
    const Icon = success ? CheckCircle2 : ShieldCheck;
    return <div className="py-8 text-center"><Icon className="mx-auto size-10 text-accent" /><h1 className="mt-4 text-xl font-bold text-[var(--text-main)]">{title}</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">{description}</p>{action}</div>;
}
