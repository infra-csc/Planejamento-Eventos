import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { Arena, PontoArena, Vec2 } from "@/domain/arena/tipos";
import { CATEGORIAS, type Camada } from "@/domain/arena/categorias";
import { limitesArena } from "@/domain/arena/geometria";
import { COR_HORIZONTE, Materiais, PALETA, type Qualidade } from "./materiais";
import { construirAmbiente } from "./ambiente";
import { construirModelo } from "./estruturas";
import { construirFluxo, construirPercurso, construirPublico, type Fluxo } from "./percurso";
import { fita } from "./fita";

export type Vista = "perspectiva" | "superior";

export type EventosMotor = {
  aoPassar: (id: string | null) => void;
  aoSelecionar: (id: string | null) => void;
  aoPronto: () => void;
  aoErro: (mensagem: string) => void;
  aoDesempenhoBaixo: () => void;
  /** Recebe a área do chão vista pela câmera (4 cantos), a cada quadro desenhado. */
  aoMoverCamera?: (pegada: Array<[number, number]>) => void;
};

type OpcoesMotor = {
  container: HTMLElement;
  overlay: HTMLElement;
  arena: Arena;
  qualidade: Qualidade;
  camadas: Record<Camada, boolean>;
  reduzirMovimento: boolean;
  eventos: EventosMotor;
};

type Alvo = { id: string; camada: Camada; caixa: THREE.Box3; hit: THREE.Mesh; grupo: THREE.Group; contorno: THREE.Vector3[] };

/** Envoltória convexa (cadeia monótona) para o contorno de seleção acompanhar estruturas giradas. */
function envoltoria(pontos: Array<[number, number]>): Array<[number, number]> {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inferior: Array<[number, number]> = [];
  for (const q of p) {
    while (inferior.length >= 2 && cruz(inferior[inferior.length - 2], inferior[inferior.length - 1], q) <= 0) inferior.pop();
    inferior.push(q);
  }
  const superior: Array<[number, number]> = [];
  for (const q of [...p].reverse()) {
    while (superior.length >= 2 && cruz(superior[superior.length - 2], superior[superior.length - 1], q) <= 0) superior.pop();
    superior.push(q);
  }
  return [...inferior.slice(0, -1), ...superior.slice(0, -1)];
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Cena da arena em three.js puro: renderiza sob demanda (só quando algo muda), usa instâncias
 * para elementos repetidos e posiciona marcadores HTML acessíveis sobre o canvas.
 */
export class MotorArena {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 1, 7000);
  private controls!: MapControls;
  private materiais: Materiais;
  private alvos: Alvo[] = [];
  private hits: THREE.Mesh[] = [];
  private alvoPorHit = new Map<THREE.Object3D, Alvo>();
  private pontoPorId: Map<string, PontoArena>;
  private objetosCamada = new Map<Camada, THREE.Object3D[]>();
  /** Objetos que só aparecem de longe (linha do percurso): lista fixa, sem varrer a cena por quadro. */
  private lodLonge: THREE.Object3D[] = [];
  private ceu: THREE.Mesh | null = null;
  private trilho: LineMaterial | null = null;
  private fluxo: Fluxo | null = null;
  private realce: { hover: Line2; selecao: Line2; matHover: LineMaterial; matSel: LineMaterial } | null = null;
  private raf = 0;
  private sujo = true;
  private tween: { de: [THREE.Vector3, THREE.Vector3]; para: [THREE.Vector3, THREE.Vector3]; inicio: number; duracao: number } | null = null;
  private hoverId: string | null = null;
  private selecaoId: string | null = null;
  private ponteiro: { x: number; y: number; baixo: { x: number; y: number } | null } = { x: 0, y: 0, baixo: null };
  private raycaster = new THREE.Raycaster();
  private visivel = true;
  private inicioFluxo = performance.now();
  private ultimoFluxo = 0;
  private amostrasFrame: number[] = [];
  private ultimoFrame = performance.now();
  private avisouDesempenho = false;
  private limites: ReturnType<typeof limitesArena>;
  private observador: IntersectionObserver | null = null;
  private resize: ResizeObserver | null = null;
  private camadas: Record<Camada, boolean>;

  constructor(private o: OpcoesMotor) {
    this.materiais = new Materiais(o.qualidade);
    this.camadas = { ...o.camadas };
    this.limites = limitesArena(o.arena, 80);
    this.pontoPorId = new Map(o.arena.pontos.map((p) => [p.id, p]));
  }

  iniciar() {
    const { container, qualidade, arena } = this.o;
    const alta = qualidade === "alta";
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: alta, powerPreference: alta ? "high-performance" : "low-power" });
    } catch {
      throw new Error("Este navegador não conseguiu iniciar o WebGL.");
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, alta ? 2 : 1.25));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = alta;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    // A cena é estática: a sombra é calculada uma vez e refeita só quando uma camada muda.
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    r.domElement.style.display = "block";
    r.domElement.style.touchAction = "none";
    r.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(r.domElement);
    r.domElement.addEventListener("webglcontextlost", this.aoPerderContexto);

    // Céu em esfera que acompanha a câmera; névoa exponencial com a cor do horizonte.
    this.scene.background = new THREE.Color(COR_HORIZONTE);
    this.scene.fog = new THREE.FogExp2(COR_HORIZONTE, 0.00035);
    this.ceu = this.materiais.ceuEsfera();
    this.scene.add(this.ceu);

    // Ambiente discreto: preenche, não ilumina (luz demais achatava tudo na faixa clara do ACES).
    this.scene.add(new THREE.HemisphereLight(0xeae6dd, 0x8d9280, 0.62));
    const l = this.limites;
    const centro = new THREE.Vector3((l.minX + l.maxX) / 2, 0, (l.minZ + l.maxZ) / 2);
    // Sol das 06:30 (largada): baixo (~20°), vindo do leste, com sombra longa que revela a altura.
    const sol = new THREE.DirectionalLight(0xffe4c4, 1.75);
    sol.position.set(centro.x + 520, 190, centro.z - 150);
    sol.target.position.copy(centro);
    // Rebatimento do lado oposto, sem sombra: evita face escura morta.
    const rebatimento = new THREE.DirectionalLight(0xdce6f0, 0.28);
    rebatimento.position.set(centro.x - 400, 160, centro.z + 300);
    rebatimento.target.position.copy(centro);
    if (alta) {
      sol.castShadow = true;
      // Calculada uma vez (autoUpdate desligado): o custo é só memória.
      sol.shadow.mapSize.set(4096, 4096);
      const u = limitesArena(arena, 60);
      const s = sol.shadow.camera;
      const meiaL = (u.maxX - u.minX) / 2;
      const meiaA = (u.maxZ - u.minZ) / 2 + 20;
      s.left = -meiaL;
      s.right = meiaL;
      s.top = meiaA;
      s.bottom = -meiaA;
      s.near = 50;
      s.far = 1600;
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.5;
    }
    this.scene.add(sol, sol.target, rebatimento, rebatimento.target);

    this.construir();

    this.controls = new MapControls(this.camera, r.domElement);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.screenSpacePanning = false;
    c.minDistance = 22;
    c.maxDistance = 2100;
    c.maxPolarAngle = 1.32;
    c.zoomToCursor = true;
    c.addEventListener("change", this.aoMudarCamera);
    this.posicionarInicial(false);

    r.domElement.addEventListener("pointermove", this.aoMoverPonteiro);
    r.domElement.addEventListener("pointerdown", this.aoApertar);
    r.domElement.addEventListener("pointerup", this.aoSoltar);
    r.domElement.addEventListener("pointerleave", this.aoSairPonteiro);
    document.addEventListener("visibilitychange", this.aoMudarVisibilidade);
    this.observador = new IntersectionObserver(([e]) => {
      this.visivel = e.isIntersecting;
      this.sujo = true;
    });
    this.observador.observe(container);
    this.resize = new ResizeObserver(() => this.redimensionar());
    this.resize.observe(container);
    this.redimensionar();
    this.aplicarCamadas();
    this.laco();
    this.o.eventos.aoMoverCamera?.(this.pegadaCamera());
    if (new URLSearchParams(window.location.search).has("diagnostico")) (window as unknown as { __arena?: MotorArena }).__arena = this;
    this.o.eventos.aoPronto();
  }

  private registrar(camada: Camada, obj: THREE.Object3D) {
    const lista = this.objetosCamada.get(camada) ?? [];
    lista.push(obj);
    this.objetosCamada.set(camada, lista);
    this.scene.add(obj);
  }

  private construir() {
    const { arena } = this.o;
    const m = this.materiais;
    const alta = m.qualidade === "alta";
    const { base, zonas } = construirAmbiente(arena, m);
    this.scene.add(base);
    this.registrar("zonas", zonas);

    const percurso = construirPercurso(arena, m);
    this.trilho = percurso.trilho;
    percurso.grupo.traverse((obj) => {
      if (obj.userData.lod === "longe") this.lodLonge.push(obj);
    });
    this.registrar("percurso", percurso.grupo);
    this.registrar("publico", construirPublico(arena, m));
    this.fluxo = construirFluxo(arena, m);
    this.registrar("fluxo", this.fluxo.mesh);

    // Piso do corredor entre as duas fileiras de estandes, como os pisos que as ativações usam.
    const estandes = arena.pontos.filter((p) => p.modelos.some((mo) => mo.tipo === "estander"));
    if (estandes.length >= 2) {
      const xs = estandes.map((p) => p.posicao[0]);
      const zs = estandes.map((p) => p.posicao[1]);
      const meioZ = (Math.min(...zs) + Math.max(...zs)) / 2;
      const eixo: Vec2[] = [
        [Math.min(...xs) - 6, meioZ],
        [Math.max(...xs) + 6, meioZ],
      ];
      const corredor = new THREE.Mesh(fita(eixo, 12, 0.05), m.ruido(0xddd3c4, { variacao: 0.06, metrosPorTile: 8 }));
      corredor.receiveShadow = alta;
      this.registrar("patrocinio", corredor);
    }

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const ponto of arena.pontos) {
      const camada = CATEGORIAS[ponto.categoria].camada;
      const grupo = new THREE.Group();
      grupo.name = ponto.id;
      for (const modelo of ponto.modelos) grupo.add(construirModelo(modelo, m, ponto.nome));
      this.registrar(camada, grupo);
      const caixa = new THREE.Box3();
      if (ponto.modelos.length) caixa.setFromObject(grupo);
      else caixa.setFromCenterAndSize(new THREE.Vector3(ponto.posicao[0], 1.5, ponto.posicao[1]), new THREE.Vector3(16, 3, 12));
      caixa.expandByScalar(1.2);
      const tamanho = caixa.getSize(new THREE.Vector3());
      const hit = new THREE.Mesh(new THREE.BoxGeometry(tamanho.x, Math.max(tamanho.y, ponto.alturaMarcador), tamanho.z), hitMat);
      hit.position.copy(caixa.getCenter(new THREE.Vector3()));
      hit.userData.pontoId = ponto.id;
      this.scene.add(hit);
      this.hits.push(hit);
      grupo.updateMatrixWorld(true);
      const cantos: Array<[number, number]> = [];
      grupo.traverse((o) => {
        if (o.name !== "piso") return;
        const mesh = o as THREE.Mesh;
        mesh.geometry.computeBoundingBox();
        const b = mesh.geometry.boundingBox!;
        for (const [x, z] of [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]]) {
          const w = new THREE.Vector3(x, 0, z).applyMatrix4(mesh.matrixWorld);
          cantos.push([w.x, w.z]);
        }
      });
      const contorno = cantos.length >= 3 ? envoltoria(cantos).map(([x, z]) => new THREE.Vector3(x, 0.25, z)) : [];
      const alvo: Alvo = { id: ponto.id, camada, caixa, hit, grupo, contorno };
      this.alvos.push(alvo);
      this.alvoPorHit.set(hit, alvo);
    }

    const matHover = new LineMaterial({ color: 0x2a1418, linewidth: 2, transparent: true, opacity: 0.55, depthTest: false });
    const matSel = new LineMaterial({ color: PALETA.acento, linewidth: 3, depthTest: false });
    const hover = new Line2(new LineGeometry(), matHover);
    const selecao = new Line2(new LineGeometry(), matSel);
    hover.visible = selecao.visible = false;
    hover.renderOrder = selecao.renderOrder = 10;
    this.scene.add(hover, selecao);
    this.realce = { hover, selecao, matHover, matSel };
  }

  private contorno(linha: Line2, id: string | null) {
    const alvo = id ? this.alvos.find((a) => a.id === id) : null;
    if (!alvo || !this.camadas[alvo.camada]) {
      linha.visible = false;
      return;
    }
    const { min, max } = alvo.caixa;
    const y = 0.25;
    const geo = new LineGeometry();
    const pts = alvo.contorno.length
      ? [...alvo.contorno, alvo.contorno[0]]
      : [new THREE.Vector3(min.x, y, min.z), new THREE.Vector3(max.x, y, min.z), new THREE.Vector3(max.x, y, max.z), new THREE.Vector3(min.x, y, max.z), new THREE.Vector3(min.x, y, min.z)];
    geo.setPositions(pts.flatMap((p) => [p.x, y, p.z]));
    linha.geometry.dispose();
    linha.geometry = geo;
    linha.computeLineDistances();
    linha.visible = true;
  }

  private posicionarInicial(animar: boolean) {
    const l = this.limites;
    const alvo = new THREE.Vector3((l.minX + l.maxX) / 2, 0, (l.minZ + l.maxZ) / 2 - 30);
    const raio = Math.max(l.maxX - l.minX, l.maxZ - l.minZ) * 0.95;
    const polar = 0.9;
    const azimute = 0.42;
    const pos = new THREE.Vector3(alvo.x + raio * Math.sin(polar) * Math.sin(azimute), raio * Math.cos(polar), alvo.z + raio * Math.sin(polar) * Math.cos(azimute));
    this.moverCamera(pos, alvo, animar);
  }

  private moverCamera(pos: THREE.Vector3, alvo: THREE.Vector3, animar: boolean) {
    if (!animar || this.o.reduzirMovimento || !this.controls) {
      this.camera.position.copy(pos);
      this.camera.lookAt(alvo);
      if (this.controls) {
        this.controls.target.copy(alvo);
        this.controls.update();
      }
      this.sujo = true;
      return;
    }
    this.tween = { de: [this.camera.position.clone(), this.controls.target.clone()], para: [pos, alvo], inicio: performance.now(), duracao: 700 };
  }

  private laco = () => {
    this.raf = requestAnimationFrame(this.laco);
    if (!this.visivel || document.hidden) return;
    const agora = performance.now();
    if (this.tween) {
      const t = Math.min(1, (agora - this.tween.inicio) / this.tween.duracao);
      const k = ease(t);
      this.camera.position.lerpVectors(this.tween.de[0], this.tween.para[0], k);
      this.controls.target.lerpVectors(this.tween.de[1], this.tween.para[1], k);
      if (t >= 1) this.tween = null;
      this.sujo = true;
    }
    const mudouControle = this.controls.update();
    if (mudouControle) this.sujo = true;
    if (this.camadas.fluxo && this.fluxo && !this.o.reduzirMovimento && agora - this.ultimoFluxo > 33) {
      this.fluxo.atualizar((agora - this.inicioFluxo) / 1000);
      this.ultimoFluxo = agora;
      this.sujo = true;
    }
    if (!this.sujo) return;
    this.sujo = false;
    this.atualizarLod();
    this.ceu?.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    this.projetarMarcadores();
    this.o.eventos.aoMoverCamera?.(this.pegadaCamera());
    this.medirDesempenho(agora);
  };

  private medirDesempenho(agora: number) {
    const dt = agora - this.ultimoFrame;
    this.ultimoFrame = agora;
    if (this.o.qualidade !== "alta" || this.avisouDesempenho || dt > 500) return;
    this.amostrasFrame.push(dt);
    if (this.amostrasFrame.length > 90) this.amostrasFrame.shift();
    if (this.amostrasFrame.length === 90) {
      const media = this.amostrasFrame.reduce((a, b) => a + b, 0) / 90;
      if (media > 48) {
        this.avisouDesempenho = true;
        this.o.eventos.aoDesempenhoBaixo();
      }
    }
  }

  private distancia() {
    return this.camera.position.distanceTo(this.controls.target);
  }

  private atualizarLod() {
    const d = this.distancia();
    const nivel = d > 900 ? "longe" : d > 260 ? "medio" : "perto";
    if (this.o.overlay.dataset.zoom !== nivel) this.o.overlay.dataset.zoom = nivel;
    const visivel = this.camadas.percurso && d > 220;
    for (const obj of this.lodLonge) obj.visible = visivel;
  }

  private projetarMarcadores() {
    const { overlay } = this.o;
    const w = overlay.clientWidth;
    const h = overlay.clientHeight;
    const v = new THREE.Vector3();
    const visiveis: Array<{ el: HTMLElement; x: number; y: number; prioridade: number }> = [];
    overlay.querySelectorAll<HTMLElement>("[data-ponto-id]").forEach((el) => {
      const ponto = this.pontoPorId.get(el.dataset.pontoId ?? "");
      if (!ponto) return;
      v.set(ponto.posicao[0], ponto.alturaMarcador, ponto.posicao[1]).project(this.camera);
      const fora = v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1;
      el.style.visibility = fora ? "hidden" : "visible";
      if (fora) return;
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      visiveis.push({ el, x, y, prioridade: Number(el.dataset.prioridade ?? 0) - v.z * 0.01 });
    });
    // Rótulos não se sobrepõem: ficam os mais importantes (selecionado, em foco, principais, mais próximos).
    visiveis.sort((a, b) => b.prioridade - a.prioridade);
    const ocupados: Array<[number, number, number, number]> = [];
    for (const { el, x, y } of visiveis) {
      const rotulo = el.querySelector<HTMLElement>("[data-rotulo]");
      const lw = rotulo?.offsetWidth ?? 0;
      if (!rotulo || lw === 0) {
        delete el.dataset.oculto;
        continue;
      }
      const lh = rotulo.offsetHeight;
      const r: [number, number, number, number] = [x - lw / 2 - 3, y - lh - 16, x + lw / 2 + 3, y - 12];
      if (ocupados.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) el.dataset.oculto = "1";
      else {
        delete el.dataset.oculto;
        ocupados.push(r);
      }
    }
  }

  private aoMudarCamera = () => {
    const t = this.controls.target;
    const l = this.limites;
    const antes = t.clone();
    t.x = THREE.MathUtils.clamp(t.x, l.minX, l.maxX);
    t.z = THREE.MathUtils.clamp(t.z, l.minZ - 200, l.maxZ + 100);
    t.y = 0;
    if (!antes.equals(t)) this.camera.position.add(new THREE.Vector3().subVectors(t, antes));
    this.sujo = true;
  };

  private coordenadas(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  }

  private pick(e: PointerEvent): string | null {
    this.raycaster.setFromCamera(this.coordenadas(e), this.camera);
    const visiveis = this.hits.filter((h) => {
      const alvo = this.alvoPorHit.get(h);
      return alvo ? this.camadas[alvo.camada] : false;
    });
    const [hit] = this.raycaster.intersectObjects(visiveis, false);
    return (hit?.object.userData.pontoId as string | undefined) ?? null;
  }

  private aoMoverPonteiro = (e: PointerEvent) => {
    if (e.pointerType === "touch" || this.ponteiro.baixo) return;
    const id = this.pick(e);
    if (id !== this.hoverId) this.definirHover(id);
  };

  private aoApertar = (e: PointerEvent) => {
    this.ponteiro.baixo = { x: e.clientX, y: e.clientY };
  };

  private aoSoltar = (e: PointerEvent) => {
    const baixo = this.ponteiro.baixo;
    this.ponteiro.baixo = null;
    if (!baixo || Math.hypot(e.clientX - baixo.x, e.clientY - baixo.y) > 6) return;
    this.o.eventos.aoSelecionar(this.pick(e));
  };

  private aoSairPonteiro = () => this.definirHover(null);

  private aoMudarVisibilidade = () => {
    this.sujo = true;
  };

  private aoPerderContexto = (e: Event) => {
    e.preventDefault();
    this.o.eventos.aoErro("O navegador interrompeu o 3D (contexto WebGL perdido).");
  };

  /* ------------------------------------------------------------------ */
  /* API usada pela interface                                             */
  /* ------------------------------------------------------------------ */

  definirHover(id: string | null) {
    this.hoverId = id;
    this.renderer.domElement.style.cursor = id ? "pointer" : "";
    if (this.realce) this.contorno(this.realce.hover, id && id !== this.selecaoId ? id : null);
    this.o.eventos.aoPassar(id);
    this.sujo = true;
  }

  definirSelecao(id: string | null) {
    this.selecaoId = id;
    if (this.realce) {
      this.contorno(this.realce.selecao, id);
      this.contorno(this.realce.hover, this.hoverId && this.hoverId !== id ? this.hoverId : null);
    }
    this.sujo = true;
  }

  /**
   * Modo conferência: estruturas fora de `ids` ficam num material cinza esmaecido; `null` restaura.
   * O material original fica guardado na própria malha.
   */
  definirRealce(ids: Set<string> | null) {
    const esmaecido = this.materiais.solido(0xc3bcbc, { rugosidade: 1 });
    for (const alvo of this.alvos) {
      const apagar = ids !== null && !ids.has(alvo.id);
      alvo.grupo.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.semRealce) return;
        if (apagar) {
          if (!mesh.userData.materialOriginal) mesh.userData.materialOriginal = mesh.material;
          mesh.material = esmaecido;
        } else if (mesh.userData.materialOriginal) {
          mesh.material = mesh.userData.materialOriginal as THREE.Material;
          delete mesh.userData.materialOriginal;
        }
      });
    }
    this.sujo = true;
  }

  focar(id: string) {
    const alvo = this.alvos.find((a) => a.id === id);
    if (!alvo) return;
    const centro = alvo.caixa.getCenter(new THREE.Vector3());
    centro.y = 0;
    const tamanho = alvo.caixa.getSize(new THREE.Vector3());
    const dist = THREE.MathUtils.clamp(Math.max(tamanho.x, tamanho.z) * 3.2, 70, 320);
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).setY(0);
    if (dir.lengthSq() < 1) dir.set(0.4, 0, 1);
    dir.normalize();
    const polar = 0.95;
    const pos = centro.clone().addScaledVector(dir, dist * Math.sin(polar)).setY(dist * Math.cos(polar));
    this.moverCamera(pos, centro, true);
  }

  aproximar(fator: number) {
    const alvo = this.controls.target.clone();
    const offset = new THREE.Vector3().subVectors(this.camera.position, alvo);
    const d = THREE.MathUtils.clamp(offset.length() * fator, this.controls.minDistance, this.controls.maxDistance);
    this.moverCamera(alvo.clone().add(offset.setLength(d)), alvo, true);
  }

  resetar() {
    this.posicionarInicial(true);
  }

  vista(v: Vista) {
    const alvo = this.controls.target.clone();
    const d = this.distancia();
    const azimute = Math.atan2(this.camera.position.x - alvo.x, this.camera.position.z - alvo.z);
    const polar = v === "superior" ? 0.02 : 0.9;
    this.moverCamera(new THREE.Vector3(alvo.x + d * Math.sin(polar) * Math.sin(azimute), d * Math.cos(polar), alvo.z + d * Math.sin(polar) * Math.cos(azimute)), alvo, true);
  }

  /** Norte para cima: câmera ao sul do alvo. */
  orientarNorte() {
    const alvo = this.controls.target.clone();
    const offset = new THREE.Vector3().subVectors(this.camera.position, alvo);
    const polar = Math.acos(THREE.MathUtils.clamp(offset.y / offset.length(), -1, 1));
    const d = offset.length();
    this.moverCamera(new THREE.Vector3(alvo.x, d * Math.cos(polar), alvo.z + d * Math.sin(polar)), alvo, true);
  }

  definirCamadas(c: Record<Camada, boolean>) {
    this.camadas = { ...c };
    this.aplicarCamadas();
  }

  private aplicarCamadas() {
    for (const [camada, objs] of this.objetosCamada) for (const o of objs) o.visible = this.camadas[camada];
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
    if (this.realce) {
      this.contorno(this.realce.selecao, this.selecaoId);
      this.contorno(this.realce.hover, null);
    }
    this.sujo = true;
  }

  redimensionar() {
    const { container } = this.o;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const mat of [this.trilho, this.realce?.matHover, this.realce?.matSel]) mat?.resolution.set(w, h);
    this.sujo = true;
  }

  /** Cantos da vista projetados no chão (para o minimapa). Acima do horizonte, projeta ao longe. */
  pegadaCamera(): Array<[number, number]> {
    const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ray = new THREE.Raycaster();
    const ponto = new THREE.Vector3();
    return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([x, y]) => {
      ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
      const hit = ray.ray.intersectPlane(plano, ponto);
      if (hit && hit.distanceTo(this.camera.position) < 3500) return [hit.x, hit.z] as [number, number];
      const longe = ray.ray.direction.clone().setY(0).normalize().multiplyScalar(2500).add(this.camera.position);
      return [longe.x, longe.z] as [number, number];
    });
  }

  /** Centraliza a câmera num ponto do chão mantendo distância e ângulo (clique no minimapa). */
  irPara(x: number, z: number) {
    const alvo = new THREE.Vector3(x, 0, z);
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    this.moverCamera(alvo.clone().add(offset), alvo, true);
  }

  /** Desloca a câmera para frente/lado relativo ao que se vê (setas do teclado). */
  mover(frente: number, lado: number) {
    const passo = this.distancia() * 0.14;
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).setY(0).normalize();
    const direita = new THREE.Vector3(-dir.z, 0, dir.x);
    const delta = dir.multiplyScalar(frente * passo).add(direita.multiplyScalar(lado * passo));
    this.moverCamera(this.camera.position.clone().add(delta), this.controls.target.clone().add(delta), true);
  }

  /** Diagnóstico: chamadas de desenho e triângulos do último quadro. */
  estatisticas() {
    const i = this.renderer.info;
    return { chamadas: i.render.calls, triangulos: i.render.triangles, geometrias: i.memory.geometries, texturas: i.memory.textures };
  }

  /** Força um quadro (por exemplo, quando marcadores HTML entram ou saem). */
  invalidar() {
    this.sujo = true;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.observador?.disconnect();
    this.resize?.disconnect();
    document.removeEventListener("visibilitychange", this.aoMudarVisibilidade);
    if (this.controls) {
      this.controls.removeEventListener("change", this.aoMudarCamera);
      this.controls.dispose();
    }
    if (this.renderer) {
      const el = this.renderer.domElement;
      el.removeEventListener("pointermove", this.aoMoverPonteiro);
      el.removeEventListener("pointerdown", this.aoApertar);
      el.removeEventListener("pointerup", this.aoSoltar);
      el.removeEventListener("pointerleave", this.aoSairPonteiro);
      el.removeEventListener("webglcontextlost", this.aoPerderContexto);
    }
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.trilho?.dispose();
    this.realce?.matHover.dispose();
    this.realce?.matSel.dispose();
    this.materiais.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }
}

/** Detecção prévia: evita montar a cena quando o WebGL não existe. */
export function suportaWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Qualidade inicial pela capacidade do aparelho; o usuário pode trocar. */
export function qualidadeSugerida(): Qualidade {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const pouca = (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
  const toque = window.matchMedia("(pointer: coarse)").matches;
  return pouca || toque ? "leve" : "alta";
}
