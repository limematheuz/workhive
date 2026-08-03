"use client";

import { CheckCircle2, Send } from "lucide-react";
import type { ContactFormState } from "@/lib/contact-form";

const fieldClassName =
    "w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl px-4 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent/50 focus:bg-[var(--bg-secondary)] ui-motion";

type ContactFormCardProps = {
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
    return (
        <div className="lg:col-span-7">
            <div className="relative min-w-0 overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 shadow-2xl backdrop-blur-xl sm:p-6 lg:p-8">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--border-soft)] to-transparent" />

                {submitted ? (
                    <div className="text-center py-12 space-y-4">
                        <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        <h2 className="text-2xl font-black">
                            {locale === "es" ? "Mensaje enviado" : "Message sent"}
                        </h2>
                        <p className="text-[var(--text-muted)] max-w-md mx-auto">
                            {verificationStatus ||
                                (isTrialRequest
                                    ? locale === "es"
                                        ? "Te hemos enviado un enlace para verificar tu email. Después revisaremos manualmente tu acceso."
                                        : "We have sent you an email verification link. After that, we will manually review your access."
                                    : locale === "es"
                                        ? "Hemos recibido tu mensaje correctamente."
                                        : "We have received your message successfully.")}
                        </p>
                        <button
                            type="button"
                            onClick={onResetSubmitted}
                            className="mt-6 px-6 py-2.5 rounded-xl text-xs font-bold bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)] hover:bg-[var(--btn-secondary-hover-bg)]"
                        >
                            {locale === "es" ? "Enviar otro mensaje" : "Send another message"}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-6">
                        <h2 className="text-2xl font-black">
                            {isTrialRequest
                                ? locale === "es"
                                    ? "Solicitar acceso a WorkHive"
                                    : "Request WorkHive access"
                                : locale === "es"
                                    ? "Escríbenos directamente"
                                    : "Write to us directly"}
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="contact-name" className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">
                                    {locale === "es" ? "Nombre completo" : "Full Name"}
                                </label>
                                <input
                                    id="contact-name"
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className={fieldClassName}
                                    placeholder={locale === "es" ? "Tu nombre" : "Your name"}
                                />
                            </div>
                            <div>
                                <label htmlFor="contact-email" className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">
                                    {locale === "es" ? "Email de contacto" : "Contact Email"}
                                </label>
                                <input
                                    id="contact-email"
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className={fieldClassName}
                                    placeholder="tu@email.com"
                                />
                            </div>
                            {isTrialRequest && (
                                <div>
                                    <label htmlFor="contact-company" className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">
                                        {locale === "es" ? "Empresa" : "Company"}
                                    </label>
                                    <input
                                        id="contact-company"
                                        type="text"
                                        required
                                        value={form.company_name}
                                        onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                                        className={fieldClassName}
                                        placeholder={locale === "es" ? "Nombre de empresa" : "Company name"}
                                    />
                                </div>
                            )}
                            {isTrialRequest && (
                                <div>
                                    <label htmlFor="contact-phone" className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">
                                        {locale === "es" ? "Teléfono" : "Phone"}
                                    </label>
                                    <input
                                        id="contact-phone"
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className={fieldClassName}
                                        placeholder={locale === "es" ? "Teléfono de contacto" : "Contact phone"}
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="contact-subject" className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">
                                {locale === "es" ? "Asunto" : "Subject"}
                            </label>
                            <input
                                id="contact-subject"
                                type="text"
                                required
                                value={form.subject}
                                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                className={fieldClassName}
                                placeholder={locale === "es" ? "Duda sobre planes, soporte, etc." : "Pricing plans query, support, etc."}
                            />
                        </div>

                        <div>
                            <label htmlFor="contact-message" className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">
                                {locale === "es" ? "Mensaje" : "Message"}
                            </label>
                            <textarea
                                id="contact-message"
                                required
                                rows={4}
                                value={form.message}
                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                className={`${fieldClassName} resize-none`}
                                placeholder={locale === "es" ? "Explícanos en qué podemos ayudarte..." : "Let us know how we can help..."}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full flex items-center justify-center gap-2 bg-[var(--text-main)] text-[var(--bg-primary)] hover:opacity-90 font-bold rounded-xl py-3.5 ui-motion shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)] cursor-pointer"
                        >
                            <Send className="w-4 h-4" />
                            {submitting
                                ? (locale === "es" ? "Enviando..." : "Sending...")
                                : (locale === "es" ? "Enviar Mensaje" : "Send Message")}
                        </button>
                        {error && (
                            <p role="alert" className="text-sm font-semibold text-red-500">
                                {error}
                            </p>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
