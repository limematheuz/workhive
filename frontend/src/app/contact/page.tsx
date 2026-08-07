"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDictionary } from "@/lib/dictionary-context";
import {
    getContactValidationMessages,
    getInitialContactForm,
    prepareContactSubmission,
    syncContactFormLocale,
} from "@/lib/contact-form";
import { AuthShell } from "@/components/auth/AuthShell";
import { ContactFormCard } from "@/components/contact/ContactFormCard";
import { ContactInfoAside } from "@/components/contact/ContactInfoAside";
import { ArrowLeft } from "lucide-react";
import { contactService } from "@/services/contact.service";
import { TrialRequestService } from "@/services/trial-request.service";
import { toast } from "sonner";

function ContactPageContent() {
    const { locale, dict } = useDictionary();
    const searchParams = useSearchParams();
    const reasonParam = searchParams.get("reason");
    const trialVerificationToken = searchParams.get("trial_verification");
    const isTrialRequest = reasonParam === "trial";

    const [form, setForm] = useState(() => getInitialContactForm(reasonParam, locale));
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");
    const [verificationStatus, setVerificationStatus] = useState("");
    const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;

    useEffect(() => {
        setForm((current) => syncContactFormLocale(current, reasonParam, locale));
    }, [locale, reasonParam]);

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
                        : "Email verified. We will review your request and notify you if access is approved.",
                );
                toast.success(locale === "es" ? "Email verificado" : "Email verified");
            })
            .catch((verificationError) => {
                if (cancelled) return;
                const message =
                    verificationError instanceof Error
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
                      : "Message sent successfully",
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
        <AuthShell wide showFooter={false} contentClassName="py-2 sm:py-6 lg:py-8">
            <Link
                href="/login"
                className="group mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] ui-motion sm:mb-6"
            >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                {dict.auth.back_to_login}
            </Link>

            <div className="grid grid-cols-1 items-start gap-5 sm:gap-6 lg:grid-cols-12 lg:gap-8">
                <ContactInfoAside
                    className="order-2 lg:order-1"
                    dict={dict}
                    isTrialRequest={isTrialRequest}
                    supportPhone={supportPhone}
                />
                <ContactFormCard
                    className="order-1 lg:order-2"
                    dict={dict}
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
        </AuthShell>
    );
}

export default function ContactPage() {
    const { dict } = useDictionary();
    return (
        <Suspense
            fallback={
                <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
                    {dict.auth.loading}
                </div>
            }
        >
            <ContactPageContent />
        </Suspense>
    );
}
