/**
 * Modelo de dados da Arena 3D (briefing, slide 6: "Mapa de Arena 3D — consome dados daqui").
 *
 * Unidade espacial: metros. Eixo x = leste, eixo z = sul (plano do chão), origem no marco da arena.
 * A cena 3D e o plano 2D leem exatamente esta estrutura; trocar a fonte (arquivo, banco,
 * integração com o CAD) não muda a interface.
 */

export type Vec2 = [x: number, z: number];

/** Linha da ata de reunião de OS, como está na planilha do evento. */
export type ItemAta = {
  secao: "PERCURSO" | "TENDAS 3X3" | "TENDAS 5X5" | "BOX TRUSS" | "ATIVAÇÃO" | "ARENA";
  item: string;
  quantidade: number | null;
  /** Colunas complementares da linha (fechamentos, calhas...). */
  detalhe?: string;
  obs?: string;
};

export type CategoriaPonto = "largada" | "estrutura" | "atleta" | "medico" | "patrocinio" | "operacao" | "cenografia" | "hidratacao" | "obstaculo";

export type TipoZona = "arena" | "apoio" | "restrita" | "atletas" | "parque" | "agua";

export type Zona = { id: string; nome: string; tipo: TipoZona; poligono: Vec2[] };

/** Geometria de uma estrutura. Cada tipo tem um construtor leve na cena 3D. */
export type Modelo =
  | { tipo: "portico"; posicao: Vec2; rotacao?: number; vao: number; testeira?: number }
  | { tipo: "tenda"; posicao: Vec2; rotacao?: number; lado: 3 | 5; quantidade: number; colunas?: number; fechamentos?: boolean; passo?: [number, number] }
  | { tipo: "palco"; posicao: Vec2; rotacao?: number; largura: number; profundidade: number }
  | { tipo: "estander"; posicao: Vec2; rotacao?: number; largura: number; profundidade: number; marca: string }
  | { tipo: "quadro"; posicao: Vec2; rotacao?: number }
  | { tipo: "totem"; posicao: Vec2; rotacao?: number; forma: "trimandala" | "tenis" }
  | { tipo: "gerador"; posicao: Vec2; rotacao?: number; quantidade: number }
  | { tipo: "mesas"; posicao: Vec2; rotacao?: number; quantidade: number }
  | { tipo: "cochos"; posicao: Vec2; rotacao?: number; quantidade: number }
  | { tipo: "veiculo"; posicao: Vec2; rotacao?: number; forma: "ambulancia" | "van" | "moto" }
  | { tipo: "cacamba"; posicao: Vec2; rotacao?: number }
  | { tipo: "banheiros"; posicao: Vec2; rotacao?: number; quantidade: number }
  | { tipo: "espaco"; posicao: Vec2; raio: number };

export type StatusPonto = { rotulo: string; tom: "neutro" | "atencao" | "ok" };

/** Como planta e ata discordam sobre um item. */
export type TipoDivergencia = "quantidade" | "so-planta" | "nome" | "confirmar" | "sem-cota";

/**
 * Divergência entre as duas fontes do evento, conhecida por quem transcreveu a planta.
 * Nada é corrigido automaticamente: resolver exige decidir qual fonte vale.
 */
export type Divergencia = {
  id: string;
  tipo: TipoDivergencia;
  titulo: string;
  /** O que a planta diz, curto ("3", "desenhada", "vão 6,60 m"). */
  planta: string;
  /** O que a ata diz, curto. */
  ata: string;
  texto: string;
  /** Pontos do mapa envolvidos (os geradores, por exemplo, estão em três). */
  pontoIds: string[];
};

export type PontoArena = {
  id: string;
  nome: string;
  categoria: CategoriaPonto;
  /** Número da legenda no mapa de arena, quando houver. */
  legenda?: string;
  /** Rótulo curto do tipo, como a equipe fala ("Pórtico", "Guarda-volumes"). */
  tipo: string;
  posicao: Vec2;
  /** Altura do marcador acima do chão, em metros. */
  alturaMarcador: number;
  zonaId: string | null;
  modelos: Modelo[];
  /** Linhas da ata que este ponto materializa. */
  itensAta: ItemAta[];
  resumo: string;
  status: StatusPonto | null;
  /** Só preenchido quando a fonte informa. */
  responsavel: string | null;
  observacoes: string[];
  /** Pontos sempre rotulados na visão geral. */
  principal?: boolean;
};

/** Preparado para cronometragem/rastreamento. Hoje não há integração: a lista chega vazia. */
export type Corredor = {
  numero: string;
  nome?: string;
  categoria?: string;
  status: "aguardando" | "correndo" | "concluiu" | "desistiu";
  /** Distância percorrida em metros sobre o percurso, quando houver leitura de chip. */
  distanciaM?: number;
  ultimoCheckpoint?: string;
  tempo?: string;
};

export type Via = { nome: string; eixo: Vec2[]; largura: number };

export type TrechoPercurso = {
  id: string;
  nome: string;
  /** Pontos na ordem em que a planta desenha o corredor isolado. */
  eixo: Vec2[];
  /** Largura da faixa isolada por grades, em metros. */
  largura: number;
};

/** Faixa de curral de largada (pelotão), com metragem e grades informadas na planta. */
export type Curral = { id: string; nome: string; cor: string; metros: number; grades: number; eixo: Vec2[]; largura: number };

/** Edificação de contexto, só volume (sem nome: a planta não identifica). */
export type Edificacao = { poligono: Vec2[]; altura: number } | { centro: Vec2; raio: number; altura: number };

export type Arena = {
  slug: string;
  evento: {
    nome: string;
    sku: string;
    data: string; // ISO
    local: string;
    publicoEsperado: number | null;
    diretorProva: string | null;
    reuniaoOs: string | null; // ISO
    presentesReuniao: string[];
    montagem: string | null;
    distancias: string[];
    largadas: Array<{ distancia: string; hora: string }>;
    organizadora: string;
  };
  /** `rotuloPlanta`/`rotuloAta`: nomes curtos das duas fontes para a conferência ("Planta R03", "Ata 12/05"). */
  fonte: { documentos: Array<{ nome: string; detalhe: string }>; nota: string; rotuloPlanta: string; rotuloAta: string };
  /** Divergências entre planta e ata. Sem este campo, são derivadas das observações dos pontos. */
  divergencias?: Divergencia[];
  /** Trechos do corredor isolado dentro da área da planta; fora dela o percurso não é desenhado. */
  percurso: { trechos: TrechoPercurso[]; nota: string; conesGrandes: number };
  currais: Curral[];
  vias: Via[];
  zonas: Zona[];
  edificacoes: Edificacao[];
  pontos: PontoArena[];
  /** Itens da legenda da planta que não têm posição desenhada. */
  semPosicaoNaPlanta: Array<{ item: string; motivo: string }>;
  /** Contagens da legenda da planta sem ponto próprio (estacas, malotes). */
  contagensDaPlanta: Array<{ item: string; quantidade: number }>;
  /** Ata completa, para o painel "Tudo da ata" e para conferir o que não foi posicionado. */
  ata: ItemAta[];
  corredores: Corredor[];
  marco: { nome: string; posicao: Vec2; altura: number; raioPraca: number } | null;
  /** Retângulo coberto pela planta, em metros. */
  area: { minX: number; maxX: number; minZ: number; maxZ: number };
};
