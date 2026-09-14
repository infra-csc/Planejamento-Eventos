export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Norte Mkt</p>
        <h1 className="mt-1 text-lg font-semibold text-ink">Planejamento de Eventos</h1>
      </div>
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 shadow-sm">{children}</div>
    </div>
  );
}
