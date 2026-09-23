import { Icone } from "@/components/ui/icons";

/**
 * Nomes antigos dos ícones do mapa, mantidos para os imports existentes. Os desenhos agora vêm do
 * conjunto único (`ui/icons.tsx`, docs/design-system.md § 2): 20 px nos controles flutuantes do mapa,
 * 16 px em botões, menus e campos. Código novo usa `<Icone nome=…>` direto.
 */
type P = { className?: string };

export const IconeMais = (p: P) => <Icone nome="mais" tamanho={20} className={p.className} />;
export const IconeMenos = (p: P) => <Icone nome="menos" tamanho={20} className={p.className} />;
export const IconeEnquadrar = (p: P) => <Icone nome="enquadrar" tamanho={20} className={p.className} />;
export const IconeNorte = (p: P) => <Icone nome="norte" tamanho={20} className={p.className} />;
export const IconeCamadas = (p: P) => <Icone nome="camadas" tamanho={20} className={p.className} />;
export const IconeTelaCheia = (p: P) => <Icone nome="tela-cheia" tamanho={20} className={p.className} />;
export const IconeSairTelaCheia = (p: P) => <Icone nome="sair-tela-cheia" tamanho={20} className={p.className} />;
export const IconeLista = (p: P) => <Icone nome="lista" tamanho={20} className={p.className} />;
export const IconePerspectiva = (p: P) => <Icone nome="perspectiva" tamanho={20} className={p.className} />;
export const IconeTeclado = (p: P) => <Icone nome="teclado" tamanho={20} className={p.className} />;
export const IconeSuperior = (p: P) => <Icone nome="vista-superior" tamanho={20} className={p.className} />;
export const IconeBusca = (p: P) => <Icone nome="busca" className={p.className} />;
export const IconeRegua = (p: P) => <Icone nome="regua" className={p.className} />;
export const IconeImprimir = (p: P) => <Icone nome="imprimir" className={p.className} />;
