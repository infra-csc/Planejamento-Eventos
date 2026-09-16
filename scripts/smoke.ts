/**
 * Teste de fumaça dos fluxos de negócio contra o banco atual (rode logo após `npm run setup`).
 * Exercita os serviços reais: transições bloqueadas/permitidas, permissões, correções, anexos,
 * e os fluxos do redesenho (envio completo, prazo pré-reunião, desfazer, atender tudo, busca).
 * Não substitui os testes unitários do domínio (npm test); complementa-os no nível de serviço.
 */
import { eq } from "drizzle-orm";
import { getConnection } from "../src/server/db";
import { areas, eventoItens, eventos, projetos, usuarios } from "../src/server/db/schema";
import type { UsuarioAtual } from "../src/server/auth/autorizacao";
import { DomainError } from "../src/domain/errors";
import { obterLinhasAta, transicionarEvento } from "../src/server/services/eventos";
import {
  atenderTudo,
  atualizarCabecalho,
  criarRascunho,
  desfazerResposta,
  devolverSolicitacao,
  enviarSolicitacao,
  listarSolicitacoes,
  obterSolicitacao,
  responderItem,
  salvarItem,
  salvarSolicitacaoCompleta,
} from "../src/server/services/solicitacoes";
import { listarOsVersoes } from "../src/server/services/os";
import { anexarArquivo, obterAnexo, removerAnexo } from "../src/server/services/projetos";
import { alterarAtivoPeca, listarPecas } from "../src/server/services/catalogo";
import { alterarAtivoUsuario, criarUsuario, editarUsuario } from "../src/server/services/admin";
import { buscar } from "../src/server/services/busca";
import { dadosPainel } from "../src/server/services/dashboard";
import { calcularConsolidacao } from "../src/server/services/consolidacao";

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
  const rafael = U("rafael.nunes@nortemkt.com.br");
  const helena = U("helena.prado@nortemkt.com.br");
  const paulo = U("paulo.ribeiro@nortemkt.com.br");
  const diego = U("diego.sampaio@nortemkt.com.br");
  const bruno = U("bruno.tavares@nortemkt.com.br");
  const admin = U("admin@nortemkt.com.br");
  const ev = async (codigo: string) => (await db.query.eventos.findFirst({ where: eq(eventos.codigo, codigo) }))!;

  console.log("\n0. Painel e consolidação derivados dos dados");
  const painelLog = await dadosPainel(marina);
  ok(painelLog.tipo === "operacao" && painelLog.metricas.atrasadas >= 1 && painelLog.reuniaoHoje?.nome === "Lançamento SUV Aurora", "painel da logística: atraso e reunião de hoje");
  const painelReq = await dadosPainel(paulo);
  ok(painelReq.tipo === "requisitante" && painelReq.fila.every((f) => f.areaNome === "Produção"), "painel do requisitante só mostra a própria área");
  const hoje = new Date().toISOString().slice(0, 10);
  const cons = await calcularConsolidacao({ inicio: hoje, fim: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) });
  ok(cons.pecas.some((p) => p.pico > 0), "consolidação calcula a demanda das peças no período");
  const e2p = await ev("EVT-0002");
  const consProj = await calcularConsolidacao({ inicio: e2p.dataMontagem, fim: e2p.dataDesmontagem });
  ok(consProj.pecas.some((p) => p.temProjecao && p.eventosNoPico.some((x) => x.codigo === "EVT-0002" && x.projetado)), "consolidação inclui demanda projetada de evento sem ata");

  console.log("\n1. Reunião: fechar ata bloqueada com item pendente; resposta; fechamento gera OS v1");
  const e3 = await ev("EVT-0003");
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
  ok((await ev("EVT-0003")).status === "ABERTO", "evento passou para ABERTO");

  console.log("\n2. Preparação: iniciar reunião, voltar exige justificativa, cancelar exige perfil");
  const e2 = await ev("EVT-0002");
  await transicionarEvento(marina, e2.id, "INICIAR_REUNIAO");
  await deveFalhar(() => transicionarEvento(marina, e2.id, "VOLTAR_PREPARACAO"), "voltar sem justificativa é rejeitado", "justificativa");
  await transicionarEvento(marina, e2.id, "VOLTAR_PREPARACAO", "Reunião adiada para quinta.");
  ok((await ev("EVT-0002")).status === "PREPARACAO", "voltou para PREPARACAO");
  await deveFalhar(() => transicionarEvento(marina, e2.id, "ENCERRAR"), "encerrar em preparação não é possível", "não é possível");
  await deveFalhar(() => transicionarEvento(helena, e2.id, "CANCELAR", "x"), "gestão não cancela evento", "permissão");

  console.log("\n3. Encerrado: só gestão reabre; encerrar bloqueado com pendentes");
  const e4 = await ev("EVT-0004");
  await deveFalhar(() => transicionarEvento(marina, e4.id, "REABRIR", "teste"), "logística não reabre", "permissão");
  await deveFalhar(() => transicionarEvento(helena, e4.id, "REABRIR"), "reabrir sem justificativa é rejeitado", "justificativa");
  await transicionarEvento(helena, e4.id, "REABRIR", "Cliente incluiu ala extra; aprovado pela direção.");
  ok((await ev("EVT-0004")).reabertoVezes === 1 && (await ev("EVT-0004")).status === "ABERTO", "reaberto em exceção (contador 1)");
  const r4 = await criarRascunho(paulo, e4.id);
  const tenda5 = (await db.query.projetos.findFirst({ where: eq(projetos.codigo, "PRJ-0006") }))!;
  await salvarItem(paulo, r4.id, null, { operacao: "ADICIONAR", projetoId: tenda5.id, quantidadeSolicitada: 1, destino: "Ala D" });
  await deveFalhar(() => enviarSolicitacao(paulo, r4.id), "enviar sem título é rejeitado", "título");
  await atualizarCabecalho(paulo, r4.id, { titulo: "Tenda extra na ala D", observacao: null });
  await enviarSolicitacao(paulo, r4.id);
  await deveFalhar(() => transicionarEvento(marina, e4.id, "ENCERRAR"), "encerrar com solicitação pendente é bloqueado", "sem resposta");
  const s4 = await obterSolicitacao(marina, r4.id);
  await responderItem(marina, s4.itens[0].id, { status: "ATENDIDO" });
  await transicionarEvento(marina, e4.id, "ENCERRAR");
  const v4 = await listarOsVersoes(e4.id);
  ok(v4[0].gatilho === "ENCERRAMENTO", "OS final gerada no encerramento");
  await deveFalhar(() => criarRascunho(paulo, e4.id), "não cria solicitação em evento encerrado", "não está aceitando");

  console.log("\n4. Devolução, reenvio, resposta, correção e efeito na ata");
  const e1 = await ev("EVT-0001");
  const r1 = await salvarSolicitacaoCompleta(paulo, {
    eventoId: e1.id,
    titulo: "Pórtico da entrada leste",
    observacao: null,
    enviar: true,
    itens: [{ operacao: "ADICIONAR", projetoId: (await db.query.projetos.findFirst({ where: eq(projetos.codigo, "PRJ-0002") }))!.id, quantidadeSolicitada: 1, destino: "Entrada leste" }],
  });
  ok(r1.enviada, "alteração pós-ata enviada pelo formulário completo");
  await deveFalhar(() => devolverSolicitacao(marina, r1.id, ""), "devolver sem motivo é rejeitado", "motivo");
  await devolverSolicitacao(marina, r1.id, "Informe o lado da entrada.");
  ok((await obterSolicitacao(paulo, r1.id)).status === "DEVOLVIDA", "devolvida para a área");
  const devolvida = await obterSolicitacao(marina, r1.id);
  await deveFalhar(() => responderItem(marina, devolvida.itens[0].id, { status: "ATENDIDO" }), "não responde item de solicitação devolvida", "aguardando");
  await enviarSolicitacao(paulo, r1.id);
  const s = await obterSolicitacao(marina, r1.id);
  ok(s.status === "ENVIADA" && s.itens[0].status === "EM_ANALISE", "reenviada com item em análise");
  ok(s.prazoRespostaEm && Math.abs(s.prazoRespostaEm.getTime() - Date.now() - 48 * 3_600_000) < 60_000, "alteração pós-ata tem prazo de 48h");
  const antes = (await listarOsVersoes(e1.id)).length;
  await responderItem(marina, s.itens[0].id, { status: "ATENDIDO" });
  const linhas = await obterLinhasAta(e1.id);
  const gerada = linhas.find((l) => l.registro.solicitacaoItemId === s.itens[0].id);
  ok(Boolean(gerada) && gerada!.quantidade === 1 && gerada!.origemLabel === s.codigo, "linha criada na ata com a origem da solicitação");
  ok((await listarOsVersoes(e1.id)).length === antes + 1, "nova versão de OS após resposta");
  await deveFalhar(() => responderItem(marina, s.itens[0].id, { status: "NAO_ATENDIDO", observacaoLogistica: "erro" }), "corrigir sem justificativa é rejeitado", "justificativa");
  await responderItem(marina, s.itens[0].id, { status: "NAO_ATENDIDO", observacaoLogistica: "Sem box 3,5 m disponível." }, "Respondi o item errado.");
  const linhaDepois = await db.query.eventoItens.findFirst({ where: eq(eventoItens.id, gerada!.id) });
  ok(linhaDepois?.ativo === false, "correção para não atendido desativa a linha da ata");
  await deveFalhar(() => desfazerResposta(marina, s.itens[0].id), "correção não pode ser desfeita pelo toast", "Corrigir");

  console.log("\n5. Anexos de projeto (bytea)");
  const pj = (await db.query.projetos.findFirst({ where: eq(projetos.codigo, "PRJ-0001") }))!;
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
  await deveFalhar(() => criarUsuario(marina, { nome: "X", email: "x@x.com", perfil: "REQUISITANTE", areaId: null, senha: null, ativo: true }), "logística não cria usuário", "permissão");
  await deveFalhar(() => criarUsuario(admin, { nome: "X", email: "x@x.com", perfil: "LOGISTICA", areaId: null, senha: null, ativo: true }), "logística sem área é rejeitada", "área");
  const areaProd = (await db.query.areas.findFirst({ where: eq(areas.nome, "Produção") }))!;
  const novo = await criarUsuario(admin, { nome: "Teste Fumaça", email: "fumaca@nortemkt.com.br", perfil: "REQUISITANTE", areaId: areaProd.id, senha: null, ativo: true });
  ok(Boolean(novo.id) && novo.linkAcesso?.includes("/redefinir-senha/"), "usuário criado com link de acesso para definir a senha");
  await deveFalhar(() => criarUsuario(admin, { nome: "Dup", email: "FUMACA@nortemkt.com.br", perfil: "REQUISITANTE", areaId: areaProd.id, senha: null, ativo: true }), "e-mail duplicado é rejeitado", "Já existe");
  await editarUsuario(admin, novo.id, { nome: "Teste Fumaça 2", email: "outro@x.com", perfil: "CENOGRAFIA", areaId: areaProd.id, senha: null, ativo: true });
  const editado = await db.query.usuarios.findFirst({ where: eq(usuarios.id, novo.id) });
  ok(editado?.email === "fumaca@nortemkt.com.br" && editado.perfil === "CENOGRAFIA", "edição não altera o e-mail (somente leitura)");
  await alterarAtivoUsuario(admin, novo.id, false);
  ok((await db.query.usuarios.findFirst({ where: eq(usuarios.id, novo.id) }))?.ativo === false, "desativar usuário pela lista");
  await deveFalhar(() => alterarAtivoUsuario(admin, admin.id, false), "admin não desativa a si mesmo", "próprio");
  await deveFalhar(() => editarUsuario(admin, admin.id, { nome: admin.nome, email: admin.email, perfil: "ADMIN", areaId: null, senha: null, ativo: false }), "admin não se desativa pela edição", "próprio");
  await db.delete(usuarios).where(eq(usuarios.id, novo.id));

  console.log("\n7. Redesenho: formulário completo, prazo pré-reunião, desfazer, atender tudo, busca");
  const e2b = await ev("EVT-0002");
  await deveFalhar(
    () => salvarSolicitacaoCompleta(paulo, { eventoId: e2b.id, titulo: null, observacao: null, enviar: true, itens: [] }),
    "enviar sem título e sem itens é rejeitado",
    "Falta preencher",
  );
  const rasc = await salvarSolicitacaoCompleta(paulo, { eventoId: e2b.id, titulo: null, observacao: "rascunho", enviar: false, itens: [] });
  ok(!rasc.enviada && (await obterSolicitacao(paulo, rasc.id)).status === "RASCUNHO", "salvar rascunho sem título é permitido");
  const r = await salvarSolicitacaoCompleta(paulo, {
    id: rasc.id,
    eventoId: e2b.id,
    titulo: "Teste de fumaça",
    observacao: "Contexto",
    enviar: true,
    itens: [
      { operacao: "ADICIONAR", projetoId: tenda5.id, quantidadeSolicitada: 2, destino: "Foyer" },
      { operacao: "ADICIONAR", descricaoLivre: "Fechamento de tenda", quantidadeSolicitada: 4, destino: "GV" },
    ],
  });
  const sr = await obterSolicitacao(marina, r.id);
  ok(r.id === rasc.id && sr.status === "ENVIADA" && sr.itens.length === 2, "rascunho atualizado e enviado com 2 itens");
  ok(sr.prazoRespostaEm?.getTime() === e2b.dataReuniao.getTime(), "prazo da necessidade pré-reunião é a própria reunião");
  const linhasAntes = (await obterLinhasAta(e2b.id)).length;
  await responderItem(marina, sr.itens[0].id, { status: "ATENDIDO" });
  ok((await obterLinhasAta(e2b.id)).length === linhasAntes + 1, "resposta inclui linha na ata em construção");
  await deveFalhar(() => desfazerResposta(rafael, sr.itens[0].id), "outro usuário não desfaz a resposta", "desfeita");
  await desfazerResposta(marina, sr.itens[0].id);
  const sr2 = await obterSolicitacao(marina, r.id);
  ok(sr2.itens[0].status === "EM_ANALISE" && sr2.status === "ENVIADA", "desfazer volta o item para análise");
  ok((await obterLinhasAta(e2b.id)).length === linhasAntes, "desfazer tira a linha da ata");
  const n = await atenderTudo(marina, r.id);
  ok(n === 2 && (await obterSolicitacao(marina, r.id)).status === "RESPONDIDA", "atender tudo responde os itens pendentes");
  ok((await obterLinhasAta(e2b.id)).length === linhasAntes + 2, "linha reativada e avulso incluído após atender tudo");
  const resDiego = await buscar(diego, "SOL-");
  ok(resDiego.filter((x) => x.tag === "solic.").length > 0 && resDiego.filter((x) => x.tag === "solic.").every((x) => x.sub.startsWith("Gráfica")), "busca respeita a área do requisitante");
  const resMarina = await buscar(marina, "");
  ok(resMarina.some((x) => x.titulo === "Consolidar ata da reunião de hoje") === false || resMarina.length <= 8, "busca sem termo devolve no máximo 8 resultados");
  ok(!(await buscar(paulo, "")).some((x) => x.titulo.startsWith("Consolidar")), "requisitante não vê ação de consolidar ata");

  console.log(`\n${falhas === 0 ? "Todos os cenários passaram." : `${falhas} cenário(s) falharam.`}`);
  await conn.close();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
