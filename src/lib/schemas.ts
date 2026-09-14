import { z } from "zod";
import { ITEM_OPERACOES, ITEM_STATUS, PERFIS, SETORES } from "@/server/db/schema";

const texto = (max: number, msg = "Campo obrigatório") => z.string().trim().min(1, msg).max(max, `Máximo de ${max} caracteres`);
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));
const inteiroPositivo = z.coerce.number().int("Use um número inteiro").positive("Informe um valor maior que zero");
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const bool = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),
  senha: z.string().min(1, "Informe a senha"),
});

export const recuperarSenhaSchema = z.object({ email: z.string().trim().email("Informe um e-mail válido") });

export const redefinirSenhaSchema = z
  .object({
    token: z.string().min(1),
    senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(100),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { message: "As senhas não conferem", path: ["confirmacao"] });

export const alterarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual"),
    senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(100),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { message: "As senhas não conferem", path: ["confirmacao"] });

export const eventoSchema = z
  .object({
    nome: texto(120),
    cliente: textoOpcional(120),
    local: textoOpcional(160),
    dataMontagem: dataISO,
    dataInicio: dataISO,
    dataFim: dataISO,
    dataDesmontagem: dataISO,
    dataReuniao: z.string().min(1, "Informe a data e hora da reunião"),
    dataCarga: z.union([dataISO, z.literal("")]).transform((v) => (v ? v : null)),
    responsavelId: z.string().min(1, "Escolha o responsável"),
  })
  .superRefine((d, ctx) => {
    if (d.dataInicio < d.dataMontagem) ctx.addIssue({ code: "custom", path: ["dataInicio"], message: "Início não pode ser antes da montagem" });
    if (d.dataFim < d.dataInicio) ctx.addIssue({ code: "custom", path: ["dataFim"], message: "Fim não pode ser antes do início" });
    if (d.dataDesmontagem < d.dataFim) ctx.addIssue({ code: "custom", path: ["dataDesmontagem"], message: "Desmontagem não pode ser antes do fim" });
  });

export const justificativaSchema = z.object({ justificativa: texto(500, "Informe a justificativa") });

export const solicitacaoCabecalhoSchema = z.object({
  titulo: textoOpcional(120),
  observacao: textoOpcional(1000),
});

export const solicitacaoItemSchema = z
  .object({
    operacao: z.enum(ITEM_OPERACOES),
    referenciaTipo: z.enum(["PROJETO", "PECA", "AVULSO"]).optional(),
    projetoId: textoOpcional(64),
    pecaId: textoOpcional(64),
    descricaoLivre: textoOpcional(160),
    eventoItemId: textoOpcional(64),
    quantidadeSolicitada: z.coerce.number().int("Use um número inteiro").min(0),
    destino: textoOpcional(60),
    justificativa: textoOpcional(500),
  })
  .transform((d) => {
    // Mantém apenas a referência escolhida
    if (d.operacao === "ADICIONAR") {
      if (d.referenciaTipo === "PROJETO") return { ...d, pecaId: null, descricaoLivre: null, eventoItemId: null };
      if (d.referenciaTipo === "PECA") return { ...d, projetoId: null, descricaoLivre: null, eventoItemId: null };
      if (d.referenciaTipo === "AVULSO") return { ...d, projetoId: null, pecaId: null, eventoItemId: null };
      return { ...d, eventoItemId: null };
    }
    return { ...d, projetoId: null, pecaId: null, descricaoLivre: null };
  });

export const respostaItemSchema = z.object({
  status: z.enum(ITEM_STATUS),
  quantidadeAtendida: z.coerce.number().int().min(0).optional(),
  observacaoLogistica: textoOpcional(500),
  pendenciaCompra: bool,
  justificativa: textoOpcional(500),
});

export const ataLinhaSchema = z
  .object({
    referenciaTipo: z.enum(["PROJETO", "PECA", "AVULSO"]),
    projetoId: textoOpcional(64),
    pecaId: textoOpcional(64),
    descricaoLivre: textoOpcional(160),
    quantidade: inteiroPositivo,
    destino: textoOpcional(60),
    areaId: textoOpcional(64),
    justificativa: textoOpcional(500),
  })
  .superRefine((d, ctx) => {
    if (d.referenciaTipo === "PROJETO" && !d.projetoId) ctx.addIssue({ code: "custom", path: ["projetoId"], message: "Escolha o projeto" });
    if (d.referenciaTipo === "PECA" && !d.pecaId) ctx.addIssue({ code: "custom", path: ["pecaId"], message: "Escolha a peça" });
    if (d.referenciaTipo === "AVULSO" && !d.descricaoLivre) ctx.addIssue({ code: "custom", path: ["descricaoLivre"], message: "Descreva o item" });
  });

export const ataAlterarQuantidadeSchema = z.object({
  quantidade: z.coerce.number().int().min(0),
  justificativa: textoOpcional(500),
});

export const pecaSchema = z.object({
  codigo: texto(30).transform((v) => v.toUpperCase()),
  nome: texto(120),
  setor: z.enum(SETORES),
  familia: textoOpcional(60).transform((v) => v ?? ""),
  unidade: texto(10).default("un"),
  descricao: textoOpcional(500),
  estoqueProprio: z.coerce.number().int().min(0).default(0),
  permiteEmProjeto: bool,
});

export const projetoSchema = z.object({
  nome: texto(120),
  categoria: textoOpcional(60).transform((v) => v ?? ""),
  descricao: textoOpcional(1000),
  observacaoVersao: textoOpcional(300),
  itens: z
    .array(z.object({ pecaId: z.string().min(1), quantidade: inteiroPositivo }))
    .min(1, "Adicione ao menos uma peça à lista de materiais"),
});

export const usuarioSchema = z.object({
  nome: texto(120),
  email: z.string().trim().email("Informe um e-mail válido").max(160),
  perfil: z.enum(PERFIS),
  areaId: textoOpcional(64),
  senha: z.string().max(100).optional().transform((v) => (v ? v : null)),
  ativo: bool,
});

export const areaSchema = z.object({ nome: texto(60), ativo: bool });

export const configuracoesSchema = z.object({
  sla_resposta_horas: z.coerce.number().int().min(1).max(720),
  lembrete_reuniao_dias: z.coerce.number().int().min(0).max(30),
  bloquear_encerramento_com_pendentes: bool,
});
