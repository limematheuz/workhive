import type { Metadata } from "next";
import { PublicLanding } from "@/components/marketing/PublicLanding";

export const metadata: Metadata = {
    title: "WorkHive | Gestión para empresas de servicios",
    description:
        "Planifica trabajos, coordina equipos, registra horas y gestiona presupuestos y facturación con WorkHive.",
    alternates: { canonical: "https://workhive.es" },
    openGraph: {
        title: "WorkHive | Gestión para empresas de servicios",
        description: "Operaciones, equipos y facturación conectados en una única plataforma.",
        url: "https://workhive.es",
        siteName: "WorkHive",
        type: "website",
    },
};

export default function AboutPage() {
    return <PublicLanding />;
}
