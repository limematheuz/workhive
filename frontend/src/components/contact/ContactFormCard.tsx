"use client";

import { CheckCircle2, Send } from "lucide-react";
import type { ContactFormState } from "@/lib/contact-form";
import type { Dictionary } from "@/lib/dictionary-context";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS, authAlertClass } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
    className?: string;
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
    className,
}: ContactFormCardProps) {
    const t = dict.auth;
    const es = locale === "es";

    return (
        <div className={cn("min-w-0 lg:col-span-7", className)}>
            <AuthGlassCard className="billing-surface border-[var(--border-soft)] p-5 sm:p-6">
                {submitted ? (
                    <div className="space-y-3 py-8 text-center sm:py-10">
                        <div className="mb-1 inline-flex rounded-2xl border border-accent/25 bg-accent/10 p-3.5 text-accent">
                            <CheckCircle2 className="h-9 w-9" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t.contact_sent_title}</h2>
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
                        <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            className="mt-2 h-12 w-full rounded-2xl sm:w-auto"
                            onClick={onResetSubmitted}
                        >
                            {t.contact_sent_again}
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-4" noValidate>
                        <div className="space-y-1.5">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                                {isTrialRequest ? t.contact_trial_title : t.contact_title}
                            </p>
                            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                                {isTrialRequest ? t.contact_form_title_trial : t.contact_form_title}
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
                            <div className="min-w-0 space-y-2">
                                <Label htmlFor="contact-name" className={AUTH_LABEL_CLASS}>
                                    {es ? "Nombre completo" : "Full name"}
                                </Label>
                                <Input
                                    id="contact-name"
                                    type="text"
                                    name="name"
                                    autoComplete="name"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className={`${AUTH_FIELD_CLASS} h-12 rounded-2xl`}
                                    placeholder={es ? "Tu nombre" : "Your name"}
                                />
                            </div>
                            <div className="min-w-0 space-y-2">
                                <Label htmlFor="contact-email" className={AUTH_LABEL_CLASS}>
                                    {es ? "Email de contacto" : "Contact email"}
                                </Label>
                                <Input
                                    id="contact-email"
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    inputMode="email"
                                    required
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className={`${AUTH_FIELD_CLASS} h-12 rounded-2xl`}
                                    placeholder="you@company.com"
                                />
                            </div>
                            {isTrialRequest && (
                                <div className="min-w-0 space-y-2">
                                    <Label htmlFor="contact-company" className={AUTH_LABEL_CLASS}>
                                        {es ? "Empresa" : "Company"}
                                    </Label>
                                    <Input
                                        id="contact-company"
                                        type="text"
                                        name="company"
                                        autoComplete="organization"
                                        required
                                        value={form.company_name}
                                        onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                                        className={`${AUTH_FIELD_CLASS} h-12 rounded-2xl`}
                                        placeholder={es ? "Nombre de empresa" : "Company name"}
                                    />
                                </div>
                            )}
                            {isTrialRequest && (
                                <div className="min-w-0 space-y-2">
                                    <Label htmlFor="contact-phone" className={AUTH_LABEL_CLASS}>
                                        {es ? "Teléfono" : "Phone"}
                                    </Label>
                                    <Input
                                        id="contact-phone"
                                        type="tel"
                                        name="phone"
                                        autoComplete="tel"
                                        inputMode="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className={`${AUTH_FIELD_CLASS} h-12 rounded-2xl`}
                                        placeholder={es ? "Opcional" : "Optional"}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="contact-subject" className={AUTH_LABEL_CLASS}>
                                {es ? "Asunto" : "Subject"}
                            </Label>
                            <Input
                                id="contact-subject"
                                type="text"
                                name="subject"
                                required
                                value={form.subject}
                                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                className={`${AUTH_FIELD_CLASS} h-12 rounded-2xl`}
                                placeholder={es ? "Evaluación, planes, soporte…" : "Evaluation, plans, support…"}
                            />
                        </div>

                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="contact-message" className={AUTH_LABEL_CLASS}>
                                {es ? "Mensaje" : "Message"}
                            </Label>
                            <Textarea
                                id="contact-message"
                                name="message"
                                required
                                rows={5}
                                value={form.message}
                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                className={`${AUTH_FIELD_CLASS} min-h-[8.5rem] resize-y overflow-auto rounded-2xl`}
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
                            className="h-12 w-full rounded-2xl"
                        >
                            <Send className="h-4 w-4" />
                            {submitting ? t.contact_sending : t.contact_send}
                        </Button>
                        {error && (
                            <p role="alert" className={authAlertClass("error")}>
                                {error}
                            </p>
                        )}
                    </form>
                )}
            </AuthGlassCard>
        </div>
    );
}
