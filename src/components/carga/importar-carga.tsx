"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { CaptionOculta } from "@/components/ui/tabela";
import { toastSucesso } from "@/components/ui/toast";
import { importarCargaAction, previaImportacaoCargaAction } from "@/app/(app)/carga-descarga/actions";
import { TIPO_VEICULO_LABEL } from "@/domain/carga-descarga";
import type { LinhaPrevia } from "@/server/services/carga-importacao";
import { IconeVeiculo, TagCargaChip } from "./base";
import { ResumoTrechos } from "./detalhe-veiculo";

const MODELO = "/api/carga-descarga/modelo";

/**
 * Subir veículos em lote: baixar o modelo, enviar a planilha, conferir linha a linha (o que entra, o
 * que já estava cadastrado e o que tem erro) e só então importar. Linhas com erro ficam de fora; dá
 * para corrigir e enviar a mesma planilha de novo, porque os veículos iguais não duplicam.
 */
export function ImportarCarga() {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-cartao border border-dashed border-line-strong bg-surface px-cartao py-2.5">
      <p className="m-0 min-w-0 flex-1 basis-60 text-pequeno text-ink-2">
        <b className="font-semibold text-ink">Muitos veículos?</b> Preencha o modelo e envie todos de uma vez.
      </p>
      <a href={MODELO} className="inline-flex items-center gap-1.5 text-pequeno font-medium text-accent no-underline hover:underline" download>
        <Icone nome="download" />
        Baixar modelo
      </a>
      <Button abreDialogo variant="secondary" size="sm" onClick={() => setAberto(true)}>
        <Icone nome="seta-cima" />
        Importar planilha
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        {aberto && <DialogImportar onFechar={() => setAberto(false)} />}
      </Dialog>
    </div>
  );
}

function DialogImportar({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaPrevia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, ler] = useTransition();
  const [gravando, gravar] = useTransition();

  const escolher = (f: File | undefined) => {
    if (!f) return;
    setArquivo(f.name);
    setErro(null);
    setLinhas(null);
    const form = new FormData();
    form.set("arquivo", f);
    ler(async () => {
      const r = await previaImportacaoCargaAction(form);
      if (!r.ok) return setErro(r.erro);
      setLinhas(r.dados?.linhas ?? []);
    });
  };

  const validas = (linhas ?? []).filter((l) => l.veiculo && l.eventoId && !l.erros.length);
  const comErro = (linhas ?? []).filter((l) => l.erros.length);
  const novos = validas.reduce((s, l) => s + l.novos, 0);
  const jaExistiam = validas.reduce((s, l) => s + l.jaExistiam, 0);
  // Erros primeiro: é o que pede ação.
  const ordenadas = [...comErro, ...(linhas ?? []).filter((l) => !l.erros.length)];

  const importar = () =>
    gravar(async () => {
      const r = await importarCargaAction(validas.map((l) => ({ linha: l.linha, eventoId: l.eventoId!, quantidade: l.quantidade, veiculo: l.veiculo! })));
      if (!r.ok) return setErro(r.erro);
      const d = r.dados!;
      toastSucesso(`${d.criados} ${d.criados === 1 ? "veículo importado" : "veículos importados"}${d.ignorados ? ` · ${d.ignorados} já estavam cadastrados` : ""}`);
      router.refresh();
      onFechar();
    });

  return (
    <DialogContent title="Importar veículos da planilha" description="Use o modelo: uma linha por veículo, com a ida e a volta. Nada é gravado antes da sua confirmação." width={linhas ? 980 : 560}>
      <div className="flex flex-col gap-3">
        {!linhas && (
          <ol className="m-0 flex list-none flex-col gap-2 p-0 text-pequeno text-ink-2">
            <li className="flex gap-2">
              <Passo n={1} />
              <span>
                <a href={MODELO} download className="link font-medium">
                  Baixe o modelo
                </a>{" "}
                (já vem com a lista dos eventos ativos) e preencha a aba Veículos. As regras estão na aba Como preencher.
              </span>
            </li>
            <li className="flex gap-2">
              <Passo n={2} />
              <span>Envie a planilha (.xlsx). O sistema confere cada linha com as mesmas regras do formulário.</span>
            </li>
            <li className="flex gap-2">
              <Passo n={3} />
              <span>Confira e importe. Pode enviar a mesma planilha de novo depois de corrigir: os veículos iguais aos já cadastrados não duplicam.</span>
            </li>
          </ol>
        )}

        <label
          className={cn("flex cursor-pointer flex-wrap items-center gap-3 rounded-cartao border border-dashed px-4 py-3 transition-colors hover:border-accent hover:bg-selected", lendo ? "border-accent bg-selected" : "border-line-strong bg-subtle")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            escolher(e.dataTransfer.files[0]);
          }}
        >
          <Icone nome="seta-cima" className="text-ink-3" />
          <span className="min-w-0 flex-1 text-pequeno">
            {lendo ? (
              <span className="text-ink">Conferindo {arquivo}…</span>
            ) : arquivo ? (
              <>
                <b className="font-medium text-ink">{arquivo}</b> <span className="text-muted">· clique para trocar</span>
              </>
            ) : (
              <>
                <b className="font-medium text-ink">Escolha a planilha</b> <span className="text-muted">ou arraste o arquivo .xlsx para cá</span>
              </>
            )}
          </span>
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              escolher(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>

        <FormError message={erro} />

        {linhas && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-pequeno" aria-live="polite">
              <Contador n={novos} rotulo={novos === 1 ? "veículo novo" : "veículos novos"} cls="border-success-border bg-success-bg text-success" />
              {jaExistiam > 0 && <Contador n={jaExistiam} rotulo={jaExistiam === 1 ? "já cadastrado (não duplica)" : "já cadastrados (não duplicam)"} cls="border-line bg-subtle text-ink-2" />}
              {comErro.length > 0 && <Contador n={comErro.length} rotulo={comErro.length === 1 ? "linha com erro" : "linhas com erro"} cls="border-danger-border bg-danger-bg text-danger" />}
              <span className="text-muted">
                {linhas.length} {linhas.length === 1 ? "linha lida" : "linhas lidas"}
              </span>
            </div>
            {comErro.length > 0 && <p className="m-0 text-pequeno text-ink-2">As linhas com erro ficam de fora. Corrija na planilha e envie de novo: o que já entrou não duplica.</p>}
            {/* Linha com erro não tem veículo: o motivo ocupa as três últimas colunas (antes cortado a 768). No celular cada
                linha vira um cartão com o número e a situação primeiro (antes o erro ficava fora da tela a 375; auditoria 30/10, parte D N9). */}
            <div className="max-h-[52vh] overflow-auto rounded-controle border border-line">
              <table className="w-full border-collapse text-left text-pequeno max-md:block">
                {/* Legenda para o leitor de tela (auditoria 28/10, nº 140). */}
                <CaptionOculta>Conferência da planilha, linha a linha: as com erro primeiro</CaptionOculta>
                <thead className="sticky top-0 z-[1] bg-subtle max-md:hidden">
                  <tr className="text-rotulo uppercase tracking-[0.04em] text-muted">
                    <th className="px-3 py-2 font-medium">Linha</th>
                    <th className="px-3 py-2 font-medium">Evento</th>
                    <th className="px-3 py-2 font-medium">Veículo</th>
                    <th className="px-3 py-2 font-medium">Ida e volta</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="max-md:block">
                  {ordenadas.map((l) => {
                    const situacao = l.erros.length ? (
                      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-danger">
                        {l.erros.map((e) => (
                          <li key={e} className="flex gap-1">
                            <Icone nome="erro" className="mt-px size-4 shrink-0" />
                            {e}
                          </li>
                        ))}
                      </ul>
                    ) : l.novos === 0 ? (
                      <span className="text-ink-3">Já cadastrado: não entra de novo</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-success">
                        <Icone nome="check-circulo" className="size-4" />
                        {l.novos === 1 ? "Entra" : `Entram ${l.novos}`}
                        {l.jaExistiam > 0 && (
                          <span className="text-ink-3">
                            {" "}
                            ({l.jaExistiam} já existia
                            {l.jaExistiam > 1 ? "m" : ""})
                          </span>
                        )}
                      </span>
                    );
                    return (
                      <tr key={l.linha} className={cn("border-t border-line-row align-top max-md:flex max-md:flex-col max-md:gap-1 max-md:px-3 max-md:py-2.5 max-md:first:border-t-0", l.erros.length > 0 && "bg-danger-bg/40")}>
                        <td className="numero px-3 py-2 text-muted max-md:p-0">
                          <span className="md:hidden">Linha </span>
                          {l.linha}
                        </td>
                        <td className={cn("px-3 py-2 max-md:order-1 max-md:p-0", !l.evento && "max-md:hidden")}>
                          {l.evento ? (
                            <>
                              <span className="block font-medium text-ink">{l.evento.nome}</span>
                              <span className="numero text-rotulo text-muted">{l.evento.codigo}</span>
                            </>
                          ) : (
                            <span className="text-meta">—</span>
                          )}
                        </td>
                        {l.veiculo ? (
                          <>
                            <td className="px-3 py-2 max-md:order-2 max-md:p-0">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <IconeVeiculo tipo={l.veiculo.tipo} className="text-ink-3" />
                                <span className="font-medium text-ink">
                                  {TIPO_VEICULO_LABEL[l.veiculo.tipo]}
                                  {l.quantidade > 1 && <span className="numero"> ×{l.quantidade}</span>}
                                </span>
                                {l.veiculo.ident && <span className="text-ink-3">· {l.veiculo.ident}</span>}
                                {[...new Set([...l.veiculo.ida.tags, ...l.veiculo.volta.tags])].map((t) => (
                                  <TagCargaChip key={t} tag={t} />
                                ))}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-md:order-3 max-md:p-0 md:min-w-[260px]">
                              <ResumoTrechos v={{ ...l.veiculo, id: "", eventoId: "", atualizadoEm: "", atualizadoPor: null, criadoPor: null }} />
                            </td>
                            <td className="px-3 py-2 max-md:p-0 md:min-w-[160px]">{situacao}</td>
                          </>
                        ) : (
                          <td colSpan={3} className="px-3 py-2 max-md:p-0">
                            {situacao}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <DialogFooter>
        {linhas && (
          <Button variant="primary" size="md" loading={gravando} disabled={novos === 0 || lendo} onClick={importar}>
            {novos === 0 ? "Nada novo para importar" : `Importar ${novos} ${novos === 1 ? "veículo" : "veículos"}`}
          </Button>
        )}
        <DialogClose asChild>
          <Button variant="secondary" size="md" disabled={gravando}>
            {linhas ? "Cancelar" : "Fechar"}
          </Button>
        </DialogClose>
        {linhas && (
          <Button variant="ghost" size="md" className="sm:mr-auto" disabled={lendo || gravando} onClick={() => input.current?.click()}>
            Trocar arquivo
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

function Passo({ n }: { n: number }) {
  return <span className="numero grid size-5 shrink-0 place-items-center rounded-full bg-accent-bg text-rotulo font-semibold text-accent">{n}</span>;
}

function Contador({ n, rotulo, cls }: { n: number; rotulo: string; cls: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5", cls)}>
      <b className="numero font-semibold">{n}</b>
      {rotulo}
    </span>
  );
}
