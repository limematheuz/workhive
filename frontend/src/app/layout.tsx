import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { DictionaryProvider } from "@/lib/dictionary-context";
import { ThemeSync } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { TrafficTracker } from "@/components/traffic/TrafficTracker";

export const metadata: Metadata = {
  metadataBase: new URL("https://workhive.es"),
  title: "WorkHive",
  description: "Gestión de operaciones, equipos y facturación para empresas de servicios.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="es"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  if (theme === 'light') {
                    document.documentElement.classList.add('light-mode');
                  } else {
                    document.documentElement.classList.remove('light-mode');
                  }
                  var locale = localStorage.getItem('locale');
                  if (locale === 'en' || locale === 'es') {
                    document.documentElement.lang = locale;
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
      >
        <DictionaryProvider>
          <ThemeSync />
          <TrafficTracker />
          {children}
          <Toaster position="top-right" />
        </DictionaryProvider>
      </body>
    </html>
  );
}
