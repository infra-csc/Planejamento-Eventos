/**
 * Dados de demonstração (fictícios). Usa os serviços reais para que histórico,
 * notificações, versões de ata e de OS fiquem coerentes com o processo.
 *
 * Senha de todos os usuários: norte1234
 *
 * Estoques de BOX-3000, CUBO, TALHA e PARAF são valores de demonstração ajustados para
 * a consolidação mostrar déficit real (handoff §11). Use o estoque real da empresa em produção.
 */
import { eq, sql } from "drizzle-orm";
import { getConnection } from "../src/server/db";
import { areas, pecas, projetos, solicitacoes, usuarios, type Perfil, type Setor } from "../src/server/db/schema";
import { hashSenha } from "../src/server/auth/password";
import type { UsuarioAtual } from "../src/server/auth/autorizacao";
import { criarProjeto, editarProjeto } from "../src/server/services/projetos";
import { alterarQuantidadeLinha, criarEvento, incluirLinhaAta, obterLinhasAta, salvarObservacoesReuniao, transicionarEvento } from "../src/server/services/eventos";
import { atualizarCabecalho, criarRascunho, devolverSolicitacao, enviarSolicitacao, obterSolicitacao, responderItem, salvarItem } from "../src/server/services/solicitacoes";
import { marcarTodasLidas } from "../src/server/services/notificacoes";

const SENHA = "norte1234";
const HOJE = new Date();
HOJE.setHours(12, 0, 0, 0);

function d(dias: number): string {
  const x = new Date(HOJE);
  x.setDate(x.getDate() + dias);
  return x.toISOString().slice(0, 10);
}
function dt(dias: number, hora = 10): Date {
  const x = new Date(HOJE);
  x.setDate(x.getDate() + dias);
  x.setHours(hora, 0, 0, 0);
  return x;
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "true") {
    console.error("Seed de demonstração bloqueado em produção (senha fixa para todos). Use SEED_DEMO=true se for mesmo um ambiente de demonstração.");
    process.exit(1);
  }
  const conn = await getConnection();
  const db = conn.db;
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(usuarios);
  if (Number(n) > 0) {
    console.log("O banco já tem dados. Rode `npm run db:reset` e depois `npm run setup` para recriar.");
    await conn.close();
    return;
  }

  /* ---------------------------------------------------------------- */
  /* Áreas e usuários                                                   */
  /* ---------------------------------------------------------------- */
  const nomesAreas = ["Produção", "Cenografia", "Ativação", "Gráfica", "Atendimento", "Logística"];
  const areasRows: Array<typeof areas.$inferSelect> = [];
  for (const nome of nomesAreas) {
    // uma por vez para preservar a ordem de criação (usada nas listas)
    const [a] = await db.insert(areas).values({ nome }).returning();
    areasRows.push(a);
  }
  const area = (nome: string) => areasRows.find((a) => a.nome === nome)!;

  const senhaHash = await hashSenha(SENHA);
  const defs: Array<{ nome: string; email: string; perfil: Perfil; area?: string }> = [
    { nome: "Administrador do Sistema", email: "admin@nortemkt.com.br", perfil: "ADMIN" },
    { nome: "Marina Castro", email: "marina.castro@nortemkt.com.br", perfil: "LOGISTICA", area: "Logística" },
    { nome: "Rafael Nunes", email: "rafael.nunes@nortemkt.com.br", perfil: "LOGISTICA", area: "Logística" },
    { nome: "Helena Prado", email: "helena.prado@nortemkt.com.br", perfil: "GESTAO" },
    { nome: "Bruno Tavares", email: "bruno.tavares@nortemkt.com.br", perfil: "CENOGRAFIA", area: "Cenografia" },
    { nome: "Carla Mendes", email: "carla.mendes@nortemkt.com.br", perfil: "CENOGRAFIA", area: "Cenografia" },
    { nome: "Paulo Ribeiro", email: "paulo.ribeiro@nortemkt.com.br", perfil: "REQUISITANTE", area: "Produção" },
    { nome: "Ana Lima", email: "ana.lima@nortemkt.com.br", perfil: "REQUISITANTE", area: "Produção" },
    { nome: "Júlia Fontes", email: "julia.fontes@nortemkt.com.br", perfil: "REQUISITANTE", area: "Ativação" },
    { nome: "Tiago Moreira", email: "tiago.moreira@nortemkt.com.br", perfil: "REQUISITANTE", area: "Ativação" },
    { nome: "Diego Sampaio", email: "diego.sampaio@nortemkt.com.br", perfil: "REQUISITANTE", area: "Gráfica" },
    { nome: "Lúcia Barros", email: "lucia.barros@nortemkt.com.br", perfil: "REQUISITANTE", area: "Atendimento" },
  ];
  const usersRows = await db
    .insert(usuarios)
    .values(defs.map((u) => ({ nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.area ? area(u.area).id : null, senhaHash })))
    .returning();
  const U = (email: string): UsuarioAtual => {
    const u = usersRows.find((x) => x.email === email)!;
    const a = areasRows.find((x) => x.id === u.areaId);
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: a?.nome ?? null };
  };
  const marina = U("marina.castro@nortemkt.com.br");
  const rafael = U("rafael.nunes@nortemkt.com.br");
  const helena = U("helena.prado@nortemkt.com.br");
  const bruno = U("bruno.tavares@nortemkt.com.br");
  const paulo = U("paulo.ribeiro@nortemkt.com.br");
  const ana = U("ana.lima@nortemkt.com.br");
  const julia = U("julia.fontes@nortemkt.com.br");
  const diego = U("diego.sampaio@nortemkt.com.br");
  const lucia = U("lucia.barros@nortemkt.com.br");

  /* ---------------------------------------------------------------- */
  /* Catálogo de peças                                                  */
  /* ---------------------------------------------------------------- */
  const cat: Array<[string, string, Setor, string, number, boolean?, string?]> = [
    // código, nome, setor, família, estoque, permiteEmProjeto, unidade
    ["BOX-400", "Box truss 400 mm — trecho 1 m", "ESTRUTURA", "Box truss", 40],
    ["BOX-600", "Box truss 600 mm — trecho 1,5 m", "ESTRUTURA", "Box truss", 120],
    ["BOX-700", "Box truss 700 mm — trecho 2 m", "ESTRUTURA", "Box truss", 60],
    ["BOX-3000", "Box truss — trecho 3 m", "ESTRUTURA", "Box truss", 40],
    ["BOX-3500", "Box truss — trecho 3,5 m", "ESTRUTURA", "Box truss", 30],
    ["CUBO", "Cubo de conexão 4 faces", "ESTRUTURA", "Conexão", 34],
    ["GRAPPLE", "Grapple (esticador de cabo)", "ESTRUTURA", "Conexão", 24],
    ["PARAF", "Parafuso M12 com porca e arruela", "ESTRUTURA", "Fixação", 600],
    ["SAPATA", "Sapata de base 40×40", "ESTRUTURA", "Base", 36],
    ["CONTRAPESO", "Contrapeso 25 kg", "ESTRUTURA", "Base", 60],
    ["TALHA", "Talha manual 1 t", "ESTRUTURA", "Içamento", 2],
    ["TND-CANT", "Cantoneira de tenda", "TENDA", "Tenda", 96],
    ["TND-TRAV", "Travessa de tenda 5 m", "TENDA", "Tenda", 64],
    ["TND-PE", "Pé de tenda 3 m", "TENDA", "Tenda", 72],
    ["TND-MASTRO", "Mastro central", "TENDA", "Tenda", 20],
    ["TND-CABO", "Cabo de aço 6 mm — 10 m", "TENDA", "Tenda", 80],
    ["TND-CALHA", "Calha de união 5 m", "TENDA", "Tenda", 40],
    ["TND-LONA10", "Lona de cobertura 10×10", "TENDA", "Tenda", 8],
    ["TND-LONA5", "Lona de cobertura 5×5", "TENDA", "Tenda", 14],
    ["TND-FECH", "Fechamento lateral de tenda 5 m", "TENDA", "Tenda", 30, false],
    ["MDF-15", "Chapa MDF 15 mm 2,75×1,85", "MARCENARIA", "Chapa", 60],
    ["MDF-9", "Chapa MDF 9 mm 2,75×1,85", "MARCENARIA", "Chapa", 45],
    ["SARRAFO", "Sarrafo de pinus 3 m", "MARCENARIA", "Madeira", 200],
    ["PISO-MOD", "Módulo de piso 1×1 m (praticável)", "MARCENARIA", "Piso", 150],
    ["PERNA-60", "Perna de praticável 60 cm", "MARCENARIA", "Piso", 300],
    ["TAMPO-BAL", "Tampo de balcão 2 m", "MARCENARIA", "Balcão", 12],
    ["RODAPE", "Rodapé de palco 30 cm (m)", "MARCENARIA", "Acabamento", 120, true, "m"],
    ["TINTA-PRETA", "Tinta PVA preta fosca (lata 18 l)", "MARCENARIA", "Acabamento", 10, true, "lata"],
  ];
  const pecasRows = await db
    .insert(pecas)
    .values(cat.map(([codigo, nome, setor, familia, estoqueProprio, permite, unidade]) => ({ codigo, nome, setor, familia, estoqueProprio, permiteEmProjeto: permite ?? true, unidade: unidade ?? "un", criadoPorId: marina.id })))
    .returning();
  const P = (codigo: string) => pecasRows.find((p) => p.codigo === codigo)!.id;

  /* ---------------------------------------------------------------- */
  /* Projetos padrão                                                    */
  /* ---------------------------------------------------------------- */
  const bom = (l: Array<[string, number]>) => l.map(([c, q]) => ({ pecaId: P(c), quantidade: q }));
  const portico660 = await criarProjeto(bruno, {
    nome: "Pórtico boca 6,60m",
    categoria: "Pórtico",
    descricao: "Pórtico de entrada em box truss, vão livre de 6,60 m e 4 m de altura.",
    observacaoVersao: "Versão inicial",
    itens: bom([["BOX-400", 1], ["BOX-600", 5], ["BOX-700", 1], ["BOX-3000", 10], ["BOX-3500", 2], ["CUBO", 10], ["GRAPPLE", 1], ["PARAF", 132]]),
  });
  const portico4 = await criarProjeto(bruno, { nome: "Pórtico boca 4m", categoria: "Pórtico", descricao: "Pórtico compacto para acessos secundários.", observacaoVersao: null, itens: bom([["BOX-600", 4], ["BOX-3000", 4], ["CUBO", 4], ["SAPATA", 2], ["PARAF", 64]]) });
  const torreSom = await criarProjeto(bruno, { nome: "Torre de som 4m", categoria: "Torre", descricao: "Torre para line array pequeno, com contrapeso.", observacaoVersao: null, itens: bom([["BOX-3000", 2], ["BOX-600", 2], ["CUBO", 2], ["SAPATA", 1], ["CONTRAPESO", 4], ["TALHA", 1], ["PARAF", 40]]) });
  const palco86 = await criarProjeto(bruno, {
    nome: "Palco 8×6 m com cobertura",
    categoria: "Palco",
    descricao: "Praticáveis 1×1 a 60 cm, rodapé e cobertura em box truss.",
    observacaoVersao: null,
    itens: bom([["PISO-MOD", 48], ["PERNA-60", 96], ["RODAPE", 28], ["BOX-3000", 16], ["BOX-3500", 4], ["CUBO", 8], ["SAPATA", 4], ["PARAF", 260], ["TINTA-PRETA", 1]]),
  });
  const tenda10 = await criarProjeto(bruno, { nome: "Tenda 10×10 m", categoria: "Tenda", descricao: "Estrutura da tenda. Fechamentos laterais são sempre itens avulsos.", observacaoVersao: null, itens: bom([["TND-CANT", 8], ["TND-TRAV", 8], ["TND-PE", 8], ["TND-MASTRO", 1], ["TND-CABO", 8], ["TND-CALHA", 4], ["TND-LONA10", 1]]) });
  const tenda5 = await criarProjeto(bruno, { nome: "Tenda 5×5 m", categoria: "Tenda", descricao: null, observacaoVersao: null, itens: bom([["TND-CANT", 4], ["TND-TRAV", 4], ["TND-PE", 4], ["TND-MASTRO", 1], ["TND-CABO", 4], ["TND-LONA5", 1]]) });
  const balcao = await criarProjeto(bruno, { nome: "Balcão de credenciamento 2 m", categoria: "Balcão", descricao: "Balcão em MDF pintado, tampo de 2 m.", observacaoVersao: null, itens: bom([["MDF-15", 3], ["SARRAFO", 6], ["TAMPO-BAL", 1], ["TINTA-PRETA", 1]]) });
  const camarim = await criarProjeto(bruno, { nome: "Camarim 3×3 m", categoria: "Camarim", descricao: "Painéis em MDF 9 mm sobre estrutura de sarrafo, piso praticável.", observacaoVersao: null, itens: bom([["MDF-9", 8], ["SARRAFO", 24], ["PISO-MOD", 9], ["PERNA-60", 18]]) });

  /* ---------------------------------------------------------------- */
  /* Helpers de fluxo                                                   */
  /* ---------------------------------------------------------------- */
  type ItemSeed = { projetoId?: string; pecaCodigo?: string; livre?: string; qtd: number; destino?: string; just?: string; operacao?: "ADICIONAR" | "ALTERAR_QUANTIDADE" | "REMOVER"; eventoItemId?: string };
  async function solicitar(usuario: UsuarioAtual, eventoId: string, titulo: string | null, itens: ItemSeed[], enviar = true, observacao: string | null = null) {
    const s = await criarRascunho(usuario, eventoId);
    if (titulo || observacao) await atualizarCabecalho(usuario, s.id, { titulo, observacao });
    for (const i of itens) {
      await salvarItem(usuario, s.id, null, {
        operacao: i.operacao ?? "ADICIONAR",
        projetoId: i.projetoId ?? null,
        pecaId: i.pecaCodigo ? P(i.pecaCodigo) : null,
        descricaoLivre: i.livre ?? null,
        eventoItemId: i.eventoItemId ?? null,
        quantidadeSolicitada: i.qtd,
        destino: i.destino ?? null,
        justificativa: i.just ?? null,
      });
    }
    if (enviar) await enviarSolicitacao(usuario, s.id);
    return s.id;
  }
  async function responderTodos(usuario: UsuarioAtual, solicitacaoId: string, respostas: Array<{ status: "ATENDIDO" | "PARCIAL" | "NAO_ATENDIDO"; qtd?: number; obs?: string; pendencia?: boolean }>) {
    const s = await obterSolicitacao(usuario, solicitacaoId);
    for (let i = 0; i < s.itens.length && i < respostas.length; i++) {
      const r = respostas[i];
      await responderItem(usuario, s.itens[i].id, { status: r.status, quantidadeAtendida: r.qtd, observacaoLogistica: r.obs, pendenciaCompra: r.pendencia });
    }
  }
  const ev = (dados: Parameters<typeof criarEvento>[1]) => criarEvento(marina, dados);

  /* ---------------------------------------------------------------- */
  /* EVT-0001 — Festival Praia Sonora (ABERTO, cenário completo)        */
  /* ---------------------------------------------------------------- */
  const e1 = await ev({ nome: "Festival Praia Sonora 2026", cliente: "Prefeitura de Marítima", local: "Orla Norte — Arena de Areia", dataMontagem: d(9), dataInicio: d(12), dataFim: d(14), dataDesmontagem: d(15), dataReuniao: dt(-6, 14), dataCarga: d(8), responsavelId: marina.id });
  const s1a = await solicitar(paulo, e1.id, "Estruturas principais", [
    { projetoId: portico660.id, qtd: 2, destino: "Entrada norte e sul" },
    { projetoId: tenda10.id, qtd: 1, destino: "Área VIP" },
    { livre: "Fechamento de tenda", qtd: 4, destino: "GV", just: "Fechar a tenda VIP nos 4 lados" },
  ]);
  const s1b = await solicitar(julia, e1.id, "Ativação — palco e som", [
    { projetoId: torreSom.id, qtd: 4, destino: "PA principal (2) e delay (2)" },
    { projetoId: palco86.id, qtd: 1, destino: "Palco principal" },
  ]);
  const s1c = await solicitar(bruno, e1.id, "Balcões de credenciamento", [{ projetoId: balcao.id, qtd: 2, destino: "Credenciamento" }]);
  await transicionarEvento(marina, e1.id, "INICIAR_REUNIAO");
  await responderTodos(marina, s1a, [{ status: "ATENDIDO" }, { status: "ATENDIDO" }, { status: "PARCIAL", qtd: 3, obs: "Só 3 fechamentos disponíveis na data; o 4º depende de locação.", pendencia: true }]);
  await responderTodos(marina, s1b, [{ status: "PARCIAL", qtd: 3, obs: "Uma torre está comprometida com o Lançamento SUV Aurora no mesmo fim de semana.", pendencia: true }, { status: "ATENDIDO" }]);
  await responderTodos(rafael, s1c, [{ status: "ATENDIDO" }]);
  await incluirLinhaAta(marina, e1.id, { referenciaTipo: "PROJETO", projetoId: camarim.id, pecaId: null, descricaoLivre: null, quantidade: 2, destino: "Backstage", areaId: area("Atendimento").id, justificativa: null });
  await salvarObservacoesReuniao(marina, e1.id, "Participaram: Produção (Paulo), Ativação (Júlia), Cenografia (Bruno), Atendimento (Lúcia), Logística (Marina, Rafael).\nDecisões: pórtico sul pode ser substituído por 4 m se faltar box 3,5 m. Carga sai 1 dia antes da montagem.");
  await transicionarEvento(marina, e1.id, "FECHAR_ATA");
  // Alterações pós-ata
  const s1d = await solicitar(julia, e1.id, "Pórtico extra na área de ativação", [{ projetoId: portico4.id, qtd: 1, destino: "Ativação — acesso lateral", just: "Patrocinador confirmou espaço de ativação lateral." }]);
  await responderTodos(rafael, s1d, [{ status: "ATENDIDO" }]);
  const s1e = await solicitar(diego, e1.id, "Backdrops", [{ livre: "Painel backdrop 3×2 m em MDF", qtd: 2, destino: "Área de imprensa", just: "Fotos oficiais com patrocinadores." }], true, "Fotos oficiais com patrocinadores; material chega dia 24.");
  const linhasE1 = await obterLinhasAta(e1.id);
  const linhaCamarim = linhasE1.find((l) => l.projeto?.nome === "Camarim 3×3 m")!;
  const s1f = await solicitar(lucia, e1.id, "Camarim adicional", [{ operacao: "ALTERAR_QUANTIDADE", eventoItemId: linhaCamarim.id, qtd: 3, just: "Artista principal pediu camarim exclusivo." }]);
  await devolverSolicitacao(marina, s1f, "Confirme com a produção se o terceiro camarim cabe no backstage antes de reenviar");
  const linhaFech = linhasE1.find((l) => l.descricaoLivre === "Fechamento de tenda")!;
  await solicitar(ana, e1.id, "Revisão dos fechamentos", [{ operacao: "REMOVER", eventoItemId: linhaFech.id, qtd: 0, just: "Cliente desistiu do fechamento lateral." }], false);
  const linhaTenda = linhasE1.find((l) => l.projeto?.nome === "Tenda 10×10 m")!;
  await alterarQuantidadeLinha(marina, e1.id, linhaTenda.id, 2, "Cliente aprovou segunda tenda VIP por telefone; produção confirmará por solicitação formal.");
  // Deixa a solicitação da Gráfica atrasada
  await db.update(solicitacoes).set({ enviadaEm: dt(-3, 9), prazoRespostaEm: dt(-1, 9) }).where(eq(solicitacoes.id, s1e));

  /* ---------------------------------------------------------------- */
  /* EVT-0002 — Convenção TechNorte (PREPARACAO, reunião em 2 dias)     */
  /* ---------------------------------------------------------------- */
  const e2 = await ev({ nome: "Convenção Anual TechNorte", cliente: "TechNorte S.A.", local: "Centro de Convenções — Pavilhão B", dataMontagem: d(18), dataInicio: d(20), dataFim: d(21), dataDesmontagem: d(22), dataReuniao: dt(2, 14), dataCarga: null, responsavelId: rafael.id });
  await solicitar(paulo, e2.id, "Acessos e credenciamento", [{ projetoId: portico4.id, qtd: 1, destino: "Entrada principal" }, { projetoId: balcao.id, qtd: 3, destino: "Credenciamento" }], true, "Credenciamento abre às 7h; balcões precisam estar prontos na véspera.");
  await solicitar(lucia, e2.id, "Sala de palestrantes", [{ projetoId: camarim.id, qtd: 1, destino: "Sala de palestrantes" }]);
  await solicitar(julia, e2.id, "Ativações no foyer", [{ projetoId: tenda5.id, qtd: 2, destino: "Foyer" }], false);

  /* ---------------------------------------------------------------- */
  /* EVT-0003 — Lançamento SUV Aurora (EM_REUNIAO, reunião hoje)        */
  /* ---------------------------------------------------------------- */
  const e3 = await ev({ nome: "Lançamento SUV Aurora", cliente: "Aurora Motors", local: "Autódromo — Boxes", dataMontagem: d(11), dataInicio: d(13), dataFim: d(13), dataDesmontagem: d(14), dataReuniao: dt(0, 9), dataCarga: d(10), responsavelId: marina.id });
  const s3a = await solicitar(paulo, e3.id, "Palco de revelação", [{ projetoId: palco86.id, qtd: 1, destino: "Box 1" }, { projetoId: torreSom.id, qtd: 2, destino: "Laterais do palco" }]);
  const s3b = await solicitar(julia, e3.id, "Test-drive", [{ projetoId: tenda10.id, qtd: 1, destino: "Pit lane" }, { livre: "Fechamento de tenda", qtd: 2, destino: "Pit lane — lado da pista" }]);
  await transicionarEvento(marina, e3.id, "INICIAR_REUNIAO");
  await responderTodos(marina, s3a, [{ status: "ATENDIDO" }, { status: "ATENDIDO" }]);
  const s3bObj = await obterSolicitacao(marina, s3b);
  await responderItem(marina, s3bObj.itens[0].id, { status: "ATENDIDO" });

  /* ---------------------------------------------------------------- */
  /* EVT-0004 — Feira Gastronômica (ENCERRADO, futuro)                  */
  /* ---------------------------------------------------------------- */
  const e4 = await ev({ nome: "Feira Gastronômica Sabores do Norte", cliente: "Associação Comercial", local: "Praça Central", dataMontagem: d(5), dataInicio: d(6), dataFim: d(7), dataDesmontagem: d(8), dataReuniao: dt(-9, 14), dataCarga: d(4), responsavelId: rafael.id });
  const s4a = await solicitar(paulo, e4.id, "Tendas dos expositores", [{ projetoId: tenda5.id, qtd: 6, destino: "Alas A e B" }, { projetoId: tenda10.id, qtd: 1, destino: "Praça de alimentação" }]);
  const s4b = await solicitar(bruno, e4.id, "Balcões dos expositores", [{ projetoId: balcao.id, qtd: 4, destino: "Expositores" }]);
  await transicionarEvento(rafael, e4.id, "INICIAR_REUNIAO");
  await responderTodos(rafael, s4a, [{ status: "ATENDIDO" }, { status: "NAO_ATENDIDO", obs: "Lona 10×10 comprometida com o Festival Praia Sonora. Use duas 5×5 unidas.", pendencia: false }]);
  await responderTodos(rafael, s4b, [{ status: "ATENDIDO" }]);
  await transicionarEvento(rafael, e4.id, "FECHAR_ATA");
  const s4c = await solicitar(paulo, e4.id, "Mais duas tendas", [{ projetoId: tenda5.id, qtd: 2, destino: "Ala C" }]);
  await responderTodos(rafael, s4c, [{ status: "ATENDIDO" }]);
  await transicionarEvento(rafael, e4.id, "ENCERRAR");

  /* ---------------------------------------------------------------- */
  /* EVT-0005 — Corrida Noturna Lumen (reaberto em exceção)             */
  /* ---------------------------------------------------------------- */
  const e5 = await ev({ nome: "Corrida Noturna Lumen", cliente: "Lumen Esportes", local: "Parque das Águas", dataMontagem: d(3), dataInicio: d(4), dataFim: d(4), dataDesmontagem: d(5), dataReuniao: dt(-12, 14), dataCarga: d(2), responsavelId: marina.id });
  const s5a = await solicitar(julia, e5.id, "Largada e chegada", [{ projetoId: portico660.id, qtd: 1, destino: "Largada" }, { projetoId: portico4.id, qtd: 1, destino: "Chegada" }, { projetoId: torreSom.id, qtd: 2, destino: "Largada" }]);
  await transicionarEvento(marina, e5.id, "INICIAR_REUNIAO");
  await responderTodos(marina, s5a, [{ status: "ATENDIDO" }, { status: "ATENDIDO" }, { status: "ATENDIDO" }]);
  await transicionarEvento(marina, e5.id, "FECHAR_ATA");
  await transicionarEvento(marina, e5.id, "ENCERRAR");
  await transicionarEvento(helena, e5.id, "REABRIR", "Patrocinador master entrou na última hora e exige pórtico exclusivo na chegada. Aprovado pela direção.");
  await solicitar(julia, e5.id, "Pórtico do patrocinador", [{ projetoId: portico660.id, qtd: 1, destino: "Chegada — patrocinador", just: "Exigência contratual do patrocinador master." }]);

  /* ---------------------------------------------------------------- */
  /* EVT-0006 — Ativação Shopping Boulevard (CANCELADO)                 */
  /* ---------------------------------------------------------------- */
  const e6 = await ev({ nome: "Ativação Shopping Boulevard", cliente: "Boulevard Mall", local: "Praça de eventos do shopping", dataMontagem: d(25), dataInicio: d(26), dataFim: d(28), dataDesmontagem: d(29), dataReuniao: dt(4, 14), dataCarga: null, responsavelId: rafael.id });
  await solicitar(julia, e6.id, "Tenda de ativação", [{ projetoId: tenda5.id, qtd: 1 }]);
  await transicionarEvento(rafael, e6.id, "CANCELAR", "Cliente adiou a ativação para o próximo trimestre; novo evento será criado.");

  /* ---------------------------------------------------------------- */
  /* EVT-0007 / EVT-0008 — Realizados (ENCERRADO com datas passadas)    */
  /* ---------------------------------------------------------------- */
  for (const [nome, cliente, local, ini, titulo] of [
    ["Encontro de Franqueados Vitta", "Vitta Franquias", "Hotel Costa Verde — Salão Atlântico", -20, "Palco e recepção"],
    ["Arena Games Weekend", "PlayNorte", "Ginásio Municipal", -34, "Arena principal"],
  ] as const) {
    const e = await ev({ nome, cliente, local, dataMontagem: d(ini - 1), dataInicio: d(ini), dataFim: d(ini + 1), dataDesmontagem: d(ini + 2), dataReuniao: dt(ini - 8, 14), dataCarga: d(ini - 2), responsavelId: marina.id });
    const s = await solicitar(paulo, e.id, titulo, [{ projetoId: palco86.id, qtd: 1, destino: "Palco" }, { projetoId: balcao.id, qtd: 2, destino: "Recepção" }, { projetoId: torreSom.id, qtd: 2 }]);
    await transicionarEvento(marina, e.id, "INICIAR_REUNIAO");
    await responderTodos(marina, s, [{ status: "ATENDIDO" }, { status: "ATENDIDO" }, { status: "ATENDIDO" }]);
    await transicionarEvento(marina, e.id, "FECHAR_ATA");
    await transicionarEvento(marina, e.id, "ENCERRAR");
  }

  /* ---------------------------------------------------------------- */
  /* EVT-0009 — Semana da Música Urbana (PREPARACAO, sem envios)        */
  /* ---------------------------------------------------------------- */
  await ev({ nome: "Semana da Música Urbana", cliente: "Secretaria de Cultura", local: "Largo do Mercado", dataMontagem: d(30), dataInicio: d(32), dataFim: d(36), dataDesmontagem: d(37), dataReuniao: dt(6, 14), dataCarga: null, responsavelId: marina.id });

  /* ---------------------------------------------------------------- */
  /* Nova versão de projeto após uso (atas antigas ficam na v1)         */
  /* ---------------------------------------------------------------- */
  await editarProjeto(bruno, portico660.id, {
    nome: "Pórtico boca 6,60m",
    categoria: "Pórtico",
    descricao: "Pórtico de entrada em box truss, vão livre de 6,60 m e 4 m de altura.",
    observacaoVersao: "Incluídas 2 sapatas e 4 contrapesos após revisão de segurança.",
    itens: bom([["BOX-400", 1], ["BOX-600", 5], ["BOX-700", 1], ["BOX-3000", 10], ["BOX-3500", 2], ["CUBO", 10], ["GRAPPLE", 1], ["PARAF", 132], ["SAPATA", 2], ["CONTRAPESO", 4]]),
  });

  /* ---------------------------------------------------------------- */
  /* Acessos, usuário inativo e notificações                            */
  /* ---------------------------------------------------------------- */
  await db.update(usuarios).set({ ativo: false }).where(eq(usuarios.email, "tiago.moreira@nortemkt.com.br"));
  const horasDesdeAcesso: Array<[string, number]> = [
    ["marina.castro@nortemkt.com.br", 4],
    ["rafael.nunes@nortemkt.com.br", 4.3],
    ["helena.prado@nortemkt.com.br", 17],
    ["bruno.tavares@nortemkt.com.br", 2.5],
    ["carla.mendes@nortemkt.com.br", 144],
    ["paulo.ribeiro@nortemkt.com.br", 3.3],
    ["ana.lima@nortemkt.com.br", 50],
    ["julia.fontes@nortemkt.com.br", 20],
    ["tiago.moreira@nortemkt.com.br", 24 * 62],
    ["diego.sampaio@nortemkt.com.br", 74],
    ["lucia.barros@nortemkt.com.br", 72],
    ["admin@nortemkt.com.br", 2],
  ];
  for (const [email, horas] of horasDesdeAcesso) {
    await db.update(usuarios).set({ ultimoAcessoEm: new Date(Date.now() - horas * 3_600_000) }).where(eq(usuarios.email, email));
  }

  // Mantém só as 6 notificações mais recentes de cada usuário como não lidas (demonstração).
  await db.execute(sql`update notificacoes set lida_em = now() where id in (
    select id from (select id, row_number() over (partition by usuario_id order by criado_em desc) as rn from notificacoes) t where t.rn > 6)`);
  await marcarTodasLidas(helena);

  const [{ np }] = await db.select({ np: sql<number>`count(*)` }).from(projetos);
  console.log(`Seed concluído: ${usersRows.length} usuários, ${pecasRows.length} peças, ${np} projetos, 9 eventos. Senha de todos: ${SENHA}`);
  await conn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
