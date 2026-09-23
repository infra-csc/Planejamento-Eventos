import { z } from "zod";
import { ITEM_OPERACOES, ITEM_STATUS, PERFIS, SETORES } from "@/domain/constantes";

// Postgres rejeita NUL em texto; nada legítimo contém esse caractere.
const semNul = (s: string) => s.replace(/\0/g, "");
const texto = (max: number, msg = "Campo obrigatório") => z.string().transform(semNul).pipe(z.string().trim().min(1, msg).max(max, `Máximo de ${max} caracteres`));
const textoOpcional = (max: number) =>
  z
    .string()
    .transform(semNul)
    .pipe(z.string().trim().max(max, `Máximo de ${max} caracteres`))
    // `formData.get()` de um campo ausente devolve null, não undefined.
    .nullish()
    .transform((v) => (v ? v : null));
const QTD_MAX = 1_000_000;
const inteiroPositivo = z.coerce.number().int("Use um número inteiro").positive("Informe um valor maior que zero").max(QTD_MAX, `Máximo de ${QTD_MAX.toLocaleString("pt-BR")}`);
const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  // "2026-02-30" passa no formato mas não existe no calendário.
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d, "Data inválida");
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

export const dadosReuniaoSchema = z.object({
  reuniaoPresentes: textoOpcional(2000),
  publicoEsperado: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v.replace(/\./g, "")) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 10_000_000), "Informe um número inteiro"),
  caminhaoCarrega: textoOpcional(120),
  caminhaoSai: textoOpcional(120),
  arenaDescarrega: textoOpcional(120),
  kitDescarrega: textoOpcional(120),
});

/** Cadastro enxuto: responsável é quem cria; montagem, fim, desmontagem e carga não são pedidos. */
export const eventoSchema = z.object({
  nome: texto(120),
  cliente: textoOpcional(120),
  local: textoOpcional(160),
  dataInicio: dataISO,
  dataReuniao: z.string().min(1, "Informe a data e hora da reunião"),
  janelaAlteracoesAte: z
    .union([dataISO, z.literal("")])
    .nullish()
    .transform((v) => (v ? v : null)),
});

export const justificativaSchema = z.object({ justificativa: texto(500, "Informe a justificativa") });

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
  quantidade: z.coerce.number().int().min(0).max(QTD_MAX, `Máximo de ${QTD_MAX.toLocaleString("pt-BR")}`),
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
  aviso_prazo_horas: z.coerce.number().int().min(0).max(168),
  antecedencia_reuniao_horas: z.coerce.number().int().min(0).max(168),
  lembrete_reuniao_dias: z.coerce.number().int().min(0).max(30),
  bloquear_encerramento_com_pendentes: bool,
});

const idOpcional = z.string().trim().max(64).nullable().optional().transform((v) => (v ? v : null));
const textoLivre = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres`).nullable().optional().transform((v) => (v ? v : null));

/** Formulário único de solicitação (nova ou rascunho), enviado como JSON. */
export const solicitacaoCompletaSchema = z.object({
  id: idOpcional,
  eventoId: z.string().min(1, "Escolha o evento"),
  /** Só o Administrador escolhe a área; os demais perfis usam a própria. */
  areaId: idOpcional,
  titulo: textoLivre(120),
  observacao: textoLivre(1000),
  enviar: z.boolean(),
  itens: z
    .array(
      z.object({
        operacao: z.enum(ITEM_OPERACOES),
        projetoId: idOpcional,
        pecaId: idOpcional,
        eventoItemId: idOpcional,
        descricaoLivre: textoLivre(160),
        quantidadeSolicitada: z.coerce.number().int("Use um número inteiro").min(0).max(QTD_MAX, `Máximo de ${QTD_MAX.toLocaleString("pt-BR")}`),
        destino: textoLivre(60),
        justificativa: textoLivre(500),
        descricoes: z.array(z.string().max(300, "Descrição com até 300 caracteres")).max(1000).nullable().optional(),
        ajustesBom: z
          .array(z.object({ pecaId: z.string().min(1), quantidade: z.coerce.number().int().min(-QTD_MAX).max(QTD_MAX) }))
          .max(200)
          .nullable()
          .optional()
          .transform((v) => (v ? v.filter((a) => a.quantidade !== 0) : null)),
      }),
    )
    .max(100, "Máximo de 100 itens por solicitação"),
});
