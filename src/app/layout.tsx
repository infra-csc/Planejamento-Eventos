import type { Metadata, Viewport } from "next";
import { Geist, Roboto_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const robotoMono = Roboto_Mono({ variable: "--font-roboto-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

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
