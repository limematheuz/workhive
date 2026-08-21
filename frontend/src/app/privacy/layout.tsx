import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Política de privacidad | WorkHive",
    description: "Cómo WorkHive trata y protege los datos personales y de Google Calendar.",
    alternates: { canonical: "https://workhive.es/privacy" },
};

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return children;
}
