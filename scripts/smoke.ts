/**
 * Teste de fumaça dos fluxos de negócio contra o banco atual (rode após `npm run setup`).
 * Exercita os serviços reais: transições bloqueadas/permitidas, permissões, correções, anexos.
 * Não substitui os testes unitários do domínio (npm test); complementa-os no nível de serviço.
 */
import { eq } from "drizzle-orm";
import { getConnection } from "../src/server/db";
import { areas, eventoItens, eventos, projetos, usuarios } from "../src/server/db/schema";
import type { UsuarioAtual } from "../src/server/auth/autorizacao";
import { DomainError } from "../src/domain/errors";
import { obterLinhasAta, transicionarEvento } from "../src/server/services/eventos";
import { criarRascunho, devolverSolicitacao, enviarSolicitacao, listarSolicitacoes, obterSolicitacao, responderItem, salvarItem } from "../src/server/services/solicitacoes";
import { listarOsVersoes } from "../src/server/services/os";
import { anexarArquivo, obterAnexo, removerAnexo } from "../src/server/services/projetos";
import { alterarAtivoPeca, listarPecas } from "../src/server/services/catalogo";
import { criarUsuario, editarUsuario } from "../src/server/services/admin";

let falhas = 0;
function ok(cond: unknown, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    falhas++;
    console.log(`  ✗ ${msg}`);
  }
}
async function deveFalhar(fn: () => Promise<unknown>, msg: string, trecho?: string) {
  try {
    await fn();
    ok(false, `${msg} (não lançou erro)`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    ok(e instanceof DomainError && (!trecho || m.includes(trecho)), `${msg} → "${m.slice(0, 90)}"`);
  }
}

async function main() {
  const conn = await getConnection();
  const db = conn.db;
  const todos = await db.query.usuarios.findMany({ with: { area: true } });
  const U = (email: string): UsuarioAtual => {
    const u = todos.find((x) => x.email === email)!;
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: u.area?.nome ?? null };
  };
  const marina = U("marina.castro@nortemkt.com.br");
  const helena = U("helena.prado@nortemkt.com.br");
  const paulo = U("paulo.ribeiro@nortemkt.com.br");
  const bruno = U("bruno.tavares@nortemkt.com.br");
  const admin = U("admin@nortemkt.com.br");
  const ev = async (codigo: string) => (await db.query.eventos.findFirst({ where: eq(eventos.codigo, codigo) }))!;

  console.log("\n1. Reunião: fechar ata bloqueada com item pendente; resposta; fechamento gera OS v1");
  const e3 = await ev("EV-0003");
  await deveFalhar(() => transicionarEvento(marina, e3.id, "FECHAR_ATA"), "fechar ata com item pendente é bloqueado", "sem resposta");
  const pend = (await listarSolicitacoes(marina, { eventoId: e3.id, status: "ABERTAS" }))[0];
  const sol = await obterSolicitacao(marina, pend.id);
  const item = sol.itens.find((i) => i.status === "EM_ANALISE")!;
  await deveFalhar(() => responderItem(marina, item.id, { status: "NAO_ATENDIDO" }), "não atendido sem observação é rejeitado", "observação");
  await deveFalhar(() => responderItem(paulo, item.id, { status: "ATENDIDO" }), "requisitante não pode responder", "permissão");
  await responderItem(marina, item.id, { status: "NAO_ATENDIDO", observacaoLogistica: "Fechamentos já reservados para a Praia Sonora." });
  await transicionarEvento(marina, e3.id, "FECHAR_ATA");
  const v3 = await listarOsVersoes(e3.id);
  ok(v3.length === 1 && v3[0].gatilho === "ATA_FECHADA", "OS v1 gerada ao fechar a ata");
  ok((await ev("EV-0003")).status === "ABERTO", "evento passou para ABERTO");

  console.log("\n2. Preparação: iniciar reunião, voltar exige justificativa, cancelar exige motivo");
  const e2 = await ev("EV-0002");
  await transicionarEvento(marina, e2.id, "INICIAR_REUNIAO");
  await deveFalhar(() => transicionarEvento(marina, e2.id, "VOLTAR_PREPARACAO"), "voltar sem justificativa é rejeitado", "justificativa");
  await transicionarEvento(marina, e2.id, "VOLTAR_PREPARACAO", "Reunião adiada para quinta.");
  ok((await ev("EV-0002")).status === "PREPARACAO", "voltou para PREPARACAO");
  await deveFalhar(() => transicionarEvento(marina, e2.id, "ENCERRAR"), "encerrar em preparação não é possível", "não é possível");
  await deveFalhar(() => transicionarEvento(helena, e2.id, "CANCELAR", "x"), "gestão não cancela evento", "permissão");

  console.log("\n3. Encerrado: só gestão reabre; encerrar bloqueado com pendentes");
  const e4 = await ev("EV-0004");
  await deveFalhar(() => transicionarEvento(marina, e4.id, "REABRIR", "teste"), "logística não reabre", "permissão");
  await deveFalhar(() => transicionarEvento(helena, e4.id, "REABRIR"), "reabrir sem justificativa é rejeitado", "justificativa");
  await transicionarEvento(helena, e4.id, "REABRIR", "Cliente incluiu ala extra; aprovado pela direção.");
  ok((await ev("EV-0004")).reabertoVezes === 1 && (await ev("EV-0004")).status === "ABERTO", "reaberto em exceção (contador 1)");
  const r4 = await criarRascunho(paulo, e4.id);
  const tenda5 = (await db.query.projetos.findFirst({ where: eq(projetos.codigo, "PJ-0006") }))!;
  await salvarItem(paulo, r4.id, null, { operacao: "ADICIONAR", projetoId: tenda5.id, quantidadeSolicitada: 1, destino: "Ala D" });
  await enviarSolicitacao(paulo, r4.id);
  await deveFalhar(() => transicionarEvento(marina, e4.id, "ENCERRAR"), "encerrar com solicitação pendente é bloqueado", "sem resposta");
  const s4 = await obterSolicitacao(marina, r4.id);
  await responderItem(marina, s4.itens[0].id, { status: "ATENDIDO" });
  await transicionarEvento(marina, e4.id, "ENCERRAR");
  const v4 = await listarOsVersoes(e4.id);
  ok(v4[0].gatilho === "ENCERRAMENTO", "OS final gerada no encerramento");
  await deveFalhar(() => criarRascunho(paulo, e4.id), "não cria solicitação em evento encerrado", "não está aceitando");

  console.log("\n4. Devolução, reenvio, resposta, correção e efeito na ata");
  const e1 = await ev("EV-0001");
  const abertas = await listarSolicitacoes(marina, { eventoId: e1.id, status: "ABERTAS" });
  const sPaulo = abertas.find((s) => s.criadoPor.nome === "Paulo Ribeiro");
  ok(Boolean(sPaulo), "solicitação enviada pela UI (SOL-0021) está na fila");
  if (sPaulo) {
    await deveFalhar(() => devolverSolicitacao(marina, sPaulo.id, ""), "devolver sem motivo é rejeitado", "motivo");
    await devolverSolicitacao(marina, sPaulo.id, "Informe o lado da entrada.");
    ok((await obterSolicitacao(paulo, sPaulo.id)).status === "DEVOLVIDA", "devolvida para a área");
    const devolvida = await obterSolicitacao(marina, sPaulo.id);
    await deveFalhar(() => responderItem(marina, devolvida.itens[0].id, { status: "ATENDIDO" }), "não responde item de solicitação devolvida", "aguardando");
    await enviarSolicitacao(paulo, sPaulo.id);
    const s = await obterSolicitacao(marina, sPaulo.id);
    ok(s.status === "ENVIADA" && s.itens[0].status === "EM_ANALISE", "reenviada com item em análise");
    const antes = (await listarOsVersoes(e1.id)).length;
    await responderItem(marina, s.itens[0].id, { status: "ATENDIDO" });
    const linhas = await obterLinhasAta(e1.id);
    const gerada = linhas.find((l) => l.registro.solicitacaoItemId === s.itens[0].id);
    ok(Boolean(gerada) && gerada!.quantidade === 1, "linha criada na ata com a quantidade atendida");
    ok((await listarOsVersoes(e1.id)).length === antes + 1, "nova versão de OS após resposta");
    await deveFalhar(() => responderItem(marina, s.itens[0].id, { status: "NAO_ATENDIDO", observacaoLogistica: "erro" }), "corrigir sem justificativa é rejeitado", "justificativa");
    await responderItem(marina, s.itens[0].id, { status: "NAO_ATENDIDO", observacaoLogistica: "Sem box 3,5 m disponível." }, "Respondi o item errado.");
    const linhaDepois = await db.query.eventoItens.findFirst({ where: eq(eventoItens.id, gerada!.id) });
    ok(linhaDepois?.ativo === false, "correção para não atendido desativa a linha da ata");
  }

  console.log("\n5. Anexos de projeto (bytea)");
  const pj = (await db.query.projetos.findFirst({ where: eq(projetos.codigo, "PJ-0001") }))!;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const file = new File([png], "portico.png", { type: "image/png" });
  await deveFalhar(() => anexarArquivo(marina, pj.id, file), "logística não anexa em projeto", "permissão");
  await deveFalhar(() => anexarArquivo(bruno, pj.id, new File([png], "x.exe", { type: "application/octet-stream" })), "formato inválido é rejeitado", "Formato");
  const a = await anexarArquivo(bruno, pj.id, file);
  const lido = await obterAnexo(paulo, a.id);
  ok(lido.conteudo.length === png.length && lido.mime === "image/png", "anexo gravado e lido com o mesmo conteúdo");
  await removerAnexo(bruno, a.id);
  await deveFalhar(() => obterAnexo(paulo, a.id), "anexo removido não é mais encontrado", "não encontrado");

  console.log("\n6. Catálogo e administração");
  const pecasLista = await listarPecas(marina);
  const box600 = pecasLista.find((p) => p.codigo === "BOX-600")!;
  await deveFalhar(() => alterarAtivoPeca(marina, box600.id, false), "peça em BOM ativo não pode ser inativada", "BOM");
  await deveFalhar(() => criarUsuario(marina, { nome: "X", email: "x@x.com", perfil: "REQUISITANTE", areaId: null, senha: "12345678", ativo: true }), "logística não cria usuário", "permissão");
  await deveFalhar(() => criarUsuario(admin, { nome: "X", email: "x@x.com", perfil: "REQUISITANTE", areaId: null, senha: "12345678", ativo: true }), "requisitante sem área é rejeitado", "área");
  const areaProd = (await db.query.areas.findFirst({ where: eq(areas.nome, "Produção") }))!;
  const novo = await criarUsuario(admin, { nome: "Teste Fumaça", email: "fumaca@nortemkt.com.br", perfil: "REQUISITANTE", areaId: areaProd.id, senha: "12345678", ativo: true });
  ok(Boolean(novo.id), "usuário criado pelo admin");
  await deveFalhar(() => editarUsuario(admin, admin.id, { nome: admin.nome, email: admin.email, perfil: "ADMIN", areaId: null, senha: null, ativo: false }), "admin não desativa a si mesmo", "próprio");
  await db.delete(usuarios).where(eq(usuarios.id, novo.id));

  console.log(`\n${falhas === 0 ? "Todos os cenários passaram." : `${falhas} cenário(s) falharam.`}`);
  await conn.close();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
