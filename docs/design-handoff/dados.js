// Dados de demonstração derivados de scripts/seed.ts do repositório infra-csc/Planejamento-Eventos.
// Datas ancoradas em 2026-09-14 (mesmos offsets do seed).

export const AREAS = ["Produção", "Cenografia", "Ativação", "Gráfica", "Atendimento", "Logística"];

export const USUARIOS = [
  { id: "u1", nome: "Marina Castro", email: "marina.castro@nortemkt.com.br", perfil: "LOGISTICA", area: "Logística" },
  { id: "u2", nome: "Paulo Ribeiro", email: "paulo.ribeiro@nortemkt.com.br", perfil: "REQUISITANTE", area: "Produção" },
  { id: "u3", nome: "Helena Prado", email: "helena.prado@nortemkt.com.br", perfil: "GESTAO", area: null },
  { id: "u4", nome: "Bruno Tavares", email: "bruno.tavares@nortemkt.com.br", perfil: "CENOGRAFIA", area: "Cenografia" },
  { id: "u5", nome: "Administrador do Sistema", email: "admin@nortemkt.com.br", perfil: "ADMIN", area: null },
];

export const PERFIL_LABEL = { REQUISITANTE: "Requisitante", CENOGRAFIA: "Cenografia", LOGISTICA: "Logística", GESTAO: "Gestão", ADMIN: "Administrador" };

export const EVENTO_STATUS_LABEL = { PREPARACAO: "Em preparação", EM_REUNIAO: "Em reunião", ABERTO: "Aberto a alterações", ENCERRADO: "Encerrado", CANCELADO: "Cancelado", REALIZADO: "Realizado" };
export const EVENTO_STATUS_DESCRICAO = {
  PREPARACAO: "As áreas registram necessidades até a reunião de OS.",
  EM_REUNIAO: "A logística está consolidando a ata. Envios pausados.",
  ABERTO: "Ata fechada. Alterações entram como solicitações respondidas por item.",
  ENCERRADO: "Encerrado pela logística. Nenhuma solicitação nova é aceita.",
  CANCELADO: "Evento cancelado.",
};
export const SOLICITACAO_STATUS_LABEL = { RASCUNHO: "Rascunho", ENVIADA: "Enviada", EM_ANALISE: "Em análise", RESPONDIDA: "Respondida", DEVOLVIDA: "Devolvida", CANCELADA: "Cancelada" };
export const SOLICITACAO_TIPO_LABEL = { PRE_REUNIAO: "Necessidade pré-reunião", ALTERACAO: "Alteração pós-ata" };
export const ITEM_STATUS_LABEL = { EM_ANALISE: "Em análise", ATENDIDO: "Atendido", PARCIAL: "Atendido parcialmente", NAO_ATENDIDO: "Não atendido" };
export const ITEM_OPERACAO_LABEL = { ADICIONAR: "Adicionar", ALTERAR_QUANTIDADE: "Alterar quantidade", REMOVER: "Remover" };
export const SETOR_LABEL = { ESTRUTURA: "Estrutura (box truss)", TENDA: "Tendas", MARCENARIA: "Marcenaria" };

export const EVENTOS = [
  {
    id: "e1", codigo: "EVT-0001", nome: "Festival Praia Sonora 2026", cliente: "Prefeitura de Marítima", local: "Orla Norte — Arena de Areia",
    status: "ABERTO", responsavel: "Marina Castro", montagem: "2026-09-23", inicio: "2026-09-26", fim: "2026-09-28", desmontagem: "2026-09-29",
    reuniao: "2026-09-08T14:00", carga: "2026-09-22", ataFechada: "2026-09-08T17:20", encerrado: null, reaberto: 0,
    linhasAta: 8, solicitacoesAbertas: 1, respondidas: 4, versoesOs: 4,
  },
  {
    id: "e3", codigo: "EVT-0003", nome: "Lançamento SUV Aurora", cliente: "Aurora Motors", local: "Autódromo — Boxes",
    status: "EM_REUNIAO", responsavel: "Marina Castro", montagem: "2026-09-25", inicio: "2026-09-27", fim: "2026-09-27", desmontagem: "2026-09-28",
    reuniao: "2026-09-14T09:00", carga: "2026-09-24", ataFechada: null, encerrado: null, reaberto: 0,
    linhasAta: 3, solicitacoesAbertas: 1, respondidas: 1, versoesOs: 0,
  },
  {
    id: "e5", codigo: "EVT-0005", nome: "Corrida Noturna Lumen", cliente: "Lumen Esportes", local: "Parque das Águas",
    status: "ABERTO", responsavel: "Marina Castro", montagem: "2026-09-17", inicio: "2026-09-18", fim: "2026-09-18", desmontagem: "2026-09-19",
    reuniao: "2026-09-02T14:00", carga: "2026-09-16", ataFechada: "2026-09-02T16:40", encerrado: null, reaberto: 1,
    linhasAta: 4, solicitacoesAbertas: 1, respondidas: 1, versoesOs: 4,
  },
  {
    id: "e2", codigo: "EVT-0002", nome: "Convenção Anual TechNorte", cliente: "TechNorte S.A.", local: "Centro de Convenções — Pavilhão B",
    status: "PREPARACAO", responsavel: "Rafael Nunes", montagem: "2026-10-02", inicio: "2026-10-04", fim: "2026-10-05", desmontagem: "2026-10-06",
    reuniao: "2026-09-16T14:00", carga: null, ataFechada: null, encerrado: null, reaberto: 0,
    linhasAta: 0, solicitacoesAbertas: 2, respondidas: 0, versoesOs: 0,
  },
  {
    id: "e9", codigo: "EVT-0009", nome: "Semana da Música Urbana", cliente: "Secretaria de Cultura", local: "Largo do Mercado",
    status: "PREPARACAO", responsavel: "Marina Castro", montagem: "2026-10-14", inicio: "2026-10-16", fim: "2026-10-20", desmontagem: "2026-10-21",
    reuniao: "2026-09-20T14:00", carga: null, ataFechada: null, encerrado: null, reaberto: 0,
    linhasAta: 0, solicitacoesAbertas: 0, respondidas: 0, versoesOs: 0,
  },
  {
    id: "e4", codigo: "EVT-0004", nome: "Feira Gastronômica Sabores do Norte", cliente: "Associação Comercial", local: "Praça Central",
    status: "ENCERRADO", responsavel: "Rafael Nunes", montagem: "2026-09-19", inicio: "2026-09-20", fim: "2026-09-21", desmontagem: "2026-09-22",
    reuniao: "2026-09-05T14:00", carga: "2026-09-18", ataFechada: "2026-09-05T17:05", encerrado: "2026-09-11T11:30", reaberto: 0,
    linhasAta: 4, solicitacoesAbertas: 0, respondidas: 3, versoesOs: 3,
  },
  {
    id: "e6", codigo: "EVT-0006", nome: "Ativação Shopping Boulevard", cliente: "Boulevard Mall", local: "Praça de eventos do shopping",
    status: "CANCELADO", responsavel: "Rafael Nunes", montagem: "2026-10-09", inicio: "2026-10-10", fim: "2026-10-12", desmontagem: "2026-10-13",
    reuniao: "2026-09-18T14:00", carga: null, ataFechada: null, encerrado: null, reaberto: 0,
    linhasAta: 0, solicitacoesAbertas: 0, respondidas: 0, versoesOs: 0,
  },
  {
    id: "e7", codigo: "EVT-0007", nome: "Encontro de Franqueados Vitta", cliente: "Vitta Franquias", local: "Hotel Costa Verde — Salão Atlântico",
    status: "ENCERRADO", responsavel: "Marina Castro", montagem: "2026-08-24", inicio: "2026-08-25", fim: "2026-08-26", desmontagem: "2026-08-27",
    reuniao: "2026-08-17T14:00", carga: "2026-08-23", ataFechada: "2026-08-17T16:10", encerrado: "2026-08-22T09:00", reaberto: 0,
    linhasAta: 3, solicitacoesAbertas: 0, respondidas: 1, versoesOs: 3,
  },
  {
    id: "e8", codigo: "EVT-0008", nome: "Arena Games Weekend", cliente: "PlayNorte", local: "Ginásio Municipal",
    status: "ENCERRADO", responsavel: "Marina Castro", montagem: "2026-08-10", inicio: "2026-08-11", fim: "2026-08-12", desmontagem: "2026-08-13",
    reuniao: "2026-08-03T14:00", carga: "2026-08-09", ataFechada: "2026-08-03T16:00", encerrado: "2026-08-08T10:00", reaberto: 0,
    linhasAta: 3, solicitacoesAbertas: 0, respondidas: 1, versoesOs: 3,
  },
];

export const SOLICITACOES = [
  {
    id: "s1e", codigo: "SOL-0011", eventoId: "e1", evento: "Festival Praia Sonora 2026", area: "Gráfica", tipo: "ALTERACAO", status: "ENVIADA",
    titulo: "Backdrops", autor: "Diego Sampaio", criadoEm: "2026-09-11T09:00", enviadaEm: "2026-09-11T09:00", prazo: "2026-09-13T09:00", respondidaEm: null, atualizadoEm: "2026-09-11T09:00",
    observacao: "Fotos oficiais com patrocinadores; material chega dia 24.",
    itens: [
      { id: "i1", descricao: "Painel backdrop 3×2 m em MDF", operacao: "ADICIONAR", ref: "AVULSO", solicitada: 2, destino: "Área de imprensa", justificativa: "Fotos oficiais com patrocinadores.", status: "EM_ANALISE", atendida: null, obs: null, pendencia: false, respondidoPor: null, respondidoEm: null },
    ],
  },
  {
    id: "s5b", codigo: "SOL-0014", eventoId: "e5", evento: "Corrida Noturna Lumen", area: "Ativação", tipo: "ALTERACAO", status: "ENVIADA",
    titulo: "Pórtico do patrocinador", autor: "Júlia Fontes", criadoEm: "2026-09-13T15:20", enviadaEm: "2026-09-13T15:30", prazo: "2026-09-15T15:30", respondidaEm: null, atualizadoEm: "2026-09-13T15:30",
    observacao: null,
    itens: [
      { id: "i2", descricao: "Pórtico boca 6,60m (v2)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 1, destino: "Chegada — patrocinador", justificativa: "Exigência contratual do patrocinador master.", status: "EM_ANALISE", atendida: null, obs: null, pendencia: false, respondidoPor: null, respondidoEm: null },
    ],
  },
  {
    id: "s3b", codigo: "SOL-0008", eventoId: "e3", evento: "Lançamento SUV Aurora", area: "Ativação", tipo: "PRE_REUNIAO", status: "EM_ANALISE",
    titulo: "Test-drive", autor: "Júlia Fontes", criadoEm: "2026-09-10T11:00", enviadaEm: "2026-09-10T11:10", prazo: "2026-09-14T11:10", respondidaEm: null, atualizadoEm: "2026-09-14T09:25",
    observacao: null,
    itens: [
      { id: "i3", descricao: "Tenda 10×10 m (v1)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 1, destino: "Pit lane", justificativa: null, status: "ATENDIDO", atendida: 1, obs: null, pendencia: false, respondidoPor: "Marina Castro", respondidoEm: "2026-09-14T09:25" },
      { id: "i4", descricao: "Fechamento de tenda", operacao: "ADICIONAR", ref: "AVULSO", solicitada: 2, destino: "Pit lane — lado da pista", justificativa: null, status: "EM_ANALISE", atendida: null, obs: null, pendencia: false, respondidoPor: null, respondidoEm: null },
    ],
  },
  {
    id: "s2a", codigo: "SOL-0005", eventoId: "e2", evento: "Convenção Anual TechNorte", area: "Produção", tipo: "PRE_REUNIAO", status: "ENVIADA",
    titulo: "Acessos e credenciamento", autor: "Paulo Ribeiro", criadoEm: "2026-09-12T08:40", enviadaEm: "2026-09-12T08:55", prazo: "2026-09-16T14:00", respondidaEm: null, atualizadoEm: "2026-09-12T08:55",
    observacao: "Credenciamento abre às 7h; balcões precisam estar prontos na véspera.",
    itens: [
      { id: "i5", descricao: "Pórtico boca 4m (v1)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 1, destino: "Entrada principal", justificativa: null, status: "EM_ANALISE", atendida: null, obs: null, pendencia: false, respondidoPor: null, respondidoEm: null },
      { id: "i6", descricao: "Balcão de credenciamento 2 m (v1)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 3, destino: "Credenciamento", justificativa: null, status: "EM_ANALISE", atendida: null, obs: null, pendencia: false, respondidoPor: null, respondidoEm: null },
    ],
  },
  {
    id: "s2b", codigo: "SOL-0006", eventoId: "e2", evento: "Convenção Anual TechNorte", area: "Atendimento", tipo: "PRE_REUNIAO", status: "ENVIADA",
    titulo: null, autor: "Lúcia Barros", criadoEm: "2026-09-12T10:00", enviadaEm: "2026-09-12T10:05", prazo: "2026-09-16T14:00", respondidaEm: null, atualizadoEm: "2026-09-12T10:05",
    observacao: null,
    itens: [
      { id: "i7", descricao: "Camarim 3×3 m (v1)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 1, destino: "Sala de palestrantes", justificativa: null, status: "EM_ANALISE", atendida: null, obs: null, pendencia: false, respondidoPor: null, respondidoEm: null },
    ],
  },
  {
    id: "s1f", codigo: "SOL-0012", eventoId: "e1", evento: "Festival Praia Sonora 2026", area: "Atendimento", tipo: "ALTERACAO", status: "DEVOLVIDA",
    titulo: "Camarim adicional", autor: "Lúcia Barros", criadoEm: "2026-09-10T16:00", enviadaEm: "2026-09-10T16:10", prazo: null, respondidaEm: null, atualizadoEm: "2026-09-11T08:30",
    devolvidaMotivo: "Confirme com a produção se o terceiro camarim cabe no backstage antes de reenviar",
    observacao: null,
    itens: [
      { id: "i8", descricao: "Camarim 3×3 m (v1)", operacao: "ALTERAR_QUANTIDADE", ref: "ATA", solicitada: 3, atual: 2, destino: "Backstage", justificativa: "Artista principal pediu camarim exclusivo.", status: "EM_ANALISE", atendida: null, obs: null, pendencia: false, respondidoPor: null, respondidoEm: null },
    ],
  },
  {
    id: "s1g", codigo: "SOL-0013", eventoId: "e1", evento: "Festival Praia Sonora 2026", area: "Produção", tipo: "ALTERACAO", status: "RASCUNHO",
    titulo: "Revisão dos fechamentos", autor: "Ana Lima", criadoEm: "2026-09-12T14:00", enviadaEm: null, prazo: null, respondidaEm: null, atualizadoEm: "2026-09-12T14:20",
    observacao: null,
    itens: [
      { id: "i9", descricao: "Fechamento de tenda", operacao: "REMOVER", ref: "ATA", solicitada: 0, atual: 3, destino: "GV", justificativa: "Cliente desistiu do fechamento lateral.", status: "EM_ANALISE", atendida: null, obs: null, pendencia: false, respondidoPor: null, respondidoEm: null },
    ],
  },
  {
    id: "s1a", codigo: "SOL-0001", eventoId: "e1", evento: "Festival Praia Sonora 2026", area: "Produção", tipo: "PRE_REUNIAO", status: "RESPONDIDA",
    titulo: "Estruturas principais", autor: "Paulo Ribeiro", criadoEm: "2026-09-04T09:00", enviadaEm: "2026-09-04T09:30", prazo: "2026-09-08T14:00", respondidaEm: "2026-09-08T15:10", atualizadoEm: "2026-09-08T15:10",
    observacao: null,
    itens: [
      { id: "i10", descricao: "Pórtico boca 6,60m (v1)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 2, destino: "Entrada norte e sul", justificativa: null, status: "ATENDIDO", atendida: 2, obs: null, pendencia: false, respondidoPor: "Marina Castro", respondidoEm: "2026-09-08T15:02" },
      { id: "i11", descricao: "Tenda 10×10 m (v1)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 1, destino: "Área VIP", justificativa: null, status: "ATENDIDO", atendida: 1, obs: null, pendencia: false, respondidoPor: "Marina Castro", respondidoEm: "2026-09-08T15:05" },
      { id: "i12", descricao: "Fechamento de tenda", operacao: "ADICIONAR", ref: "AVULSO", solicitada: 4, destino: "GV", justificativa: "Fechar a tenda VIP nos 4 lados", status: "PARCIAL", atendida: 3, obs: "Só 3 fechamentos disponíveis na data; o 4º depende de locação.", pendencia: true, respondidoPor: "Marina Castro", respondidoEm: "2026-09-08T15:10" },
    ],
  },
  {
    id: "s1b", codigo: "SOL-0002", eventoId: "e1", evento: "Festival Praia Sonora 2026", area: "Ativação", tipo: "PRE_REUNIAO", status: "RESPONDIDA",
    titulo: "Ativação — palco e som", autor: "Júlia Fontes", criadoEm: "2026-09-04T11:00", enviadaEm: "2026-09-04T11:20", prazo: "2026-09-08T14:00", respondidaEm: "2026-09-08T15:20", atualizadoEm: "2026-09-08T15:20",
    observacao: null,
    itens: [
      { id: "i13", descricao: "Torre de som 4m (v1)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 4, destino: "PA principal (2) e delay (2)", justificativa: null, status: "PARCIAL", atendida: 3, obs: "Uma torre está comprometida com o Lançamento SUV Aurora no mesmo fim de semana.", pendencia: true, respondidoPor: "Marina Castro", respondidoEm: "2026-09-08T15:18" },
      { id: "i14", descricao: "Palco 8×6 m com cobertura (v1)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 1, destino: "Palco principal", justificativa: null, status: "ATENDIDO", atendida: 1, obs: null, pendencia: false, respondidoPor: "Marina Castro", respondidoEm: "2026-09-08T15:20" },
    ],
  },
  {
    id: "s1d", codigo: "SOL-0010", eventoId: "e1", evento: "Festival Praia Sonora 2026", area: "Ativação", tipo: "ALTERACAO", status: "RESPONDIDA",
    titulo: "Pórtico extra na área de ativação", autor: "Júlia Fontes", criadoEm: "2026-09-09T10:00", enviadaEm: "2026-09-09T10:15", prazo: "2026-09-11T10:15", respondidaEm: "2026-09-09T17:40", atualizadoEm: "2026-09-09T17:40",
    observacao: null,
    itens: [
      { id: "i15", descricao: "Pórtico boca 4m (v1)", operacao: "ADICIONAR", ref: "PROJETO", solicitada: 1, destino: "Ativação — acesso lateral", justificativa: "Patrocinador confirmou espaço de ativação lateral.", status: "ATENDIDO", atendida: 1, obs: null, pendencia: false, respondidoPor: "Rafael Nunes", respondidoEm: "2026-09-09T17:40" },
    ],
  },
];

// Ata do Festival Praia Sonora (e1)
export const ATA_E1 = [
  { id: "l1", tipo: "PROJETO", descricao: "Pórtico boca 6,60m", versao: 1, versaoDefasada: true, quantidade: 2, destino: "Entrada norte e sul", area: "Produção", origem: "SOL-0001", setor: "ESTRUTURA" },
  { id: "l2", tipo: "PROJETO", descricao: "Tenda 10×10 m", versao: 1, versaoDefasada: false, quantidade: 2, destino: "Área VIP", area: "Produção", origem: "Ajuste da logística", setor: "TENDA" },
  { id: "l3", tipo: "AVULSO", descricao: "Fechamento de tenda", versao: null, versaoDefasada: false, quantidade: 3, destino: "GV", area: "Produção", origem: "SOL-0001 (parcial)", setor: null },
  { id: "l4", tipo: "PROJETO", descricao: "Torre de som 4m", versao: 1, versaoDefasada: false, quantidade: 3, destino: "PA principal e delay", area: "Ativação", origem: "SOL-0002 (parcial)", setor: "ESTRUTURA" },
  { id: "l5", tipo: "PROJETO", descricao: "Palco 8×6 m com cobertura", versao: 1, versaoDefasada: false, quantidade: 1, destino: "Palco principal", area: "Ativação", origem: "SOL-0002", setor: "MARCENARIA" },
  { id: "l6", tipo: "PROJETO", descricao: "Balcão de credenciamento 2 m", versao: 1, versaoDefasada: false, quantidade: 2, destino: "Credenciamento", area: "Cenografia", origem: "SOL-0003", setor: "MARCENARIA" },
  { id: "l7", tipo: "PROJETO", descricao: "Camarim 3×3 m", versao: 1, versaoDefasada: false, quantidade: 2, destino: "Backstage", area: "Atendimento", origem: "Incluída na reunião", setor: "MARCENARIA" },
  { id: "l8", tipo: "PROJETO", descricao: "Pórtico boca 4m", versao: 1, versaoDefasada: false, quantidade: 1, destino: "Ativação — acesso lateral", area: "Ativação", origem: "SOL-0010", setor: "ESTRUTURA" },
];

export const OBSERVACOES_E1 = "Participaram: Produção (Paulo), Ativação (Júlia), Cenografia (Bruno), Atendimento (Lúcia), Logística (Marina, Rafael).\nDecisões: pórtico sul pode ser substituído por 4 m se faltar box 3,5 m. Carga sai 1 dia antes da montagem.";

// OS atual do e1, por setor
export const OS_E1 = [
  {
    setor: "ESTRUTURA",
    linhas: [
      { codigo: "BOX-3000", nome: "Box truss — trecho 3 m", unidade: "un", total: 46, origens: "Pórtico boca 6,60m × 2 → 20 · Torre de som 4m × 3 → 6 · Palco 8×6 m × 1 → 16 · Pórtico boca 4m × 1 → 4" },
      { codigo: "BOX-3500", nome: "Box truss — trecho 3,5 m", unidade: "un", total: 8, origens: "Pórtico boca 6,60m × 2 → 4 · Palco 8×6 m × 1 → 4" },
      { codigo: "BOX-400", nome: "Box truss 400 mm — trecho 1 m", unidade: "un", total: 2, origens: "Pórtico boca 6,60m × 2 → 2" },
      { codigo: "BOX-600", nome: "Box truss 600 mm — trecho 1,5 m", unidade: "un", total: 20, origens: "Pórtico boca 6,60m × 2 → 10 · Torre de som 4m × 3 → 6 · Pórtico boca 4m × 1 → 4" },
      { codigo: "BOX-700", nome: "Box truss 700 mm — trecho 2 m", unidade: "un", total: 2, origens: "Pórtico boca 6,60m × 2 → 2" },
      { codigo: "CONTRAPESO", nome: "Contrapeso 25 kg", unidade: "un", total: 12, origens: "Torre de som 4m × 3 → 12" },
      { codigo: "CUBO", nome: "Cubo de conexão 4 faces", unidade: "un", total: 38, origens: "Pórtico boca 6,60m × 2 → 20 · Torre de som 4m × 3 → 6 · Palco 8×6 m × 1 → 8 · Pórtico boca 4m × 1 → 4" },
      { codigo: "GRAPPLE", nome: "Grapple (esticador de cabo)", unidade: "un", total: 2, origens: "Pórtico boca 6,60m × 2 → 2" },
      { codigo: "PARAF", nome: "Parafuso M12 com porca e arruela", unidade: "un", total: 708, origens: "Pórtico boca 6,60m × 2 → 264 · Torre de som 4m × 3 → 120 · Palco 8×6 m × 1 → 260 · Pórtico boca 4m × 1 → 64" },
      { codigo: "SAPATA", nome: "Sapata de base 40×40", unidade: "un", total: 9, origens: "Torre de som 4m × 3 → 3 · Palco 8×6 m × 1 → 4 · Pórtico boca 4m × 1 → 2" },
      { codigo: "TALHA", nome: "Talha manual 1 t", unidade: "un", total: 3, origens: "Torre de som 4m × 3 → 3" },
    ],
  },
  {
    setor: "TENDA",
    linhas: [
      { codigo: "TND-CABO", nome: "Cabo de aço 6 mm — 10 m", unidade: "un", total: 16, origens: "Tenda 10×10 m × 2 → 16" },
      { codigo: "TND-CALHA", nome: "Calha de união 5 m", unidade: "un", total: 8, origens: "Tenda 10×10 m × 2 → 8" },
      { codigo: "TND-CANT", nome: "Cantoneira de tenda", unidade: "un", total: 16, origens: "Tenda 10×10 m × 2 → 16" },
      { codigo: "TND-LONA10", nome: "Lona de cobertura 10×10", unidade: "un", total: 2, origens: "Tenda 10×10 m × 2 → 2" },
      { codigo: "TND-MASTRO", nome: "Mastro central", unidade: "un", total: 2, origens: "Tenda 10×10 m × 2 → 2" },
      { codigo: "TND-PE", nome: "Pé de tenda 3 m", unidade: "un", total: 16, origens: "Tenda 10×10 m × 2 → 16" },
      { codigo: "TND-TRAV", nome: "Travessa de tenda 5 m", unidade: "un", total: 16, origens: "Tenda 10×10 m × 2 → 16" },
    ],
  },
  {
    setor: "MARCENARIA",
    linhas: [
      { codigo: "MDF-15", nome: "Chapa MDF 15 mm 2,75×1,85", unidade: "un", total: 6, origens: "Balcão de credenciamento 2 m × 2 → 6" },
      { codigo: "MDF-9", nome: "Chapa MDF 9 mm 2,75×1,85", unidade: "un", total: 16, origens: "Camarim 3×3 m × 2 → 16" },
      { codigo: "PERNA-60", nome: "Perna de praticável 60 cm", unidade: "un", total: 132, origens: "Palco 8×6 m × 1 → 96 · Camarim 3×3 m × 2 → 36" },
      { codigo: "PISO-MOD", nome: "Módulo de piso 1×1 m (praticável)", unidade: "un", total: 66, origens: "Palco 8×6 m × 1 → 48 · Camarim 3×3 m × 2 → 18" },
      { codigo: "RODAPE", nome: "Rodapé de palco 30 cm (m)", unidade: "m", total: 28, origens: "Palco 8×6 m × 1 → 28" },
      { codigo: "SARRAFO", nome: "Sarrafo de pinus 3 m", unidade: "un", total: 60, origens: "Balcão de credenciamento 2 m × 2 → 12 · Camarim 3×3 m × 2 → 48" },
      { codigo: "TAMPO-BAL", nome: "Tampo de balcão 2 m", unidade: "un", total: 2, origens: "Balcão de credenciamento 2 m × 2 → 2" },
      { codigo: "TINTA-PRETA", nome: "Tinta PVA preta fosca (lata 18 l)", unidade: "lata", total: 3, origens: "Palco 8×6 m × 1 → 1 · Balcão de credenciamento 2 m × 2 → 2" },
    ],
  },
];

export const OS_E1_AVULSOS = [{ descricao: "Fechamento de tenda", quantidade: 3, destino: "GV", area: "Produção" }];

export const OS_VERSOES_E1 = [
  { numero: 4, gatilho: "Ajuste da logística", geradaEm: "2026-09-12T11:05", por: "Marina Castro", descricao: "Cliente aprovou segunda tenda VIP por telefone; produção confirmará por solicitação formal.", diff: [{ codigo: "TND-CABO", antes: 8, depois: 16 }, { codigo: "TND-CALHA", antes: 4, depois: 8 }, { codigo: "TND-CANT", antes: 8, depois: 16 }, { codigo: "TND-LONA10", antes: 1, depois: 2 }, { codigo: "TND-MASTRO", antes: 1, depois: 2 }, { codigo: "TND-PE", antes: 8, depois: 16 }, { codigo: "TND-TRAV", antes: 8, depois: 16 }] },
  { numero: 3, gatilho: "Resposta a solicitação", geradaEm: "2026-09-09T17:40", por: "Rafael Nunes", descricao: "SOL-0010 · Pórtico extra na área de ativação", diff: [{ codigo: "BOX-3000", antes: 42, depois: 46 }, { codigo: "BOX-600", antes: 16, depois: 20 }, { codigo: "CUBO", antes: 34, depois: 38 }, { codigo: "PARAF", antes: 644, depois: 708 }, { codigo: "SAPATA", antes: 7, depois: 9 }] },
  { numero: 2, gatilho: "Ata fechada", geradaEm: "2026-09-08T17:20", por: "Marina Castro", descricao: "Inclusão do camarim decidida na reunião", diff: [{ codigo: "MDF-9", antes: 0, depois: 16 }, { codigo: "PERNA-60", antes: 96, depois: 132 }, { codigo: "PISO-MOD", antes: 48, depois: 66 }, { codigo: "SARRAFO", antes: 12, depois: 60 }] },
  { numero: 1, gatilho: "Ata fechada", geradaEm: "2026-09-08T17:20", por: "Marina Castro", descricao: "OS inicial gerada no fechamento da ata", diff: [] },
];

export const PROJETOS = [
  { id: "p1", codigo: "PRJ-0001", nome: "Pórtico boca 6,60m", categoria: "Pórtico", versao: 2, tipos: 10, total: 168, anexos: "2 img · 1 PDF", ativo: true, descricao: "Pórtico de entrada em box truss, vão livre de 6,60 m e 4 m de altura.", usoEventos: 4 },
  { id: "p2", codigo: "PRJ-0002", nome: "Pórtico boca 4m", categoria: "Pórtico", versao: 1, tipos: 5, total: 78, anexos: "1 img", ativo: true, descricao: "Pórtico compacto para acessos secundários.", usoEventos: 3 },
  { id: "p3", codigo: "PRJ-0003", nome: "Torre de som 4m", categoria: "Torre", versao: 1, tipos: 7, total: 52, anexos: "1 img", ativo: true, descricao: "Torre para line array pequeno, com contrapeso.", usoEventos: 4 },
  { id: "p4", codigo: "PRJ-0004", nome: "Palco 8×6 m com cobertura", categoria: "Palco", versao: 1, tipos: 9, total: 465, anexos: "3 img · 1 PDF", ativo: true, descricao: "Praticáveis 1×1 a 60 cm, rodapé e cobertura em box truss.", usoEventos: 4 },
  { id: "p5", codigo: "PRJ-0005", nome: "Tenda 10×10 m", categoria: "Tenda", versao: 1, tipos: 7, total: 38, anexos: "1 img", ativo: true, descricao: "Estrutura da tenda. Fechamentos laterais são sempre itens avulsos.", usoEventos: 3 },
  { id: "p6", codigo: "PRJ-0006", nome: "Tenda 5×5 m", categoria: "Tenda", versao: 1, tipos: 6, total: 18, anexos: "—", ativo: true, descricao: null, usoEventos: 2 },
  { id: "p7", codigo: "PRJ-0007", nome: "Balcão de credenciamento 2 m", categoria: "Balcão", versao: 1, tipos: 4, total: 11, anexos: "2 img", ativo: true, descricao: "Balcão em MDF pintado, tampo de 2 m.", usoEventos: 4 },
  { id: "p8", codigo: "PRJ-0008", nome: "Camarim 3×3 m", categoria: "Camarim", versao: 1, tipos: 4, total: 59, anexos: "1 img", ativo: true, descricao: "Painéis em MDF 9 mm sobre estrutura de sarrafo, piso praticável.", usoEventos: 2 },
];

export const BOM_P1 = [
  { codigo: "BOX-400", nome: "Box truss 400 mm — trecho 1 m", setor: "ESTRUTURA", qtd: 1 },
  { codigo: "BOX-600", nome: "Box truss 600 mm — trecho 1,5 m", setor: "ESTRUTURA", qtd: 5 },
  { codigo: "BOX-700", nome: "Box truss 700 mm — trecho 2 m", setor: "ESTRUTURA", qtd: 1 },
  { codigo: "BOX-3000", nome: "Box truss — trecho 3 m", setor: "ESTRUTURA", qtd: 10 },
  { codigo: "BOX-3500", nome: "Box truss — trecho 3,5 m", setor: "ESTRUTURA", qtd: 2 },
  { codigo: "CUBO", nome: "Cubo de conexão 4 faces", setor: "ESTRUTURA", qtd: 10 },
  { codigo: "GRAPPLE", nome: "Grapple (esticador de cabo)", setor: "ESTRUTURA", qtd: 1 },
  { codigo: "PARAF", nome: "Parafuso M12 com porca e arruela", setor: "ESTRUTURA", qtd: 132 },
  { codigo: "SAPATA", nome: "Sapata de base 40×40", setor: "ESTRUTURA", qtd: 2, novo: true },
  { codigo: "CONTRAPESO", nome: "Contrapeso 25 kg", setor: "ESTRUTURA", qtd: 4, novo: true },
];

export const PECAS = [
  { codigo: "BOX-400", nome: "Box truss 400 mm — trecho 1 m", setor: "ESTRUTURA", familia: "Box truss", estoque: 40, unidade: "un", bom: true, ativo: true },
  { codigo: "BOX-600", nome: "Box truss 600 mm — trecho 1,5 m", setor: "ESTRUTURA", familia: "Box truss", estoque: 120, unidade: "un", bom: true, ativo: true },
  { codigo: "BOX-700", nome: "Box truss 700 mm — trecho 2 m", setor: "ESTRUTURA", familia: "Box truss", estoque: 60, unidade: "un", bom: true, ativo: true },
  { codigo: "BOX-3000", nome: "Box truss — trecho 3 m", setor: "ESTRUTURA", familia: "Box truss", estoque: 40, unidade: "un", bom: true, ativo: true },
  { codigo: "BOX-3500", nome: "Box truss — trecho 3,5 m", setor: "ESTRUTURA", familia: "Box truss", estoque: 30, unidade: "un", bom: true, ativo: true },
  { codigo: "CUBO", nome: "Cubo de conexão 4 faces", setor: "ESTRUTURA", familia: "Conexão", estoque: 34, unidade: "un", bom: true, ativo: true },
  { codigo: "GRAPPLE", nome: "Grapple (esticador de cabo)", setor: "ESTRUTURA", familia: "Conexão", estoque: 24, unidade: "un", bom: true, ativo: true },
  { codigo: "PARAF", nome: "Parafuso M12 com porca e arruela", setor: "ESTRUTURA", familia: "Fixação", estoque: 600, unidade: "un", bom: true, ativo: true },
  { codigo: "SAPATA", nome: "Sapata de base 40×40", setor: "ESTRUTURA", familia: "Base", estoque: 36, unidade: "un", bom: true, ativo: true },
  { codigo: "CONTRAPESO", nome: "Contrapeso 25 kg", setor: "ESTRUTURA", familia: "Base", estoque: 60, unidade: "un", bom: true, ativo: true },
  { codigo: "TALHA", nome: "Talha manual 1 t", setor: "ESTRUTURA", familia: "Içamento", estoque: 2, unidade: "un", bom: true, ativo: true },
  { codigo: "TND-CANT", nome: "Cantoneira de tenda", setor: "TENDA", familia: "Tenda", estoque: 96, unidade: "un", bom: true, ativo: true },
  { codigo: "TND-TRAV", nome: "Travessa de tenda 5 m", setor: "TENDA", familia: "Tenda", estoque: 64, unidade: "un", bom: true, ativo: true },
  { codigo: "TND-PE", nome: "Pé de tenda 3 m", setor: "TENDA", familia: "Tenda", estoque: 72, unidade: "un", bom: true, ativo: true },
  { codigo: "TND-MASTRO", nome: "Mastro central", setor: "TENDA", familia: "Tenda", estoque: 20, unidade: "un", bom: true, ativo: true },
  { codigo: "TND-CABO", nome: "Cabo de aço 6 mm — 10 m", setor: "TENDA", familia: "Tenda", estoque: 80, unidade: "un", bom: true, ativo: true },
  { codigo: "TND-CALHA", nome: "Calha de união 5 m", setor: "TENDA", familia: "Tenda", estoque: 40, unidade: "un", bom: true, ativo: true },
  { codigo: "TND-LONA10", nome: "Lona de cobertura 10×10", setor: "TENDA", familia: "Tenda", estoque: 8, unidade: "un", bom: true, ativo: true },
  { codigo: "TND-LONA5", nome: "Lona de cobertura 5×5", setor: "TENDA", familia: "Tenda", estoque: 14, unidade: "un", bom: true, ativo: true },
  { codigo: "TND-FECH", nome: "Fechamento lateral de tenda 5 m", setor: "TENDA", familia: "Tenda", estoque: 30, unidade: "un", bom: false, ativo: true },
  { codigo: "MDF-15", nome: "Chapa MDF 15 mm 2,75×1,85", setor: "MARCENARIA", familia: "Chapa", estoque: 60, unidade: "un", bom: true, ativo: true },
  { codigo: "MDF-9", nome: "Chapa MDF 9 mm 2,75×1,85", setor: "MARCENARIA", familia: "Chapa", estoque: 45, unidade: "un", bom: true, ativo: true },
  { codigo: "SARRAFO", nome: "Sarrafo de pinus 3 m", setor: "MARCENARIA", familia: "Madeira", estoque: 200, unidade: "un", bom: true, ativo: true },
  { codigo: "PISO-MOD", nome: "Módulo de piso 1×1 m (praticável)", setor: "MARCENARIA", familia: "Piso", estoque: 150, unidade: "un", bom: true, ativo: true },
  { codigo: "PERNA-60", nome: "Perna de praticável 60 cm", setor: "MARCENARIA", familia: "Piso", estoque: 300, unidade: "un", bom: true, ativo: true },
  { codigo: "TAMPO-BAL", nome: "Tampo de balcão 2 m", setor: "MARCENARIA", familia: "Balcão", estoque: 12, unidade: "un", bom: true, ativo: true },
  { codigo: "RODAPE", nome: "Rodapé de palco 30 cm (m)", setor: "MARCENARIA", familia: "Acabamento", estoque: 120, unidade: "m", bom: true, ativo: true },
  { codigo: "TINTA-PRETA", nome: "Tinta PVA preta fosca (lata 18 l)", setor: "MARCENARIA", familia: "Acabamento", estoque: 10, unidade: "lata", bom: true, ativo: true },
];

export const CONSOLIDACAO = [
  { codigo: "TND-LONA10", nome: "Lona de cobertura 10×10", setor: "TENDA", estoque: 8, pico: 3, diaPico: "2026-09-22", saldo: 5, eventos: "EVT-0001 (2) · EVT-0004 (1)" },
  { codigo: "BOX-3000", nome: "Box truss — trecho 3 m", setor: "ESTRUTURA", estoque: 90, pico: 104, diaPico: "2026-09-23", saldo: -14, eventos: "EVT-0001 (46) · EVT-0003 (38) · EVT-0005 (20)" },
  { codigo: "CUBO", nome: "Cubo de conexão 4 faces", setor: "ESTRUTURA", estoque: 80, pico: 92, diaPico: "2026-09-23", saldo: -12, eventos: "EVT-0001 (38) · EVT-0003 (30) · EVT-0005 (24)" },
  { codigo: "PISO-MOD", nome: "Módulo de piso 1×1 m (praticável)", setor: "MARCENARIA", estoque: 150, pico: 114, diaPico: "2026-09-25", saldo: 36, eventos: "EVT-0001 (66) · EVT-0003 (48)" },
  { codigo: "TALHA", nome: "Talha manual 1 t", setor: "ESTRUTURA", estoque: 12, pico: 14, diaPico: "2026-09-23", saldo: -2, eventos: "EVT-0001 (3) · EVT-0003 (2) · EVT-0005 (9)" },
  { codigo: "SAPATA", nome: "Sapata de base 40×40", setor: "ESTRUTURA", estoque: 36, pico: 21, diaPico: "2026-09-23", saldo: 15, eventos: "EVT-0001 (9) · EVT-0003 (6) · EVT-0005 (6)" },
  { codigo: "TND-PE", nome: "Pé de tenda 3 m", setor: "TENDA", estoque: 72, pico: 24, diaPico: "2026-09-22", saldo: 48, eventos: "EVT-0001 (16) · EVT-0004 (8)" },
  { codigo: "PARAF", nome: "Parafuso M12 com porca e arruela", setor: "ESTRUTURA", estoque: 3000, pico: 1612, diaPico: "2026-09-23", saldo: 1388, eventos: "EVT-0001 (708) · EVT-0003 (560) · EVT-0005 (344)" },
];

export const PENDENCIAS = [
  { solicitacao: "SOL-0001", evento: "Festival Praia Sonora 2026", area: "Produção", item: "Fechamento de tenda", falta: 1, obs: "Só 3 fechamentos disponíveis na data; o 4º depende de locação.", desde: "2026-09-08" },
  { solicitacao: "SOL-0002", evento: "Festival Praia Sonora 2026", area: "Ativação", item: "Torre de som 4m", falta: 1, obs: "Uma torre está comprometida com o Lançamento SUV Aurora no mesmo fim de semana.", desde: "2026-09-08" },
];

export const NOTIFICACOES = [
  { id: "n1", titulo: "SOL-0011 aguarda resposta há 3 dias", mensagem: "Gráfica · Festival Praia Sonora 2026 · prazo vencido em 13/09 09:00", quando: "há 2 dias", lida: false, tipo: "prazo", link: "s1e" },
  { id: "n2", titulo: "Nova solicitação de alteração", mensagem: "SOL-0014 · Ativação · Corrida Noturna Lumen · 1 item", quando: "ontem 15:30", lida: false, tipo: "solicitacao", link: "s5b" },
  { id: "n3", titulo: "Reunião de OS hoje às 09:00", mensagem: "Lançamento SUV Aurora · 1 item ainda sem resposta", quando: "hoje 07:00", lida: false, tipo: "evento", link: "e3" },
  { id: "n4", titulo: "OS v4 gerada", mensagem: "Festival Praia Sonora 2026 · ajuste da logística na Tenda 10×10 m", quando: "há 2 dias", lida: true, tipo: "os", link: "e1" },
  { id: "n5", titulo: "SOL-0012 devolvida para ajuste", mensagem: "Atendimento · confirme o espaço do terceiro camarim antes de reenviar", quando: "há 3 dias", lida: true, tipo: "solicitacao", link: "s1f" },
  { id: "n6", titulo: "Projeto Pórtico boca 6,60m atualizado para v2", mensagem: "Bruno Tavares · incluídas 2 sapatas e 4 contrapesos após revisão de segurança", quando: "há 4 dias", lida: true, tipo: "projeto", link: "p1" },
];

export const HISTORICO_E1 = [
  { descricao: "Tenda 10×10 m: quantidade alterada de 1 para 2", detalhe: "Cliente aprovou segunda tenda VIP por telefone; produção confirmará por solicitação formal.", quem: "Marina Castro", quando: "12/09 11:05", tipo: "ajuste" },
  { descricao: "SOL-0012 devolvida para ajuste", detalhe: "Confirme com a produção se o terceiro camarim cabe no backstage antes de reenviar", quem: "Marina Castro", quando: "11/09 08:30", tipo: "solicitacao" },
  { descricao: "SOL-0011 enviada pela Gráfica", detalhe: "1 item · prazo 13/09 09:00", quem: "Diego Sampaio", quando: "11/09 09:00", tipo: "solicitacao" },
  { descricao: "SOL-0010 respondida — OS v3 gerada", detalhe: "Pórtico boca 4m × 1 atendido", quem: "Rafael Nunes", quando: "09/09 17:40", tipo: "resposta" },
  { descricao: "Ata fechada — OS v1 gerada", detalhe: "9 linhas · 3 solicitações pré-reunião consolidadas", quem: "Marina Castro", quando: "08/09 17:20", tipo: "marco" },
  { descricao: "Reunião de OS iniciada", detalhe: "Envios de necessidades bloqueados", quem: "Marina Castro", quando: "08/09 14:02", tipo: "marco" },
  { descricao: "Evento criado", detalhe: "Festival Praia Sonora 2026 · Prefeitura de Marítima", quem: "Marina Castro", quando: "01/09 10:12", tipo: "marco" },
];

export const USUARIOS_ADMIN = [
  { nome: "Marina Castro", email: "marina.castro@nortemkt.com.br", perfil: "LOGISTICA", area: "Logística", ativo: true, ultimoAcesso: "hoje 08:12" },
  { nome: "Rafael Nunes", email: "rafael.nunes@nortemkt.com.br", perfil: "LOGISTICA", area: "Logística", ativo: true, ultimoAcesso: "hoje 07:55" },
  { nome: "Helena Prado", email: "helena.prado@nortemkt.com.br", perfil: "GESTAO", area: null, ativo: true, ultimoAcesso: "ontem 18:40" },
  { nome: "Bruno Tavares", email: "bruno.tavares@nortemkt.com.br", perfil: "CENOGRAFIA", area: "Cenografia", ativo: true, ultimoAcesso: "hoje 09:30" },
  { nome: "Carla Mendes", email: "carla.mendes@nortemkt.com.br", perfil: "CENOGRAFIA", area: "Cenografia", ativo: true, ultimoAcesso: "há 6 dias" },
  { nome: "Paulo Ribeiro", email: "paulo.ribeiro@nortemkt.com.br", perfil: "REQUISITANTE", area: "Produção", ativo: true, ultimoAcesso: "hoje 08:40" },
  { nome: "Ana Lima", email: "ana.lima@nortemkt.com.br", perfil: "REQUISITANTE", area: "Produção", ativo: true, ultimoAcesso: "há 2 dias" },
  { nome: "Júlia Fontes", email: "julia.fontes@nortemkt.com.br", perfil: "REQUISITANTE", area: "Ativação", ativo: true, ultimoAcesso: "ontem 15:32" },
  { nome: "Tiago Moreira", email: "tiago.moreira@nortemkt.com.br", perfil: "REQUISITANTE", area: "Ativação", ativo: false, ultimoAcesso: "há 2 meses" },
  { nome: "Diego Sampaio", email: "diego.sampaio@nortemkt.com.br", perfil: "REQUISITANTE", area: "Gráfica", ativo: true, ultimoAcesso: "há 3 dias" },
  { nome: "Lúcia Barros", email: "lucia.barros@nortemkt.com.br", perfil: "REQUISITANTE", area: "Atendimento", ativo: true, ultimoAcesso: "há 3 dias" },
  { nome: "Administrador do Sistema", email: "admin@nortemkt.com.br", perfil: "ADMIN", area: null, ativo: true, ultimoAcesso: "hoje 10:02" },
];


// Lista de peças (BOM) unitária de cada projeto padrão, extraída das origens da OS do EVT-0001.
export const BOM_PROJETOS = {
  "Pórtico boca 6,60m": { "BOX-400": 1, "BOX-600": 5, "BOX-700": 1, "BOX-3000": 10, "BOX-3500": 2, "CUBO": 10, "GRAPPLE": 1, "PARAF": 132 },
  "Pórtico boca 6,60m v2": { "BOX-400": 1, "BOX-600": 5, "BOX-700": 1, "BOX-3000": 10, "BOX-3500": 2, "CUBO": 10, "GRAPPLE": 1, "PARAF": 132, "SAPATA": 2, "CONTRAPESO": 4 },
  "Pórtico boca 4m": { "BOX-3000": 4, "BOX-600": 4, "CUBO": 4, "PARAF": 64, "SAPATA": 2 },
  "Torre de som 4m": { "BOX-3000": 2, "BOX-600": 2, "CUBO": 2, "CONTRAPESO": 4, "PARAF": 40, "SAPATA": 1, "TALHA": 1 },
  "Palco 8×6 m com cobertura": { "BOX-3000": 16, "BOX-3500": 4, "CUBO": 8, "PARAF": 260, "SAPATA": 4, "PERNA-60": 96, "PISO-MOD": 48, "RODAPE": 28, "TINTA-PRETA": 1 },
  "Tenda 10×10 m": { "TND-CABO": 8, "TND-CALHA": 4, "TND-CANT": 8, "TND-LONA10": 1, "TND-MASTRO": 1, "TND-PE": 8, "TND-TRAV": 8 },
  "Tenda 5×5 m": { "TND-CABO": 4, "TND-CANT": 4, "TND-LONA5": 1, "TND-MASTRO": 1, "TND-PE": 4, "TND-TRAV": 4 },
  "Balcão de credenciamento 2 m": { "MDF-15": 3, "SARRAFO": 6, "TAMPO-BAL": 1, "TINTA-PRETA": 1 },
  "Camarim 3×3 m": { "MDF-9": 8, "SARRAFO": 24, "PERNA-60": 18, "PISO-MOD": 9 },
};

export const PECA_INFO = {};
PECAS.forEach((p) => { PECA_INFO[p.codigo] = { nome: p.nome, setor: p.setor, unidade: p.unidade, estoque: p.estoque }; });

// Ata congelada de cada evento que já fechou a reunião.
export const ATAS = {
  e1: ATA_E1,
  e5: [
    { id: "l5a", tipo: "PROJETO", descricao: "Pórtico boca 6,60m", versao: 1, versaoDefasada: true, quantidade: 1, destino: "Largada", area: "Produção", origem: "SOL-0007", setor: "ESTRUTURA" },
    { id: "l5b", tipo: "PROJETO", descricao: "Torre de som 4m", versao: 1, versaoDefasada: false, quantidade: 2, destino: "Largada e chegada", area: "Ativação", origem: "SOL-0007", setor: "ESTRUTURA" },
    { id: "l5c", tipo: "PROJETO", descricao: "Tenda 5×5 m", versao: 1, versaoDefasada: false, quantidade: 2, destino: "Hidratação e apoio médico", area: "Atendimento", origem: "Incluída na reunião", setor: "TENDA" },
    { id: "l5d", tipo: "PROJETO", descricao: "Balcão de credenciamento 2 m", versao: 1, versaoDefasada: false, quantidade: 1, destino: "Retirada de kits", area: "Atendimento", origem: "SOL-0009", setor: "MARCENARIA" },
  ],
  e4: [
    { id: "l4a", tipo: "PROJETO", descricao: "Tenda 10×10 m", versao: 1, versaoDefasada: false, quantidade: 1, destino: "Praça de alimentação", area: "Produção", origem: "SOL-0004", setor: "TENDA" },
    { id: "l4b", tipo: "PROJETO", descricao: "Tenda 5×5 m", versao: 1, versaoDefasada: false, quantidade: 4, destino: "Estandes dos expositores", area: "Produção", origem: "SOL-0004", setor: "TENDA" },
    { id: "l4c", tipo: "PROJETO", descricao: "Balcão de credenciamento 2 m", versao: 1, versaoDefasada: false, quantidade: 2, destino: "Entrada da praça", area: "Atendimento", origem: "SOL-0004", setor: "MARCENARIA" },
    { id: "l4d", tipo: "PROJETO", descricao: "Pórtico boca 4m", versao: 1, versaoDefasada: false, quantidade: 1, destino: "Acesso principal", area: "Cenografia", origem: "Incluída na reunião", setor: "ESTRUTURA" },
  ],
  e7: [
    { id: "l7a", tipo: "PROJETO", descricao: "Palco 8×6 m com cobertura", versao: 1, versaoDefasada: false, quantidade: 1, destino: "Salão Atlântico", area: "Produção", origem: "SOL-0015", setor: "MARCENARIA" },
    { id: "l7b", tipo: "PROJETO", descricao: "Balcão de credenciamento 2 m", versao: 1, versaoDefasada: false, quantidade: 1, destino: "Foyer", area: "Atendimento", origem: "SOL-0015", setor: "MARCENARIA" },
    { id: "l7c", tipo: "PROJETO", descricao: "Camarim 3×3 m", versao: 1, versaoDefasada: false, quantidade: 1, destino: "Sala de apoio", area: "Atendimento", origem: "Incluída na reunião", setor: "MARCENARIA" },
  ],
  e8: [
    { id: "l8a", tipo: "PROJETO", descricao: "Pórtico boca 6,60m", versao: 1, versaoDefasada: true, quantidade: 1, destino: "Entrada do ginásio", area: "Cenografia", origem: "SOL-0016", setor: "ESTRUTURA" },
    { id: "l8b", tipo: "PROJETO", descricao: "Torre de som 4m", versao: 1, versaoDefasada: false, quantidade: 2, destino: "Arena principal", area: "Ativação", origem: "SOL-0016", setor: "ESTRUTURA" },
    { id: "l8c", tipo: "PROJETO", descricao: "Palco 8×6 m com cobertura", versao: 1, versaoDefasada: false, quantidade: 1, destino: "Arena principal", area: "Produção", origem: "SOL-0016", setor: "MARCENARIA" },
  ],
};

export const AVULSOS = { e1: OS_E1_AVULSOS };

export const OS_VERSOES = {
  e1: OS_VERSOES_E1,
  e5: [
    { numero: 4, gatilho: "Reabertura pela gestão", geradaEm: "2026-09-10T09:15", por: "Helena Prado", descricao: "Evento reaberto para incluir a tenda de apoio médico", diff: [{ codigo: "TND-PE", antes: 4, depois: 8 }, { codigo: "TND-CANT", antes: 4, depois: 8 }, { codigo: "TND-LONA5", antes: 1, depois: 2 }, { codigo: "TND-CABO", antes: 4, depois: 8 }, { codigo: "TND-TRAV", antes: 4, depois: 8 }, { codigo: "TND-MASTRO", antes: 1, depois: 2 }] },
    { numero: 3, gatilho: "Resposta a solicitação", geradaEm: "2026-09-04T16:20", por: "Marina Castro", descricao: "SOL-0009 · Balcão para retirada de kits", diff: [{ codigo: "MDF-15", antes: 0, depois: 3 }, { codigo: "SARRAFO", antes: 0, depois: 6 }, { codigo: "TAMPO-BAL", antes: 0, depois: 1 }, { codigo: "TINTA-PRETA", antes: 0, depois: 1 }] },
    { numero: 2, gatilho: "Ajuste da logística", geradaEm: "2026-09-03T10:40", por: "Rafael Nunes", descricao: "Segunda torre de som confirmada para a chegada", diff: [{ codigo: "BOX-3000", antes: 12, depois: 14 }, { codigo: "CUBO", antes: 12, depois: 14 }, { codigo: "TALHA", antes: 1, depois: 2 }, { codigo: "PARAF", antes: 172, depois: 212 }] },
    { numero: 1, gatilho: "Ata fechada", geradaEm: "2026-09-02T16:40", por: "Marina Castro", descricao: "OS inicial gerada no fechamento da ata", diff: [] },
  ],
  e4: [
    { numero: 3, gatilho: "Resposta a solicitação", geradaEm: "2026-09-08T14:10", por: "Rafael Nunes", descricao: "SOL-0004 · Dois estandes a mais", diff: [{ codigo: "TND-PE", antes: 16, depois: 24 }, { codigo: "TND-CANT", antes: 16, depois: 24 }, { codigo: "TND-LONA5", antes: 2, depois: 4 }] },
    { numero: 2, gatilho: "Ata fechada", geradaEm: "2026-09-05T17:05", por: "Rafael Nunes", descricao: "Pórtico de acesso incluído na reunião", diff: [{ codigo: "BOX-3000", antes: 0, depois: 4 }, { codigo: "BOX-600", antes: 0, depois: 4 }, { codigo: "CUBO", antes: 0, depois: 4 }, { codigo: "PARAF", antes: 0, depois: 64 }] },
    { numero: 1, gatilho: "Ata fechada", geradaEm: "2026-09-05T17:05", por: "Rafael Nunes", descricao: "OS inicial gerada no fechamento da ata", diff: [] },
  ],
  e7: [
    { numero: 3, gatilho: "Ajuste da logística", geradaEm: "2026-08-20T11:00", por: "Marina Castro", descricao: "Camarim confirmado pelo cliente", diff: [{ codigo: "MDF-9", antes: 0, depois: 8 }, { codigo: "SARRAFO", antes: 6, depois: 30 }, { codigo: "PERNA-60", antes: 96, depois: 114 }, { codigo: "PISO-MOD", antes: 48, depois: 57 }] },
    { numero: 2, gatilho: "Resposta a solicitação", geradaEm: "2026-08-18T09:30", por: "Marina Castro", descricao: "SOL-0015 · Balcão no foyer", diff: [{ codigo: "MDF-15", antes: 0, depois: 3 }, { codigo: "TAMPO-BAL", antes: 0, depois: 1 }] },
    { numero: 1, gatilho: "Ata fechada", geradaEm: "2026-08-17T16:10", por: "Marina Castro", descricao: "OS inicial gerada no fechamento da ata", diff: [] },
  ],
  e8: [
    { numero: 3, gatilho: "Resposta a solicitação", geradaEm: "2026-08-05T15:00", por: "Marina Castro", descricao: "SOL-0016 · Segunda torre de som", diff: [{ codigo: "BOX-3000", antes: 24, depois: 26 }, { codigo: "CUBO", antes: 16, depois: 18 }, { codigo: "TALHA", antes: 1, depois: 2 }, { codigo: "CONTRAPESO", antes: 4, depois: 8 }] },
    { numero: 2, gatilho: "Ajuste da logística", geradaEm: "2026-08-04T10:20", por: "Rafael Nunes", descricao: "Pórtico movido para a entrada do ginásio", diff: [] },
    { numero: 1, gatilho: "Ata fechada", geradaEm: "2026-08-03T16:00", por: "Marina Castro", descricao: "OS inicial gerada no fechamento da ata", diff: [] },
  ],
};

export const OBSERVACOES = {
  e1: OBSERVACOES_E1,
  e5: "Participaram: Produção (Paulo), Ativação (Júlia), Atendimento (Lúcia), Logística (Marina).\nDecisões: prova noturna exige torre de som também na chegada. Tenda de apoio médico incluída após reabertura pela gestão.",
  e4: "Participaram: Produção (Ana), Atendimento (Lúcia), Cenografia (Bruno), Logística (Rafael).\nDecisões: estandes padronizados em tenda 5×5. Pórtico de acesso incluído na reunião.",
  e7: "Participaram: Produção (Paulo), Atendimento (Lúcia), Logística (Marina).\nDecisões: palco montado na véspera. Camarim confirmado depois, por ajuste da logística.",
  e8: "Participaram: Ativação (Júlia), Produção (Paulo), Cenografia (Bruno), Logística (Marina).\nDecisões: segunda torre de som liberada após confirmação de contrapesos.",
};

export const HISTORICOS = { e1: HISTORICO_E1 };
