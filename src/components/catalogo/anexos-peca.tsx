"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { toastSucesso } from "@/components/ui/toast";
import { adicionarAnexoPecaAction, removerAnexoPecaAction } from "@/app/(app)/catalogo/actions";

type Anexo = { id: string; tipo: "IMAGEM" | "PDF"; nomeArquivo: string; tamanho: number };

const LIMITE = 8 * 1024 * 1024;
const LADO_MAX = 2000;
const ACEITOS = "image/png,image/jpeg,image/webp,application/pdf";

const tamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Foto do celular (4000 px, 5–10 MB) reduzida no navegador antes de enviar: o envio fica rápido no 4G e
 * cabe no limite do servidor. Se o navegador não conseguir, vai o original (o servidor reduz).
 */
async function reduzir(f: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return f;
  try {
    const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
    if (escala === 1 && f.size <= 1.5 * 1024 * 1024) return f;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], f.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch {
    return f;
  }
}

/** O que dá para avisar antes de enviar (o servidor confere de novo pelo conteúdo do arquivo). */
function problema(f: File): string | null {
  if (/heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) return `“${f.name}” está em HEIC (iPhone). No iPhone: Ajustes › Câmera › Formatos › Mais compatível, ou envie pelo app Fotos como JPG.`;
  if (!ACEITOS.split(",").includes(f.type)) return `“${f.name}” não é foto (PNG, JPG, WEBP) nem PDF.`;
  if (f.type === "application/pdf" && f.size > LIMITE) return `“${f.name}” tem ${tamanho(f.size)}; o limite do PDF é 8 MB.`;
  return null;
}

type Resultado = { ok: true } | { ok: false; erro: string };

/**
 * Fotos e anexos (PDF) de uma peça do catálogo: ver, ampliar, incluir vários de uma vez e remover. O estoque da
 * Ativação usa o mesmo componente com a sua rota e as suas ações (`urlBase`, `campos`, `adicionar`, `remover`).
 */
export function AnexosPeca({
  pecaId,
  anexos,
  podeGerenciar,
  urlBase = "/api/pecas/anexos",
  campos,
  adicionar = adicionarAnexoPecaAction,
  remover: removerAcao = removerAnexoPecaAction,
  vazio,
}: {
  pecaId: string;
  anexos: readonly Anexo[];
  podeGerenciar: boolean;
  urlBase?: string;
  /** Campos do formulário de envio (padrão: `pecaId`). */
  campos?: Record<string, string>;
  adicionar?: (form: FormData) => Promise<Resultado>;
  remover?: (id: string) => Promise<Resultado>;
  vazio?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [remover, setRemover] = useState<string | null>(null);
  const [removendo, iniciarRemocao] = useTransition();
  const fotos = anexos.filter((a) => a.tipo === "IMAGEM");
  const pdfs = anexos.filter((a) => a.tipo === "PDF");

  const enviar = async (lista: File[]) => {
    if (!lista.length) return;
    const falhas: string[] = [];
    let ok = 0;
    for (const [i, f] of lista.entries()) {
      setEnviando({ atual: i + 1, total: lista.length });
      const p = problema(f);
      if (p) {
        falhas.push(p);
        continue;
      }
      const arquivo = await reduzir(f);
      if (arquivo.size > LIMITE) {
        falhas.push(`“${f.name}” continua grande demais (${tamanho(arquivo.size)}). Envie uma foto menor.`);
        continue;
      }
      const form = new FormData();
      for (const [k, v] of Object.entries(campos ?? { pecaId })) form.set(k, v);
      form.set("arquivo", arquivo);
      const r = await adicionar(form).catch(() => ({ ok: false as const, erro: `Falha de conexão ao enviar “${f.name}”.` }));
      if (r.ok) ok++;
      else falhas.push(r.erro);
    }
    setEnviando(null);
    setErros(falhas);
    if (ok) toastSucesso(ok === 1 ? "Arquivo incluído." : `${ok} arquivos incluídos.`);
    router.refresh();
  };

  const confirmarRemocao = (id: string) =>
    iniciarRemocao(async () => {
      const r = await removerAcao(id);
      if (!r.ok) setErros([r.erro]);
      else toastSucesso("Arquivo removido.");
      setRemover(null);
      router.refresh();
    });

  const botaoRemover = (a: Anexo, className?: string) =>
    remover === a.id ? (
      <span className={cn("inline-flex items-center gap-1 rounded-controle border border-danger-border bg-surface p-0.5 shadow-pill", className)}>
        <Button variant="danger" size="xs" loading={removendo} onClick={() => confirmarRemocao(a.id)}>
          Remover
        </Button>
        <Button variant="ghost" size="xs" disabled={removendo} onClick={() => setRemover(null)}>
          Não
        </Button>
      </span>
    ) : (
      <IconButton label={`Remover ${a.nomeArquivo}`} onClick={() => setRemover(a.id)} className={cn("border-line bg-surface/95 text-danger shadow-pill", className)}>
        <Icone nome="lixeira" />
      </IconButton>
    );

  return (
    <div
      onDragOver={(e) => podeGerenciar && e.preventDefault()}
      onDrop={(e) => {
        if (!podeGerenciar || enviando) return;
        e.preventDefault();
        void enviar([...e.dataTransfer.files]);
      }}
    >
      {anexos.length === 0 ? (
        <p className="m-0 px-cartao py-5 text-center text-pequeno text-muted">{vazio ?? (podeGerenciar ? "Nenhuma foto ou anexo ainda. Inclua fotos da peça montada e, se tiver, o desenho técnico em PDF." : "Nenhuma foto ou anexo.")}</p>
      ) : (
        <>
          {fotos.length > 0 && (
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-cartao sm:grid-cols-3 md:grid-cols-4">
              {fotos.map((a, i) => (
                <li key={a.id} className="group relative">
                  <ImagemZoom src={`${urlBase}/${a.id}`} alt={a.nomeArquivo} className="aspect-[4/3] w-full overflow-hidden rounded-controle border border-line" />
                  <p className="m-0 mt-1 flex items-center gap-1.5 text-rotulo text-muted">
                    {i === 0 && <span className="rounded-chip bg-accent-bg px-1.5 font-medium text-accent">capa</span>}
                    <span className="truncate">{a.nomeArquivo}</span>
                  </p>
                  {podeGerenciar && botaoRemover(a, cn("absolute right-1.5 top-1.5", remover !== a.id && "sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"))}
                </li>
              ))}
            </ul>
          )}
          {pdfs.length > 0 && (
            <ul className={cn("m-0 list-none divide-y divide-line-row p-0", fotos.length > 0 && "border-t border-line-soft")}>
              {pdfs.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-cartao py-2.5 text-corpo">
                  <a href={`${urlBase}/${a.id}`} target="_blank" rel="noopener" className="link flex min-w-0 items-center gap-2">
                    <Icone nome="link-externo" className="shrink-0 text-ink-3" />
                    <span className="truncate">{a.nomeArquivo}</span>
                    <span className="numero shrink-0 text-rotulo text-muted">PDF · {tamanho(a.tamanho)}</span>
                  </a>
                  {podeGerenciar && botaoRemover(a)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {podeGerenciar && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft px-cartao py-3">
          <Button variant="secondary" size="sm" loading={Boolean(enviando)} onClick={() => input.current?.click()}>
            <Icone nome="mais" />
            Incluir fotos ou PDF
          </Button>
          <span className="text-pequeno text-muted" aria-live="polite">
            {enviando ? `Enviando ${enviando.atual} de ${enviando.total}…` : "Pode escolher vários de uma vez ou arrastar para cá. Fotos são reduzidas automaticamente; PDF até 8 MB."}
          </span>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACEITOS}
            className="sr-only"
            tabIndex={-1}
            aria-label="Escolher fotos ou PDF"
            onChange={(e) => {
              const lista = [...(e.target.files ?? [])];
              e.target.value = "";
              void enviar(lista);
            }}
          />
          {erros.length > 0 && (
            <div className="basis-full">
              {erros.map((m) => (
                <FormError key={m} message={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
