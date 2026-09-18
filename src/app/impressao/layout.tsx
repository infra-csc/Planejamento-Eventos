export default function ImpressaoLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-page py-6 print:bg-white print:py-0">{children}</div>;
}
