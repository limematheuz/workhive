"use client";

import { CheckCircle2, Send } from "lucide-react";
import type { ContactFormState } from "@/lib/contact-form";
import type { Dictionary } from "@/lib/dictionary-context";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS, authAlertClass } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";

type ContactFormCardProps = {
    dict: Dictionary;
    locale: string;
    isTrialRequest: boolean;
    form: ContactFormState;
    setForm: (next: ContactFormState) => void;
    submitting: boolean;
    submitted: boolean;
    error: string;
    verificationStatus: string;
    onSubmit: (event: React.FormEvent) => void;
    onResetSubmitted: () => void;
};

export function ContactFormCard({
    dict,
    locale,
    isTrialRequest,
    form,
    setForm,
    submitting,
    submitted,
    error,
    verificationStatus,
    onSubmit,
    onResetSubmitted,
}: ContactFormCardProps) {
    const t = dict.auth;
    const es = locale === "es";

    return (
        <div className="lg:col-span-7">
            <AuthGlassCard className="border-accent/20 shadow-[0_24px_60px_color-mix(in_srgb,var(--accent-color)_16%,transparent)]">
                {submitted ? (
                    <div className="space-y-4 py-10 text-center">
                        <div className="mb-2 inline-flex rounded-full bg-emerald-500/10 p-4 text-emerald-500">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">{t.contact_sent_title}</h2>
                        <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
                            {verificationStatus ||
                                (isTrialRequest
                                    ? es
                                        ? "Te hemos enviado un enlace para verificar tu email. Después revisaremos manualmente tu acceso."
                                        : "We have sent you an email verification link. After that, we will manually review your access."
                                    : es
                                      ? "Hemos recibido tu mensaje correctamente."
                                      : "We have received your message successfully.")}
                        </p>
                        <Button type="button" variant="secondary" size="lg" className="mt-4" onClick={onResetSubmitted}>
                            {t.contact_sent_again}
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                                {isTrialRequest ? t.contact_trial_title : t.contact_title}
                            </p>
                            <h2 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">
                                {isTrialRequest ? t.contact_form_title_trial : t.contact_form_title}
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="contact-name" className={AUTH_LABEL_CLASS}>
                                    {es ? "Nombre completo" : "Full name"}
                                </label>
                                <input
                                    id="contact-name"
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className={AUTH_FIELD_CLASS}
                                    placeholder={es ? "Tu nombre" : "Your name"}
                                />
                            </div>
                            <div>
                                <label htmlFor="contact-email" className={AUTH_LABEL_CLASS}>
                                    {es ? "Email de contacto" : "Contact email"}
                                </label>
                                <input
                                    id="contact-email"
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className={AUTH_FIELD_CLASS}
                                    placeholder="you@company.com"
                                />
                            </div>
                            {isTrialRequest && (
                                <div>
                                    <label htmlFor="contact-company" className={AUTH_LABEL_CLASS}>
                                        {es ? "Empresa" : "Company"}
                                    </label>
                                    <input
                                        id="contact-company"
                                        type="text"
                                        required
                                        value={form.company_name}
                                        onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                                        className={AUTH_FIELD_CLASS}
                                        placeholder={es ? "Nombre de empresa" : "Company name"}
                                    />
                                </div>
                            )}
                            {isTrialRequest && (
                                <div>
                                    <label htmlFor="contact-phone" className={AUTH_LABEL_CLASS}>
                                        {es ? "Teléfono" : "Phone"}
                                    </label>
                                    <input
                                        id="contact-phone"
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className={AUTH_FIELD_CLASS}
                                        placeholder={es ? "Opcional" : "Optional"}
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="contact-subject" className={AUTH_LABEL_CLASS}>
                                {es ? "Asunto" : "Subject"}
                            </label>
                            <input
                                id="contact-subject"
                                type="text"
                                required
                                value={form.subject}
                                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                className={AUTH_FIELD_CLASS}
                                placeholder={es ? "Evaluación, planes, soporte…" : "Evaluation, plans, support…"}
                            />
                        </div>

                        <div>
                            <label htmlFor="contact-message" className={AUTH_LABEL_CLASS}>
                                {es ? "Mensaje" : "Message"}
                            </label>
                            <textarea
                                id="contact-message"
                                required
                                rows={6}
                                value={form.message}
                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                className={`${AUTH_FIELD_CLASS} min-h-[9.5rem] resize-y overflow-auto`}
                                placeholder={
                                    es
                                        ? "Cuántos operarios tenéis, qué tipo de servicios y qué necesitáis cubrir…"
                                        : "How many workers you have, what services you run, and what you need to cover…"
                                }
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={submitting}
                            size="lg"
                            className="w-full bg-accent text-white hover:bg-accent-light border-accent shadow-lg shadow-accent/20"
                        >
                            <Send className="h-4 w-4" />
                            {submitting ? t.contact_sending : t.contact_send}
                        </Button>
                        {error && <p role="alert" className={authAlertClass("error")}>{error}</p>}
                    </form>
                )}
            </AuthGlassCard>
        </div>
    );
}
