import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import { clientConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: `SMS ${clientConfig.municipalityName}`,
  description: `Secretaria Municipal de Saúde de ${clientConfig.municipalityName} - ${clientConfig.municipalityUF}`,
};

import LGPDConsent from "@/components/LGPDConsent";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e293b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={`SMS ${clientConfig.municipalityName}`} />
        <link rel="apple-touch-icon" href="/logo.jpg" />
      </head>
      <body>
        {children}
        <LGPDConsent />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {})
          }
        `}</Script>
      </body>
    </html>
  );
}
