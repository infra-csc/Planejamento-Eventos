import type { Arena, ItemAta, PontoArena, StatusPonto, Vec2 } from "../../src/domain/arena/tipos";

/**
 * Dados da arena da Eco Run SP 2026. Não é código de produção: `npm run importar:arena`
 * (scripts/importar-arena-eco-run.ts) grava esta arena na tabela `arenas`, de onde o app a lê.
 * Enquanto o script não rodou, `src/server/services/arenas.ts` carrega este arquivo sob demanda
 * como reserva (mesmo slug, mesma página).
 *
 * Eco Run 1 - São Paulo - 2026 (SKU ECO26SP1), prova da Norte Marketing Esportivo.
 *
 * Posições e medidas: "Mapa de Arena_Eco Run_R03" (AutoCAD, revisão 03 de 08/06/2026). As coordenadas
 * foram lidas da planta renderizada com 1800 px de largura e convertidas pela escala de 0,445 m/px,
 * aferida pelas cotas da própria planta (guarda-volumes 45 m; curral branco 73 m). Origem no Obelisco.
 * Quantidades: "ATA ECO RUN SP.xlsx" (reunião de OS de 12/05/2026). Onde as fontes divergem, as duas
 * aparecem nas observações do ponto.
 */

const ESCALA = 0.445;
const ORIGEM = [1233, 612] as const;
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Pixel da planta (1800 px de largura) para metros. */
const P = (x: number, y: number): Vec2 => [r1((x - ORIGEM[0]) * ESCALA), r1((y - ORIGEM[1]) * ESCALA)];
const PL = (...pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => P(x, y));
/** Rotação que alinha o eixo local x com a direção `a` (radianos no plano xz). */
const aoLongo = (a: number) => -a;
/** Rotação para uma estrutura que atravessa a via de direção `a` (pórticos). */
const atravessando = (a: number) => -(a + Math.PI / 2);
const somar = ([x, z]: Vec2, d: number, a: number, n = 0): Vec2 => [r1(x + Math.cos(a) * d - Math.sin(a) * n), r1(z + Math.sin(a) * d + Math.cos(a) * n)];

export const ATA_ECO_RUN_SP: ItemAta[] = [
  { secao: "PERCURSO", item: "Cavaletes Trânsito", quantidade: 10 },
  { secao: "PERCURSO", item: "Cochos para água", quantidade: 43 },
  { secao: "PERCURSO", item: "Cavaletes de ferro p/ cochos", quantidade: 86 },
  { secao: "PERCURSO", item: "Cones grandes", quantidade: 400 },
  { secao: "PERCURSO", item: "Cones pequenos", quantidade: 30 },
  { secao: "PERCURSO", item: "Tina 1000 l", quantidade: null },
  { secao: "PERCURSO", item: "Palet ferro", quantidade: 18 },
  { secao: "PERCURSO", item: "Palet plástico", quantidade: 18 },
  { secao: "PERCURSO", item: "Rampas de madeira", quantidade: 6 },
  { secao: "PERCURSO", item: "Prismas (cavaletes grandes)", quantidade: 18, detalhe: "Grades 2x1: 36" },
  { secao: "TENDAS 3X3", item: "Som", quantidade: 3, detalhe: "Fechamentos: 9" },
  { secao: "TENDAS 3X3", item: "Limpeza, segurança, carregadores", quantidade: 3, detalhe: "Fechamentos: 12" },
  { secao: "TENDAS 3X3", item: "Buffet", quantidade: 8, detalhe: "Fechamentos: 24", obs: "Livelo / Elo / Herbíssimo / Disal / Cielo / Bradesco / Estapar / Espaço Verde" },
  { secao: "TENDAS 3X3", item: "Extra", quantidade: 1, detalhe: "Fechamentos: 3" },
  { secao: "TENDAS 5X5", item: "GV (guarda-volumes)", quantidade: 9, detalhe: "Fechamentos: 11 · Calhas de lona: 11" },
  { secao: "TENDAS 5X5", item: "Depósito", quantidade: 2, detalhe: "Fechamentos: 6 · Calha de lona: 1" },
  { secao: "TENDAS 5X5", item: "Dispersão + frutas", quantidade: 6, detalhe: "Fechamentos: 0 · Calhas de lona: 3" },
  { secao: "TENDAS 5X5", item: "Médica", quantidade: 2, detalhe: "Fechamentos: 6 · Calha de lona: 1" },
  { secao: "TENDAS 5X5", item: "Lixo", quantidade: 2, detalhe: "Fechamentos: 6" },
  { secao: "TENDAS 5X5", item: "Extra", quantidade: 1, detalhe: "Fechamentos: 3" },
  { secao: "BOX TRUSS", item: "Pórtico boca de 6,00 com orelha", quantidade: 1, obs: "confirmar Tarcísio" },
  { secao: "BOX TRUSS", item: "Pórtico boca de 6,60 com orelha, testeira de 1,5 m", quantidade: 1, obs: "confirmar Tarcísio" },
  { secao: "BOX TRUSS", item: "Palco 8x4", quantidade: 1 },
  { secao: "BOX TRUSS", item: "Estander 9x6", quantidade: 8, obs: "Livelo / Elo / Herbíssimo / Disal / Cielo / Bradesco / Estapar / Espaço Verde" },
  { secao: "BOX TRUSS", item: "Quadro 4x3", quantidade: 3 },
  { secao: "BOX TRUSS", item: "Trimandala", quantidade: 1 },
  { secao: "BOX TRUSS", item: "Ícone tênis", quantidade: 1 },
  { secao: "ATIVAÇÃO", item: "Balcão (1,20 x 1,0)", quantidade: 9, obs: "1 Kit / 1 Palco / 1 Livelo / 1 Elo / 1 Herbíssimo / 1 Disal / 1 Cielo / 1 Bradesco / 1 Estapar" },
  { secao: "ATIVAÇÃO", item: "Bancadas de madeira (2,10 x 1,0)", quantidade: 16, obs: "1 Livelo / 1 Elo / 1 Herbíssimo / 1 Disal / 1 Cielo / 1 Bradesco / 1 Estapar / 9 Espaço Verde" },
  { secao: "ATIVAÇÃO", item: "Cavaletes retos", quantidade: 32 },
  { secao: "ATIVAÇÃO", item: "Ombrelone", quantidade: 8, obs: "1 Palco / 1 Livelo / 1 Elo / 1 Herbíssimo / 1 Disal / 1 Cielo / 1 Bradesco / 1 Estapar" },
  { secao: "ATIVAÇÃO", item: "Tina caixa d'água 300 L", quantidade: 7, obs: "1 Livelo / 1 Elo / 1 Herbíssimo / 1 Disal / 1 Cielo / 1 Bradesco / 1 Estapar" },
  { secao: "ATIVAÇÃO", item: "Puffs", quantidade: 70, obs: "10 Livelo / 10 Elo / 10 Herbíssimo / 10 Disal / 10 Cielo / 10 Bradesco / 10 Estapar" },
  { secao: "ARENA", item: "Água montagem (cx)", quantidade: 30 },
  { secao: "ARENA", item: "Água prova (cx)", quantidade: null },
  { secao: "ARENA", item: "Isotônico", quantidade: 11500 },
  { secao: "ARENA", item: "Proteína", quantidade: null },
  { secao: "ARENA", item: "Escadas de alumínio", quantidade: 2 },
  { secao: "ARENA", item: "Escadas de madeira", quantidade: 3 },
  { secao: "ARENA", item: "Grades merchandising", quantidade: 228 },
  { secao: "ARENA", item: "Pés de grades de merchandising", quantidade: 456 },
  { secao: "ARENA", item: "Paleteira", quantidade: 2 },
  { secao: "ARENA", item: "Gerador", quantidade: 2 },
  { secao: "ARENA", item: "Carrinho plataforma", quantidade: 3 },
  { secao: "ARENA", item: "Lixeiras (aramadas)", quantidade: 114, obs: "14 ativação" },
  { secao: "ARENA", item: "Lixeiras (ultra bag)", quantidade: 6 },
  { secao: "ARENA", item: "Mesa 1x1 (medalha)", quantidade: 12 },
  { secao: "ARENA", item: "Cavalete reto", quantidade: 24 },
  { secao: "ARENA", item: "Quadro metal", quantidade: 7, obs: "Posto médico: 1 · GV: 6" },
  { secao: "ARENA", item: "Caixas de água 500 L", quantidade: 50 },
];

const ata = (item: string): ItemAta => {
  const achado = ATA_ECO_RUN_SP.find((i) => i.item === item);
  if (!achado) throw new Error(`Item fora da ata: ${item}`);
  return achado;
};

/** Quantidade por marca lida da observação da ata ("1 Livelo / 1 Elo / ..."). */
function quantidadeDaMarca(item: ItemAta, marca: string): number | null {
  const parte = item.obs?.split("/").map((s) => s.trim()).find((s) => s.toLowerCase().endsWith(` ${marca.toLowerCase()}`));
  if (!parte) return null;
  const n = Number(parte.split(" ")[0]);
  return Number.isFinite(n) ? n : null;
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");

const PLANTA: StatusPonto = { rotulo: "Mapa de arena rev. 03", tom: "ok" };
const A_CONFIRMAR: StatusPonto = { rotulo: "Na ata: confirmar com Tarcísio", tom: "atencao" };
const GERADORES = "A planta marca 3 geradores (largada, chegada e palco); a ata lista 2.";

/* Estandes 9x6 (legenda 22 a 29) com a tenda de apoio (18) atrás de cada um. */
const ESTANDES: Array<{ n: string; marca: string; px: number; fileira: "norte" | "sul" }> = [
  { n: "22", marca: "Herbíssimo", px: 769.4, fileira: "norte" },
  { n: "23", marca: "Estapar", px: 811.4, fileira: "norte" },
  { n: "24", marca: "Cielo", px: 853.1, fileira: "norte" },
  { n: "25", marca: "Bradesco", px: 936.7, fileira: "norte" },
  { n: "26", marca: "Mudas", px: 768.3, fileira: "sul" },
  { n: "27", marca: "Elo", px: 811.4, fileira: "sul" },
  { n: "28", marca: "Livelo", px: 852.5, fileira: "sul" },
  { n: "29", marca: "Disal", px: 936.1, fileira: "sul" },
];

function pontosEstandes(): PontoArena[] {
  return ESTANDES.map(({ n, marca, px, fileira }) => {
    const norte = fileira === "norte";
    const pos = P(px, norte ? 582.8 : 644.4);
    const apoio = P(px, norte ? 572.2 : 655);
    const itens: ItemAta[] = [{ ...ata("Estander 9x6"), quantidade: 1, obs: undefined }];
    const observacoes = ["Posição conforme o mapa de arena (fileiras frente a frente, apoio atrás)."];
    if (marca === "Mudas") {
      observacoes.push("A ata de 12/05 lista a oitava marca como “Espaço Verde”; a planta de 08/06 traz “Mudas”. Os itens de ativação não foram associados.");
    } else {
      itens.push({ ...ata("Buffet"), quantidade: 1, obs: "Tenda de apoio (18 na planta)", detalhe: undefined });
      for (const nome of ["Balcão (1,20 x 1,0)", "Bancadas de madeira (2,10 x 1,0)", "Ombrelone", "Tina caixa d'água 300 L", "Puffs"]) {
        const q = quantidadeDaMarca(ata(nome), marca);
        if (q) itens.push({ ...ata(nome), quantidade: q, obs: undefined });
      }
    }
    return {
      id: `estande-${slug(marca)}`,
      nome: marca,
      legenda: n,
      categoria: "patrocinio",
      tipo: "Estande 9x6",
      posicao: pos,
      alturaMarcador: 6.5,
      zonaId: "arena",
      modelos: [
        { tipo: "estander", posicao: pos, rotacao: norte ? 0 : Math.PI, largura: 9, profundidade: 6, marca },
        { tipo: "tenda", posicao: apoio, lado: 3, quantidade: 1, fechamentos: true },
      ],
      itensAta: itens,
      resumo: "Estande em box truss com tenda de apoio 3x3. Itens de ativação conforme a divisão por marca da ata.",
      status: PLANTA,
      responsavel: null,
      observacoes,
    };
  });
}

/* Base de operação (08 limpeza, 09 carregadores, 10 depósito, 11 segurança) junto ao guarda-volumes. */
const GV = P(714.4, 510.6);
const ANG_GV = -0.433;
const QUADROS = P(821, 460.3);
const ANG_QUADROS = -0.373;

export const ARENA_ECO_RUN_SP_2026: Arena = {
  slug: "eco-run-sp-2026",
  evento: {
    nome: "Eco Run 1 - São Paulo - 2026",
    sku: "ECO26SP1",
    data: "2026-06-14",
    local: "Parque do Ibirapuera — Obelisco, São Paulo",
    publicoEsperado: 11000,
    diretorProva: "Tarcísio Viana",
    reuniaoOs: "2026-05-12",
    presentesReuniao: ["Tarcísio", "Amanda", "Pedro", "Fernanda", "Guilherme", "Rafael", "Gleicy", "Oswaldo"],
    montagem: "Arena descarrega em 09/06/2026 às 22h",
    distancias: ["5 km", "10 km"],
    largadas: [
      { distancia: "10 km", hora: "06:30" },
      { distancia: "5 km", hora: "07:40" },
    ],
    organizadora: "Norte Marketing Esportivo",
  },
  fonte: {
    documentos: [
      { nome: "Mapa de Arena — Eco Run (R03)", detalhe: "Revisão 03 de 08/06/2026 · projeto Jeovana Ferreira e Anita Denari Piffer · posições e medidas" },
      { nome: "ATA ECO RUN SP.xlsx", detalhe: "Reunião de OS de 12/05/2026 · lista de materiais e quantidades" },
    ],
    nota: "Posições lidas do mapa de arena com precisão de alguns metros. Quantidades da ata. Onde as fontes divergem, o ponto mostra as duas.",
    rotuloPlanta: "Planta R03",
    rotuloAta: "Ata 12/05",
  },
  divergencias: [
    { id: "geradores", tipo: "quantidade", titulo: "Geradores", planta: "3", ata: "2", texto: "A planta marca geradores na largada, na chegada e no palco; a ata lista 2.", pontoIds: ["som-largada", "som-chegada", "palco"] },
    { id: "tendas-lixo", tipo: "quantidade", titulo: "Tendas de lixo", planta: "3", ata: "2", texto: "A planta desenha 3 tendas 5x5 junto à alça de retorno; a ata lista 2.", pontoIds: ["lixo"] },
    { id: "quadros", tipo: "quantidade", titulo: "Quadros de foto", planta: "7 de 4 m", ata: "3 de 4×3", texto: "Quantidade e medida diferentes entre as fontes.", pontoIds: ["quadro-fotos"] },
    { id: "ambulancia", tipo: "so-planta", titulo: "Ambulância", planta: "desenhada", ata: "ausente", texto: "Consta no mapa de arena; não aparece na lista de materiais da ata.", pontoIds: ["ambulancia"] },
    { id: "cacamba", tipo: "so-planta", titulo: "Caçamba", planta: "desenhada", ata: "ausente", texto: "Consta no mapa de arena; não aparece na ata.", pontoIds: ["cacamba"] },
    { id: "espaco-livelo", tipo: "so-planta", titulo: "Espaço Livelo", planta: "desenhado", ata: "não detalhado", texto: "A ata não detalha materiais para este espaço de ativação.", pontoIds: ["espaco-livelo"] },
    { id: "oitava-marca", tipo: "nome", titulo: "8ª marca de estande", planta: "Mudas", ata: "Espaço Verde", texto: "Os itens de ativação da oitava marca não foram associados ao estande até confirmar o nome.", pontoIds: ["estande-mudas"] },
    { id: "portico-largada", tipo: "confirmar", titulo: "Pórtico de largada", planta: "vão 6,60 m", ata: "confirmar", texto: "Vão cotado na planta; a ata pede confirmar com Tarcísio.", pontoIds: ["largada"] },
    { id: "portico-chegada", tipo: "confirmar", titulo: "Pórtico de chegada", planta: "sem cota", ata: "6,00 m", texto: "A planta não cota o vão da chegada; o 6,00 m vem da ata, que pede confirmar com Tarcísio.", pontoIds: ["chegada"] },
    { id: "banheiros", tipo: "sem-cota", titulo: "Banheiros", planta: "linha sem quantidade", ata: "—", texto: "A planta desenha a linha de sanitários (cerca de 48 m) sem informar a quantidade; a ata não lista banheiros.", pontoIds: ["banheiros"] },
    { id: "assessorias", tipo: "sem-cota", titulo: "Assessorias", planta: "área marcada", ata: "—", texto: "A área está marcada; as tendas das assessorias não são detalhadas em nenhuma das fontes.", pontoIds: ["assessorias"] },
  ],
  percurso: {
    trechos: [
      { id: "largada", nome: "Currais e saída da largada", largura: 9, eixo: PL([1006.9, 815], [1167.8, 839.2], [1300, 846], [1388.1, 849.4], [1450.6, 841.5], [1477, 839], [1554, 820]) },
      { id: "via-norte", nome: "Corredor isolado na via norte", largura: 6, eixo: PL([837, 439], [640, 494], [440, 560], [300, 612]) },
      { id: "chegada", nome: "Chegada e funil até a dispersão", largura: 6, eixo: PL([52, 738], [108, 703], [187, 681], [300, 656], [415, 649], [520, 645], [560, 618], [573, 597], [550, 570], [513, 565], [490, 582]) },
    ],
    nota: "A planta mostra os corredores isolados da arena (linhas azuis). O restante dos 5 e 10 km fica fora da área do mapa e não é desenhado.",
    conesGrandes: 400,
  },
  currais: [
    { id: "branco", nome: "Curral branco", cor: "#efece8", metros: 73, grades: 36, largura: 9, eixo: PL([1006.9, 815], [1167.8, 839.2]) },
    { id: "verde", nome: "Curral verde", cor: "#2f7d4f", metros: 93, grades: 46, largura: 9, eixo: PL([1167.8, 839.2], [1300, 846], [1388.1, 849.4]) },
    { id: "azul", nome: "Curral azul", cor: "#34518c", metros: 27, grades: 14, largura: 9, eixo: PL([1388.1, 849.4], [1450.6, 841.5]) },
    { id: "preto", nome: "Curral preto", cor: "#2b2627", metros: 8, grades: 4, largura: 9, eixo: PL([1450.6, 841.5], [1472.5, 839.4]) },
  ],
  vias: [
    { nome: "Av. Pedro Álvares Cabral", largura: 20, eixo: PL([0, 748], [108, 704], [300, 660], [450, 653], [560, 668], [700, 733], [850, 781], [1007, 816], [1168, 841], [1388, 851], [1554, 821], [1560, 820]) },
    { nome: "Via norte", largura: 18, eixo: PL([300, 626], [440, 566], [640, 498], [837, 441], [1000, 399], [1150, 369], [1330, 350], [1450, 368], [1560, 410]) },
    { nome: "Alça de retorno", largura: 9, eixo: PL([545, 662], [585, 628], [594, 590], [572, 558], [527, 548], [488, 560], [455, 574]) },
    { nome: "Corredor viário leste", largura: 40, eixo: PL([1225, 0], [1255, 190], [1320, 320], [1440, 420], [1560, 480]) },
    { nome: "Via oeste", largura: 14, eixo: PL([150, 0], [140, 260], [165, 560], [120, 700]) },
  ],
  zonas: [
    { id: "parque", nome: "Parque do Ibirapuera", tipo: "parque", poligono: PL([0, 0], [1560, 0], [1560, 1270], [0, 1270]) },
    { id: "lago", nome: "Lago do Ibirapuera", tipo: "agua", poligono: PL([0, 870], [60, 790], [170, 770], [290, 775], [380, 800], [400, 860], [385, 960], [320, 1010], [230, 990], [130, 930], [60, 950], [0, 985]) },
    { id: "arena", nome: "Arena — gramado do Obelisco", tipo: "arena", poligono: PL([640, 472], [1010, 400], [1160, 425], [1190, 560], [1060, 690], [880, 702], [700, 690], [640, 600]) },
    {
      id: "assessorias",
      nome: "Assessorias",
      tipo: "apoio",
      poligono: Array.from({ length: 24 }, (_, i) => {
        const t = (i / 24) * Math.PI * 2;
        const [cx, cz] = P(1141.4, 466.7);
        const rx = 27;
        const rz = 13;
        const a = -0.15;
        return [r1(cx + Math.cos(t) * rx * Math.cos(a) - Math.sin(t) * rz * Math.sin(a)), r1(cz + Math.cos(t) * rx * Math.sin(a) + Math.sin(t) * rz * Math.cos(a))] as Vec2;
      }),
    },
  ],
  edificacoes: [
    { poligono: PL([255, 90], [375, 90], [375, 200], [255, 200]), altura: 12 },
    { poligono: PL([215, 225], [355, 225], [355, 335], [215, 335]), altura: 16 },
    { poligono: PL([345, 295], [430, 295], [430, 350], [345, 350]), altura: 9 },
    { poligono: PL([460, 120], [540, 120], [540, 215], [460, 215]), altura: 10 },
    { poligono: PL([540, 120], [610, 120], [610, 300], [540, 300]), altura: 14 },
    { centro: P(560, 55), raio: 21, altura: 16 },
    { poligono: PL([640, 0], [830, 0], [830, 80], [640, 80]), altura: 8 },
    { poligono: PL([0, 330], [95, 330], [95, 690], [0, 690]), altura: 22 },
    { poligono: PL([1030, 1010], [1230, 1050], [1230, 1110], [1030, 1135]), altura: 20 },
    { centro: P(1510, 1085), raio: 24, altura: 22 },
    { poligono: PL([1490, 110], [1560, 110], [1560, 240], [1490, 240]), altura: 14 },
  ],
  marco: { nome: "Obelisco de São Paulo", posicao: [0, 0], altura: 72, raioPraca: 38 },
  area: { minX: P(0, 0)[0], maxX: P(1560, 0)[0], minZ: P(0, 0)[1], maxZ: P(0, 1270)[1] },
  pontos: [
    {
      id: "largada",
      nome: "Pórtico de largada",
      legenda: "21",
      categoria: "largada",
      tipo: "Pórtico 6,60 m",
      posicao: P(1477.2, 833.8),
      alturaMarcador: 11,
      zonaId: null,
      modelos: [{ tipo: "portico", posicao: P(1477.2, 836), rotacao: atravessando(-0.205), vao: 6.6, testeira: 1.5 }],
      itensAta: [ata("Pórtico boca de 6,60 com orelha, testeira de 1,5 m")],
      resumo: "Largadas às 06:30 (10 km) e 07:40 (5 km), no fim dos currais branco, verde, azul e preto.",
      status: A_CONFIRMAR,
      responsavel: "Tarcísio Viana (diretor de prova)",
      observacoes: ["Vão de 6,60 m cotado na planta."],
      principal: true,
    },
    {
      id: "som-largada",
      nome: "Som, crono e gerador — largada",
      legenda: "01 · 03",
      categoria: "estrutura",
      tipo: "Som e cronometragem",
      posicao: P(1470, 817),
      alturaMarcador: 5,
      zonaId: null,
      modelos: [
        { tipo: "tenda", posicao: P(1478, 817), lado: 3, quantidade: 1, fechamentos: true },
        { tipo: "gerador", posicao: P(1461, 817), rotacao: aoLongo(-0.205), quantidade: 1 },
      ],
      itensAta: [ata("Som"), ata("Gerador")],
      resumo: "Tenda de som e cronometragem com gerador ao lado do pórtico.",
      status: PLANTA,
      responsavel: null,
      observacoes: [GERADORES],
    },
    {
      id: "currais",
      nome: "Currais de largada",
      categoria: "atleta",
      tipo: "Pelotões",
      posicao: P(1230, 842),
      alturaMarcador: 4,
      zonaId: null,
      modelos: [],
      itensAta: [ata("Prismas (cavaletes grandes)")],
      resumo: "Branco 73 m (36 grades), verde 93 m (46 grades), azul 27 m (14 grades) e preto 8 m (4 grades), com 9 m de largura.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["Metragens e grades conforme o mapa de arena. A ata lista 36 grades 2x1 no percurso."],
      principal: true,
    },
    {
      id: "chegada",
      nome: "Pórtico de chegada",
      legenda: "02",
      categoria: "largada",
      tipo: "Pórtico 6,00 m",
      posicao: P(108.3, 702.7),
      alturaMarcador: 11,
      zonaId: null,
      modelos: [{ tipo: "portico", posicao: P(108.3, 702.7), rotacao: atravessando(-0.372), vao: 6 }],
      itensAta: [ata("Pórtico boca de 6,00 com orelha")],
      resumo: "Chegada junto ao lago; o funil segue pela avenida até a dispersão na alça de retorno.",
      status: A_CONFIRMAR,
      responsavel: "Tarcísio Viana (diretor de prova)",
      observacoes: ["A planta não cota o vão da chegada; o 6,00 m vem da ata."],
      principal: true,
    },
    {
      id: "som-chegada",
      nome: "Som, crono e gerador — chegada",
      legenda: "01 · 03",
      categoria: "estrutura",
      tipo: "Som e cronometragem",
      posicao: P(112, 686),
      alturaMarcador: 5,
      zonaId: null,
      modelos: [
        { tipo: "tenda", posicao: P(104, 689), lado: 3, quantidade: 1, fechamentos: true },
        { tipo: "gerador", posicao: P(124, 684), rotacao: aoLongo(-0.372), quantidade: 1 },
      ],
      itensAta: [ata("Som"), ata("Gerador")],
      resumo: "Som e cronometragem da chegada, com gerador.",
      status: PLANTA,
      responsavel: null,
      observacoes: [GERADORES],
    },
    {
      id: "tenda-medica",
      nome: "Tenda médica",
      legenda: "04",
      categoria: "medico",
      tipo: "Atendimento médico",
      posicao: P(206.7, 656.7),
      alturaMarcador: 6,
      zonaId: null,
      modelos: [{ tipo: "tenda", posicao: P(206.7, 656.7), rotacao: aoLongo(-0.4), lado: 5, quantidade: 2, colunas: 2, fechamentos: true }],
      itensAta: [ata("Médica"), { ...ata("Quadro metal"), quantidade: 1, obs: "Posto médico" }],
      resumo: "Duas tendas 5x5 (10 x 5 m na planta) logo após a chegada.",
      status: PLANTA,
      responsavel: null,
      observacoes: [],
      principal: true,
    },
    {
      id: "ambulancia",
      nome: "Ambulância",
      legenda: "05",
      categoria: "medico",
      tipo: "Remoção",
      posicao: P(218.3, 637.3),
      alturaMarcador: 4.5,
      zonaId: null,
      modelos: [{ tipo: "veiculo", posicao: P(218.3, 637.3), rotacao: aoLongo(-0.4), forma: "ambulancia" }],
      itensAta: [],
      resumo: "Ambulância posicionada ao lado da tenda médica, com saída pela avenida.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["Consta no mapa de arena; não aparece na lista de materiais da ata."],
    },
    {
      id: "dispersao",
      nome: "Dispersão",
      legenda: "06",
      categoria: "atleta",
      tipo: "Pós-chegada",
      posicao: P(522.7, 602.3),
      alturaMarcador: 6,
      zonaId: null,
      modelos: [{ tipo: "tenda", posicao: P(522.7, 602.3), lado: 5, quantidade: 6, colunas: 2, passo: [5.2, 7] }],
      itensAta: [ata("Dispersão + frutas")],
      resumo: "Seis tendas 5x5 dentro da alça de retorno, com corredores de grade separando as filas.",
      status: PLANTA,
      responsavel: null,
      observacoes: [],
      principal: true,
    },
    {
      id: "lixo",
      nome: "Lixo",
      legenda: "07",
      categoria: "operacao",
      tipo: "Resíduos",
      posicao: P(579, 665),
      alturaMarcador: 5,
      zonaId: null,
      modelos: [{ tipo: "tenda", posicao: P(579, 665), rotacao: aoLongo(0.46), lado: 5, quantidade: 3, colunas: 3, fechamentos: true }],
      itensAta: [ata("Lixo"), ata("Lixeiras (aramadas)"), ata("Lixeiras (ultra bag)")],
      resumo: "Tendas de resíduos ao lado da alça de retorno.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["A planta desenha 3 tendas; a ata lista 2 tendas 5x5 de lixo."],
    },
    {
      id: "base-operacao",
      nome: "Limpeza, carregadores, depósito e segurança",
      legenda: "08 · 09 · 10 · 11",
      categoria: "operacao",
      tipo: "Operação",
      posicao: somar(GV, -4, ANG_GV, -6),
      alturaMarcador: 5,
      zonaId: null,
      modelos: [
        { tipo: "tenda", posicao: somar(GV, -11, ANG_GV, -5), rotacao: aoLongo(ANG_GV), lado: 3, quantidade: 3, colunas: 3, fechamentos: true },
        { tipo: "tenda", posicao: somar(GV, 2, ANG_GV, -5.5), rotacao: aoLongo(ANG_GV), lado: 5, quantidade: 2, colunas: 2, fechamentos: true },
      ],
      itensAta: [ata("Limpeza, segurança, carregadores"), ata("Depósito"), ata("Paleteira"), ata("Carrinho plataforma")],
      resumo: "Equipes de limpeza, carregadores e segurança e o depósito, na ponta do guarda-volumes.",
      status: PLANTA,
      responsavel: null,
      observacoes: [],
    },
    {
      id: "guarda-volumes",
      nome: "Guarda-volumes",
      legenda: "12",
      categoria: "atleta",
      tipo: "GV — 45 x 5 m",
      posicao: GV,
      alturaMarcador: 6,
      zonaId: "arena",
      modelos: [{ tipo: "tenda", posicao: GV, rotacao: aoLongo(ANG_GV), lado: 5, quantidade: 9, colunas: 9, fechamentos: true, passo: [5, 5] }],
      itensAta: [ata("GV (guarda-volumes)"), { ...ata("Quadro metal"), quantidade: 6, obs: "GV" }],
      resumo: "Nove tendas 5x5 em linha contínua de 45 m ao longo da via norte.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["Comprimento de 45 m e largura de 5 m cotados na planta."],
      principal: true,
    },
    {
      id: "cacamba",
      nome: "Caçamba",
      legenda: "13",
      categoria: "operacao",
      tipo: "Resíduos",
      posicao: P(965.6, 411.7),
      alturaMarcador: 4,
      zonaId: null,
      modelos: [{ tipo: "cacamba", posicao: P(965.6, 411.7), rotacao: 0.25 }],
      itensAta: [],
      resumo: "Caçamba junto à via norte, com acesso de caminhão.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["Consta no mapa de arena; não aparece na ata."],
    },
    {
      id: "banheiros",
      nome: "Banheiros",
      legenda: "14",
      categoria: "atleta",
      tipo: "Sanitários químicos",
      posicao: P(1059.5, 384.4),
      alturaMarcador: 5,
      zonaId: null,
      modelos: [{ tipo: "banheiros", posicao: P(1059.5, 384.4), rotacao: aoLongo(-0.182), quantidade: 40 }],
      itensAta: [],
      resumo: "Linha de banheiros de cerca de 48 m junto à via norte.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["A planta desenha a linha sem informar a quantidade; o 3D usa unidades de 1,2 m para representar o comprimento."],
      principal: true,
    },
    {
      id: "assessorias",
      nome: "Assessorias",
      legenda: "15",
      categoria: "atleta",
      tipo: "Área das assessorias",
      posicao: P(1141.4, 466.7),
      alturaMarcador: 4,
      zonaId: "assessorias",
      modelos: [],
      itensAta: [],
      resumo: "Área reservada às assessorias de corrida no gramado a leste.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["A planta marca a área; tendas das assessorias não são detalhadas."],
    },
    {
      id: "quadro-fotos",
      nome: "Quadros de fotos",
      legenda: "17",
      categoria: "cenografia",
      tipo: "Painéis 4 m",
      posicao: QUADROS,
      alturaMarcador: 6,
      zonaId: null,
      modelos: Array.from({ length: 7 }, (_, k) => ({ tipo: "quadro" as const, posicao: somar(QUADROS, (k - 3) * 5.4, ANG_QUADROS), rotacao: aoLongo(ANG_QUADROS) })),
      itensAta: [ata("Quadro 4x3")],
      resumo: "Linha de quadros para fotos voltada para a arena, junto à via norte.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["A planta mostra 7 quadros de 4 m; a ata lista 3 quadros 4x3."],
    },
    {
      id: "icone",
      nome: "Ícone",
      legenda: "19",
      categoria: "cenografia",
      tipo: "Ícone tênis",
      posicao: P(798.3, 614.4),
      alturaMarcador: 5,
      zonaId: "arena",
      modelos: [{ tipo: "totem", posicao: P(798.3, 614.4), forma: "tenis" }],
      itensAta: [ata("Ícone tênis")],
      resumo: "Ícone cenográfico entre as duas fileiras de estandes.",
      status: PLANTA,
      responsavel: null,
      observacoes: [],
    },
    {
      id: "palco",
      nome: "Palco",
      legenda: "20 · 01 · 03",
      categoria: "estrutura",
      tipo: "Palco 8x4",
      posicao: P(978, 606),
      alturaMarcador: 10,
      zonaId: "arena",
      modelos: [
        { tipo: "palco", posicao: P(978, 606), rotacao: -Math.PI / 2, largura: 8, profundidade: 4 },
        { tipo: "tenda", posicao: P(986, 606), lado: 3, quantidade: 1, fechamentos: true },
        { tipo: "gerador", posicao: P(1004.4, 608.3), rotacao: Math.PI / 2, quantidade: 1 },
      ],
      itensAta: [ata("Palco 8x4"), { ...ata("Balcão (1,20 x 1,0)"), quantidade: 1, obs: "Palco" }, { ...ata("Ombrelone"), quantidade: 1, obs: "Palco" }],
      resumo: "Palco 8x4 voltado para os estandes, com som e gerador atrás.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["Cotas de 8 m por 4 m na planta.", GERADORES],
      principal: true,
    },
    ...pontosEstandes(),
    {
      id: "espaco-livelo",
      nome: "Espaço Livelo",
      legenda: "30",
      categoria: "patrocinio",
      tipo: "Ativação",
      posicao: P(894.7, 645.8),
      alturaMarcador: 4,
      zonaId: "arena",
      modelos: [{ tipo: "espaco", posicao: P(894.7, 645.8), raio: 3.5 }],
      itensAta: [],
      resumo: "Espaço circular de ativação da Livelo na fileira sul.",
      status: PLANTA,
      responsavel: null,
      observacoes: ["Consta no mapa de arena; a ata não detalha este espaço."],
    },
  ],
  semPosicaoNaPlanta: [{ item: "16 · Trimandala", motivo: "Está na legenda do mapa, mas sem posição desenhada. A ata lista 1 trimandala em box truss." }],
  contagensDaPlanta: [
    { item: "Estacas", quantidade: 43 },
    { item: "Malotes", quantidade: 4 },
  ],
  ata: ATA_ECO_RUN_SP,
  corredores: [],
};
