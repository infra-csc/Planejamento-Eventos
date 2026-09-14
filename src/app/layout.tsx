import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Planejamento de Eventos · Norte Mkt", template: "%s · Norte Mkt" },
  description: "Sistema de OS, ata e estrutura para eventos.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="bottom-right" richColors closeButton toastOptions={{ style: { fontSize: 13 } }} />
      </body>
    </html>
  );
}
