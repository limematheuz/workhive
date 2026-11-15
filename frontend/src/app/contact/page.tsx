"use client";

import { useEffect, useEffectEvent, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDictionary } from "@/lib/dictionary-context";
import {
    getContactValidationMessages,
    type ContactFormState,
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
import { getContactSubmissionErrorMessage } from "@/lib/contact-submission-error";
import { toast } from "sonner";

type ContactFeedback =
    | { kind: "validation"; form: ContactFormState; trial: boolean }
    | { kind: "submission"; cause: unknown }
    | { kind: "verification"; message: string };

function ContactPageContent() {
    const { locale, dict } = useDictionary();
    const searchParams = useSearchParams();
    const reasonParam = searchParams.get("reason");
    // Keep the one-time token after history cleanup updates the search parameters.
    const [trialVerificationToken] = useState(() => searchParams.get("trial_verification"));
    const isTrialRequest = reasonParam === "trial";

    const [form, setForm] = useState(() => getInitialContactForm(reasonParam, locale));
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<ContactFeedback | null>(null);
    const errorMessage = error?.kind === "submission"
        ? getContactSubmissionErrorMessage(error.cause, locale)
        : error?.kind === "validation"
            ? prepareContactSubmission(error.form, error.trial, getContactValidationMessages(locale)).error ?? ""
            : error?.message ?? "";
    const [verified, setVerified] = useState(false);
    const verificationStatus = verified
        ? locale === "es"
            ? "Email verificado. Revisaremos tu solicitud y te avisaremos si el acceso es aprobado."
            : "Email verified. We will review your request and notify you if access is approved."
        : "";
    const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;

    useEffect(() => {
        let active = true;
        queueMicrotask(() => {
            if (!active) return;
            setForm((current) => syncContactFormLocale(current, reasonParam, locale));
        });
        return () => {
            active = false;
        };
    }, [locale, reasonParam]);

    const reportVerified = useEffectEvent(() => {
        setSubmitted(true);
        setVerified(true);
        toast.success(locale === "es" ? "Email verificado" : "Email verified");
    });
    const reportVerificationError = useEffectEvent((verificationError: unknown) => {
        const message = verificationError instanceof Error ? verificationError.message
            : locale === "es" ? "No se pudo verificar la solicitud" : "The request could not be verified";
        setError({ kind: "verification", message });
        toast.error(message);
    });

    useEffect(() => {
        if (!trialVerificationToken) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.delete("trial_verification");
            window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
            TrialRequestService.verify(trialVerificationToken)
                .then(() => { if (!cancelled) reportVerified(); })
                .catch((cause) => { if (!cancelled) reportVerificationError(cause); });
        }, 0);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [trialVerificationToken]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        const prepared = prepareContactSubmission(
            form,
            isTrialRequest,
            getContactValidationMessages(locale),
        );
        if (prepared.error !== null || prepared.submission === null) {
            setError({ kind: "validation", form: { ...form }, trial: isTrialRequest });
            toast.error(prepared.error ?? "");
            return;
        }

        setSubmitting(true);
        setError(null);
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
            const message = getContactSubmissionErrorMessage(submissionError, locale);
            setError({ kind: "submission", cause: submissionError });
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell wide showFooter={false} contentClassName="py-2 sm:py-6 lg:py-8">
            <Link
                href="/"
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
                    error={errorMessage}
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
