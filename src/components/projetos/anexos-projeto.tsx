"use client";

import { adicionarAnexoProjetoAction, removerAnexoProjetoAction } from "@/app/(app)/projetos/actions";
import { AnexosPeca } from "@/components/catalogo/anexos-peca";

type Anexo = { id: string; tipo: "IMAGEM" | "PDF"; nomeArquivo: string; tamanho: number };

/**
 * Fotos e desenhos do projeto com o mesmo componente da peça e da Ativação: vários arquivos de uma vez ou arrastando,
 * foto reduzida no navegador antes de enviar, capa marcada e "1 KB" no PDF pequeno. Antes era um arquivo por vez
 * ("Escolher arquivo" + "Enviar"), sem reduzir, e o PDF pequeno aparecia com "0 KB" (auditoria 30/10, parte C N15 e N16).
 */
export function AnexosProjeto({ projetoId, anexos, podeGerenciar }: { projetoId: string; anexos: Anexo[]; podeGerenciar: boolean }) {
  return (
    <AnexosPeca
      pecaId={projetoId}
      anexos={anexos}
      podeGerenciar={podeGerenciar}
      urlBase="/api/anexos"
      campos={{ projetoId }}
      adicionar={adicionarAnexoProjetoAction}
      remover={removerAnexoProjetoAction}
      vazio={podeGerenciar ? "Nenhuma foto ou desenho ainda. Inclua o render, a modulação ou o PDF técnico." : "Nenhuma foto ou desenho."}
    />
  );
}
