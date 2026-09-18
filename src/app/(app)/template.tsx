/**
 * Entrada animada das telas do app. Um template remonta só quando muda a seção (eventos →
 * solicitações); dentro dela (abas do evento, filtros na URL) o estado da página é preservado.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
