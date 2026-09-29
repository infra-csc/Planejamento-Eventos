import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const geist = localFont({
  src: "../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});
const robotoMono = localFont({
  src: "../../node_modules/@fontsource-variable/roboto-mono/files/roboto-mono-latin-wght-normal.woff2",
  variable: "--font-roboto-mono",
  weight: "100 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Planejamento de Eventos · Norte Mkt", template: "%s · Norte Mkt" },
  description: "Catálogo de peças, projetos padrão, ata da reunião de OS, OS automática e solicitações respondidas item a item.",
  // Sistema interno: não deve aparecer em buscadores.
  robots: { index: false, follow: false },
  applicationName: "Norte Mkt · Planejamento",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2a1418" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${robotoMono.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
