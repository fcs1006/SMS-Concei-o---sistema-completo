import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMS Conceição",
  description: "Sistema de Controle de Viagem",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}