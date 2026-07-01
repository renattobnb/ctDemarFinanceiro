import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CTDemar Financeiro",
  description: "Controle financeiro de alunos, turmas, mensalidades e inadimplentes.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icone.svg",
    apple: "/icone.svg"
  },
  appleWebApp: {
    capable: true,
    title: "CTDemar",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1
};

export default function LayoutPrincipal({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
