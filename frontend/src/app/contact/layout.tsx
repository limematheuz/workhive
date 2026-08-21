import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contacto | WorkHive",
    description: "Contacta con WorkHive para obtener ayuda sobre la plataforma o sus integraciones.",
    alternates: { canonical: "https://workhive.es/contact" },
};

export default function ContactLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return children;
}
