import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Términos del servicio | WorkHive",
    description: "Condiciones de uso de la plataforma WorkHive.",
    alternates: { canonical: "https://workhive.es/terms" },
};

export default function TermsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return children;
}
