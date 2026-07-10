"use client";

import { Mail, Phone, MapPin } from "lucide-react";

type ContactInfoAsideProps = {
    locale: string;
    supportEmail?: string;
    supportPhone?: string;
    businessLocation?: string;
};

export function ContactInfoAside({
    locale,
    supportEmail,
    supportPhone,
    businessLocation,
}: ContactInfoAsideProps) {
    return (
        <div className="lg:col-span-5 space-y-6">
            <div>
                <h1 className="mb-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                    {locale === "es" ? "Contacto & Soporte" : "Contact & Support"}
                </h1>
                <p className="text-[var(--text-muted)] text-base">
                    {locale === "es"
                        ? "¿Tienes alguna duda sobre los planes de suscripción o la facturación? Estamos aquí para ayudarte."
                        : "Do you have any questions about subscription plans or invoicing? We are here to help."}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="p-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] backdrop-blur-md flex gap-4">
                    <div className="p-3 bg-accent/10 text-accent rounded-xl h-fit">
                        <Mail className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-[var(--text-muted)] uppercase tracking-wider">Email</h3>
                        <p className="text-[var(--text-main)] font-semibold mt-1">
                            {supportEmail ||
                                (locale === "es"
                                    ? "Disponible mediante el formulario"
                                    : "Available through the form")}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {locale === "es" ? "Canal de soporte y contratación" : "Support and onboarding channel"}
                        </p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] backdrop-blur-md flex gap-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl h-fit">
                        <Phone className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-[var(--text-muted)] uppercase tracking-wider">
                            {locale === "es" ? "Teléfono" : "Phone"}
                        </h3>
                        <p className="text-[var(--text-main)] font-semibold mt-1">
                            {supportPhone ||
                                (locale === "es"
                                    ? "Pendiente de publicar"
                                    : "Not published yet")}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {locale === "es" ? "Lunes a Viernes 9:00 - 18:00" : "Monday to Friday 9am - 6pm"}
                        </p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] backdrop-blur-md flex gap-4">
                    <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl h-fit">
                        <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-[var(--text-muted)] uppercase tracking-wider">
                            {locale === "es" ? "Oficina Central" : "Headquarters"}
                        </h3>
                        <p className="text-[var(--text-main)] font-semibold mt-1">
                            {businessLocation ||
                                (locale === "es"
                                    ? "Pendiente de publicar"
                                    : "Not published yet")}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
