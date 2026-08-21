"use client";

import Link from "next/link";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { useThemeMode } from "@/lib/theme";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
    const { locale } = useDictionary();
    const [theme, setTheme] = useThemeMode();

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[var(--bg-primary)] text-[var(--text-main)] transition-colors duration-300">
            <AuthTopControls theme={theme} onThemeChange={setTheme} />

            <div className="w-full max-w-4xl z-10 py-12">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    {locale === "es" ? "Volver a WorkHive" : "Back to WorkHive"}
                </Link>

                <div className="backdrop-blur-xl bg-[var(--bg-card)] border border-[var(--border-soft)] shadow-2xl rounded-3xl p-8 lg:p-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--border-soft)] to-transparent" />

                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-accent/10 text-accent rounded-2xl">
                            <ShieldCheck className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
                                {locale === "es" ? "Política de Privacidad" : "Privacy Policy"}
                            </h1>
                            <p className="text-[var(--text-muted)] text-sm mt-1">
                                {locale === "es" ? "Última actualización · 21 de agosto de 2026" : "Last updated · August 21, 2026"}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-8 text-sm leading-relaxed text-[var(--text-muted)]">
                        {locale === "es" ? (
                            <>
                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        1. Recopilación de Datos Personales
                                    </h2>
                                    <p>
                                        WorkHive recopila datos exclusivamente para la prestación del servicio ERP/CRM. Entre ellos se incluyen: Nombre, correo electrónico, datos fiscales de la empresa emisora y receptora, ubicación física de las instalaciones del cliente y registros de horarios (fichajes) de los trabajadores.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        2. Finalidad del Tratamiento de los Datos
                                    </h2>
                                    <p>
                                        Tratamos los datos recopilados para:
                                    </p>
                                    <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                                        <li>Procesar fichajes y controlar las horas trabajadas por los operarios.</li>
                                        <li>Gestionar y planificar tareas en las instalaciones correspondientes.</li>
                                        <li>Generar facturas legales desglosadas por cliente y enviarlas por vía electrónica.</li>
                                        <li>Gestionar las colaboraciones comerciales y solicitudes de servicio entre diferentes empresas.</li>
                                    </ul>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        3. Datos de Google Calendar
                                    </h2>
                                    <p>
                                        La conexión con Google Calendar es opcional y requiere el consentimiento explícito de un administrador. WorkHive accede al correo de la Cuenta de Google conectada y a los calendarios y eventos necesarios para crear y mantener un calendario dedicado de WorkHive y sincronizar las tareas o reservas que el usuario seleccione.
                                    </p>
                                    <p>
                                        Los tokens de acceso se almacenan cifrados y se utilizan únicamente para prestar esta sincronización. WorkHive no vende datos de Google, no los utiliza para publicidad y no los comparte con terceros salvo los proveedores de infraestructura necesarios para operar el servicio o cuando exista una obligación legal. El administrador puede desconectar Google Calendar desde WorkHive o revocar el acceso desde su Cuenta de Google.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        4. Seguridad y Cifrado de Datos
                                    </h2>
                                    <p>
                                        Las contraseñas se almacenan mediante hashes irreversibles. Las comunicaciones de producción usan HTTPS y la infraestructura aplica copias de seguridad y controles de acceso. WorkHive limita el acceso a la información por empresa y rol.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        5. Derechos del Usuario (RGPD)
                                    </h2>
                                    <p>
                                        Como titular de los datos, puede solicitar acceso, rectificación, supresión, limitación, portabilidad u oposición escribiendo a cloud-admin@workhive.es. También puede solicitar la eliminación de su cuenta y de los datos asociados, sujetos a las obligaciones legales de conservación aplicables.
                                    </p>
                                </section>
                            </>
                        ) : (
                            <>
                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        1. Personal Data Collection
                                    </h2>
                                    <p>
                                        WorkHive collects data solely for providing our ERP/CRM services. This includes: Name, email address, tax details of both issuing and recipient companies, physical address of client installations, and worker shift clock-in logs.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        2. Purpose of Data Processing
                                    </h2>
                                    <p>
                                        We process collected data to:
                                    </p>
                                    <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                                        <li>Process work sessions and manage clock-in hours for field staff.</li>
                                        <li>Assign and track cleaning and operational tasks at selected facilities.</li>
                                        <li>Generate legal invoices itemized per client and distribute them electronically.</li>
                                        <li>Manage business collaborations and external service requests between partners.</li>
                                    </ul>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        3. Google Calendar Data
                                    </h2>
                                    <p>
                                        Google Calendar connection is optional and requires explicit administrator consent. WorkHive accesses the connected Google Account email and the calendars and events required to create and maintain a dedicated WorkHive calendar and synchronize tasks or reservations selected by the user.
                                    </p>
                                    <p>
                                        Access tokens are stored encrypted and used only to provide this synchronization. WorkHive does not sell Google data, use it for advertising, or share it with third parties except infrastructure providers required to operate the service or where legally required. Administrators can disconnect Google Calendar in WorkHive or revoke access from their Google Account.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        4. Data Security & Encryption
                                    </h2>
                                    <p>
                                        Passwords are stored as irreversible hashes. Production traffic uses HTTPS, and the infrastructure applies backups and access controls. WorkHive restricts access to information by company and role.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        5. User Rights (GDPR)
                                    </h2>
                                    <p>
                                        Under GDPR you may request access, rectification, erasure, restriction, portability or objection by emailing cloud-admin@workhive.es. You may also request deletion of your account and associated data, subject to applicable legal retention obligations.
                                    </p>
                                </section>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
