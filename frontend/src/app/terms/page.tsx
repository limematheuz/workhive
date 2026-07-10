"use client";

import Link from "next/link";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { useThemeMode } from "@/lib/theme";
import { ArrowLeft, Scale } from "lucide-react";

export default function TermsPage() {
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
                            <Scale className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
                                {locale === "es" ? "Términos y Condiciones" : "Terms and Conditions"}
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
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        1. Relación Contractual y Aceptación
                                    </h2>
                                    <p>
                                        Bienvenido a WorkHive Enterprise. Al acceder o utilizar nuestro software como servicio (SaaS), usted y la entidad que representa acuerdan quedar vinculados por los presentes Términos de Servicio. Si no acepta estas condiciones, deberá abstenerse de usar el sistema.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        2. Uso Autorizado y Cuentas de Empresa
                                    </h2>
                                    <p>
                                        El software está diseñado para la gestión de personal de campo, control de jornadas laborales, reservas turísticas y facturación. El administrador de la empresa es responsable de custodiar las credenciales y definir correctamente los roles de los trabajadores (Admin, Manager, Operario o Viewer).
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        3. Herramientas de Facturación y Responsabilidad Fiscal
                                    </h2>
                                    <p>
                                        WorkHive incorpora herramientas de presupuestos y facturación operativa. La empresa usuaria sigue siendo responsable de revisar la numeración, datos fiscales, impuestos y obligaciones legales antes de emitir cada documento.
                                    </p>
                                    <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                                        <li>Los documentos emitidos se bloquean frente a la edición ordinaria.</li>
                                        <li>Las correcciones deben documentarse mediante el flujo rectificativo disponible.</li>
                                        <li>La adecuación definitiva a Veri*Factu y demás normativa fiscal requiere validación legal y técnica independiente antes de comercializarse como software fiscal certificado.</li>
                                    </ul>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        4. Política de Suscripciones, Cargos y Prueba Gratuita
                                    </h2>
                                    <p>
                                        WorkHive puede ofrecer una evaluación asistida de 14 días. La activación, duración y límites se confirmarán por escrito durante el alta. Los pagos solo se procesarán mediante un checkout alojado por un proveedor de pagos; WorkHive no solicitará ni almacenará números de tarjeta.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        5. Disponibilidad y soporte
                                    </h2>
                                    <p>
                                        Durante la fase de lanzamiento no se ofrece un SLA contractual de disponibilidad. Las condiciones de soporte, mantenimiento, copias de seguridad, exportación y recuperación deberán constar en la oferta comercial definitiva.
                                    </p>
                                </section>
                            </>
                        ) : (
                            <>
                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        1. Contractual Relationship & Acceptance
                                    </h2>
                                    <p>
                                        Welcome to WorkHive Enterprise. By accessing or using our software as a service (SaaS), you and the entity you represent agree to be bound by these Terms of Service. If you do not agree, you must immediately cease using the platform.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        2. Authorized Use & Company Accounts
                                    </h2>
                                    <p>
                                        The software is built for field team management, shift clock-ins, reservation tracking, and invoicing. The company administrator is responsible for credentials custody and setting worker roles (Admin, Manager, Operative, Viewer).
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        3. Invoicing Tools & Tax Responsibility
                                    </h2>
                                    <p>
                                        WorkHive includes operational quoting and invoicing tools. Customers remain responsible for reviewing numbering, tax details, taxes and legal obligations before issuing documents.
                                    </p>
                                    <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                                        <li>Issued documents are locked against ordinary editing.</li>
                                        <li>Corrections must use the available rectification workflow.</li>
                                        <li>Final Veri*Factu and tax compliance requires independent legal and technical validation before the product is marketed as certified tax software.</li>
                                    </ul>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        4. Subscription Policy, Charges & Free Trial
                                    </h2>
                                    <p>
                                        WorkHive may provide a 14-day assisted evaluation. Activation, duration and limits are confirmed in writing during onboarding. Payments are only processed through a hosted payment-provider checkout; WorkHive does not request or store card numbers.
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                                        <span className="w-1.5 h-3 bg-accent rounded-full" />
                                        5. Availability and support
                                    </h2>
                                    <p>
                                        No contractual availability SLA is offered during the launch phase. Final commercial terms must specify support, maintenance, backups, exports and recovery commitments.
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
