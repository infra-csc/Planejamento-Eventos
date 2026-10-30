import { NextResponse } from "next/server";

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Erro de uma rota de download (OS, ata, CSV). Quem clicou no link (o navegador pede `text/html`) via uma aba com o código
 * cru `{"erro":"Sem permissão"}` (auditoria 28/10, nº 82): agora vê uma página curta em português com o caminho de volta.
 * Chamadas de programa e os testes continuam recebendo `{ erro }` em JSON, com o mesmo status.
 */
export function erroDownload(request: Request, status: number, mensagem: string, voltar = "/eventos") {
  if (!(request.headers.get("accept") ?? "").includes("text/html")) return NextResponse.json({ erro: mensagem }, { status });
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Não foi possível baixar · Planejamento</title><style>body{font-family:system-ui,sans-serif;background:#f1efee;color:#2a1418;margin:0;display:grid;place-items:center;min-height:100vh;padding:16px}main{background:#fff;border:1px solid #e3dcdb;border-radius:10px;padding:24px;max-width:420px}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#4f4849;margin:0 0 16px}a{color:#8e2740}</style></head><body><main><h1>Não foi possível baixar o arquivo</h1><p>${escapar(mensagem.replace(/\.?$/, "."))}</p><a href="${escapar(voltar)}">Voltar</a></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
