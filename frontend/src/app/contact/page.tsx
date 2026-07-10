"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDictionary } from "@/lib/dictionary-context";
import {
    getContactValidationMessages,
    getInitialContactForm,
    prepareContactSubmission,
} from "@/lib/contact-form";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { ContactFormCard } from "@/components/contact/ContactFormCard";
import { ContactInfoAside } from "@/components/contact/ContactInfoAside";
import { useThemeMode } from "@/lib/theme";
import { ArrowLeft } from "lucide-react";
import { contactService } from "@/services/contact.service";
import { TrialRequestService } from "@/services/trial-request.service";
import { toast } from "sonner";

function ContactPageContent() {
    const { locale } = useDictionary();
    const [theme, setTheme] = useThemeMode();
    const searchParams = useSearchParams();
    const reasonParam = searchParams.get("reason");
    const trialVerificationToken = searchParams.get("trial_verification");
    const isTrialRequest = reasonParam === "trial";

    const [form, setForm] = useState(() => getInitialContactForm(reasonParam, locale));
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");
    const [verificationStatus, setVerificationStatus] = useState("");
    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
    const businessLocation = process.env.NEXT_PUBLIC_BUSINESS_LOCATION;

    useEffect(() => {
        if (!trialVerificationToken) return;
        let cancelled = false;
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("trial_verification");
            window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        }
        TrialRequestService.verify(trialVerificationToken)
            .then(() => {
                if (cancelled) return;
                setSubmitted(true);
                setVerificationStatus(
                    locale === "es"
                        ? "Email verificado. Revisaremos tu solicitud y te avisaremos si el acceso es aprobado."
                        : "Email verified. We will review your request and notify you if access is approved."
                );
                toast.success(locale === "es" ? "Email verificado" : "Email verified");
            })
            .catch((verificationError) => {
                if (cancelled) return;
                const message = verificationError instanceof Error
                    ? verificationError.message
                    : locale === "es"
                        ? "No se pudo verificar la solicitud"
                        : "The request could not be verified";
                setError(message);
                toast.error(message);
            });
        return () => {
            cancelled = true;
        };
    }, [locale, trialVerificationToken]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        const prepared = prepareContactSubmission(
            form,
            isTrialRequest,
            getContactValidationMessages(locale),
        );
        if (prepared.error !== null || prepared.submission === null) {
            setError(prepared.error ?? "");
            toast.error(prepared.error ?? "");
            return;
        }

        setSubmitting(true);
        setError("");
        try {
            if (prepared.submission.kind === "trial") {
                await TrialRequestService.create(prepared.submission.payload);
            } else {
                await contactService.send(prepared.submission.payload);
            }
            setSubmitted(true);
            toast.success(
                isTrialRequest
                    ? locale === "es"
                        ? "Solicitud enviada. Revisa tu email para verificarla."
                        : "Request sent. Check your email to verify it."
                    : locale === "es"
                        ? "Mensaje enviado correctamente"
                        : "Message sent successfully"
            );
        } catch (submissionError) {
            const message =
                submissionError instanceof Error
                    ? submissionError.message
                    : locale === "es"
                      ? "No se pudo enviar el mensaje"
                      : "The message could not be sent";
            setError(message);
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="relative flex min-h-dvh w-full min-w-0 flex-col items-center overflow-x-hidden bg-[var(--bg-primary)] px-4 pb-8 pt-24 text-[var(--text-main)] transition-colors duration-300 sm:pt-20">
            <AuthTopControls theme={theme} onThemeChange={setTheme} />

            <div className="z-10 w-full min-w-0 max-w-5xl py-4 sm:py-8 lg:py-12">
                <Link
                    href="/login"
                    className="group mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)] sm:mb-8"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    {locale === "es" ? "Volver al inicio" : "Back to login"}
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <ContactInfoAside
                        locale={locale}
                        supportEmail={supportEmail}
                        supportPhone={supportPhone}
                        businessLocation={businessLocation}
                    />
                    <ContactFormCard
                        locale={locale}
                        isTrialRequest={isTrialRequest}
                        form={form}
                        setForm={setForm}
                        submitting={submitting}
                        submitted={submitted}
                        error={error}
                        verificationStatus={verificationStatus}
                        onSubmit={handleSubmit}
                        onResetSubmitted={() => setSubmitted(false)}
                    />
                </div>
            </div>
        </main>
    );
}

export default function ContactPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">Cargando...</div>}>
            <ContactPageContent />
        </Suspense>
    );
}
