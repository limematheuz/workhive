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
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    {locale === "es" ? "Volver al inicio" : "Back to login"}
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
                                {locale === "es" ? "Borrador pre-lanzamiento · 14 de junio de 2026" : "Pre-launch draft · June 14, 2026"}
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
                                        3. Seguridad y Cifrado de Datos
                                    </h2>
                                    <p>
                                        Las contraseñas se almacenan mediante hashes irreversibles. En producción, las comunicaciones deberán realizarse exclusivamente mediante HTTPS y la base de datos deberá contar con cifrado, copias de seguridad y controles de acceso del proveedor de infraestructura. WorkHive aplica controles de acceso por empresa y rol, sujetos a revisión continua antes del lanzamiento comercial.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        4. Derechos del Usuario (ARCO - RGPD)
                                    </h2>
                                    <p>
                                        Como titular de los datos, puede solicitar acceso, rectificación, supresión, limitación, portabilidad u oposición escribiendo a privacy@workhive.com. Antes del lanzamiento comercial deberán publicarse la identidad fiscal y dirección completa del responsable del tratamiento, los encargados, plazos de conservación y base jurídica aplicable.
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
                                        3. Data Security & Encryption
                                    </h2>
                                    <p>
                                        Passwords are stored as irreversible hashes. Production traffic must use HTTPS exclusively, and the database provider must provide encryption, backups and access controls. WorkHive applies company and role-based access controls that remain subject to continuous review before commercial launch.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-accent" />
                                        4. User Rights (GDPR)
                                    </h2>
                                    <p>
                                        Under GDPR you may request access, rectification, erasure, restriction, portability or objection by emailing privacy@workhive.com. The controller&apos;s full legal identity and address, processors, retention periods and legal bases must be completed before commercial launch.
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
