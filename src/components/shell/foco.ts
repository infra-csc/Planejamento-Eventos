/**
 * Depois de uma ação que some com o botão clicado (enviar, cancelar, atender tudo, marcar todas como lidas), o foco
 * caía no <body> e quem usa teclado voltava ao "Pular para o conteúdo" (auditoria 30/10, parte A N8). Leva o foco ao
 * conteúdo da página (o <main>, que aceita foco por script) quando ele se perdeu — nunca tira o foco de um lugar válido.
 * Espera dois quadros: a tela nova (revalidada) chega e o diálogo devolve o foco antes.
 */
export function focarConteudoSePerdido() {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const ativo = document.activeElement;
      if (ativo && ativo !== document.body && ativo.isConnected) return;
      document.getElementById("conteudo")?.focus({ preventScroll: true });
    }),
  );
}
