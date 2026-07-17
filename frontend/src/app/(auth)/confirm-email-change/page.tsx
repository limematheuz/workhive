"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, MailCheck } from "lucide-react";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { BrandIconWell } from "@/components/ui/brand-icon-well";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { useThemeMode } from "@/lib/theme";
import { authService } from "@/services/auth.service";


const subscribeToBrowserState = () => () => undefined;
const readEmailChangeToken = () => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    return hashParams.get("token") || "";
};
const readEmptyToken = () => "";
const readBrowserReady = () => true;
const readServerReady = () => false;


function ConfirmEmailChangeContent() {
    const token = useSyncExternalStore(
        subscribeToBrowserState,
        readEmailChangeToken,
        readEmptyToken,
    );
    const tokenLoaded = useSyncExternalStore(
        subscribeToBrowserState,
        readBrowserReady,
        readServerReady,
    );
    const [submitting, setSubmitting] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState("");
    const [theme, setTheme] = useThemeMode();
    const { locale } = useDictionary();
    const isSpanish = locale === "es";

    const confirmChange = async () => {
        if (!token || submitting) return;
        setSubmitting(true);
        setError("");
        try {
            await authService.confirmEmailChange(token);
            const url = new URL(window.location.href);
            window.history.replaceState(
                window.history.state,
                "",
                `${url.pathname}${url.search}`,
            );
            setConfirmed(true);
        } catch (confirmationError: unknown) {
            setError(
                getErrorMessage(
                    confirmationError,
                    isSpanish
                        ? "No se pudo confirmar el cambio de correo."
                        : "The email change could not be confirmed.",
                ),
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="relative flex min-h-dvh w-full flex-col items-center overflow-x-hidden bg-[var(--bg-primary)] px-4 pb-6 pt-24 text-[var(--text-main)] sm:pt-20 md:p-8">
            <AuthTopControls showThemeToggle theme={theme} onThemeChange={setTheme} />
            <div className="relative z-10 my-auto flex w-full max-w-md flex-col justify-center">
                <div className="mb-6 flex justify-center">
                    <AuthLogo className="w-32 sm:w-40" priority />
                </div>
                <section className="relative rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] backdrop-blur-xl sm:p-8">
                    {confirmed ? (
                        <div className="space-y-4 py-4 text-center">
                            <div className="inline-flex rounded-full bg-emerald-500/10 p-4 text-emerald-500">
                                <CheckCircle2 className="h-11 w-11" />
                            </div>
                            <h1 className="text-2xl font-black">
                                {isSpanish ? "Correo actualizado" : "Email updated"}
                            </h1>
                            <p className="text-sm leading-6 text-[var(--text-muted)]">
                                {isSpanish
                                    ? "Todas las sesiones anteriores se han cerrado. Inicia sesión con tu correo nuevo."
                                    : "All previous sessions have been closed. Sign in with your new email."}
                            </p>
                            <Link href="/login" className="inline-flex w-full justify-center rounded-xl bg-[var(--text-main)] py-3 text-sm font-semibold text-[var(--text-inverse)] hover:opacity-90">
                                {isSpanish ? "Ir a iniciar sesión" : "Go to sign in"}
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <div className="mb-4">
                                    <BrandIconWell icon={MailCheck} size="lg" iconClassName="h-6 w-6" />
                                </div>
                                <h1 className="text-2xl font-black">
                                    {isSpanish ? "Confirmar nuevo correo" : "Confirm new email"}
                                </h1>
                                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                                    {isSpanish
                                        ? "Confirma que esta dirección te pertenece. Después tendrás que iniciar sesión de nuevo."
                                        : "Confirm that you own this address. You will need to sign in again afterwards."}
                                </p>
                            </div>

                            {((tokenLoaded && !token) || error) && (
                                <div className="flex gap-3 border-l-2 border-red-500 bg-red-500/5 px-4 py-3 text-sm">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                                    <p className="text-[var(--text-muted)]">
                                        {error || (isSpanish
                                            ? "El enlace no contiene un token válido. Solicita un cambio nuevo desde tu perfil."
                                            : "The link does not contain a valid token. Request a new change from your profile.")}
                                    </p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={confirmChange}
                                disabled={!token || submitting}
                                className="w-full cursor-pointer rounded-xl border-none bg-[var(--text-main)] py-3 text-sm font-semibold text-[var(--text-inverse)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {submitting
                                    ? (isSpanish ? "Confirmando..." : "Confirming...")
                                    : (isSpanish ? "Confirmar correo" : "Confirm email")}
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}


export default function ConfirmEmailChangePage() {
    return <ConfirmEmailChangeContent />;
}
