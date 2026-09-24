import { describe, expect, it } from "vitest";
import { assinarTokenPortal, perfilDoPortal, verificarTokenPortal } from "./portal";

const SEGREDO = "segredo-do-portal-com-mais-de-32-caracteres";
const agora = 1_800_000_000;
const base = { iss: "norte-portal", aud: "planejamento", app: "planejamento", sub: "ana@nortemkt.com", email: "ana@nortemkt.com", name: "Ana Souza", role: "Logística", level: 2, jti: "jti-1", iat: agora, exp: agora + 120 };

describe("verificarTokenPortal", () => {
  it("aceita o token do hub e traduz o papel para o perfil daqui", () => {
    const r = verificarTokenPortal(assinarTokenPortal(base, SEGREDO), SEGREDO, agora);
    expect(r).toEqual({ ok: true, token: { email: "ana@nortemkt.com", nome: "Ana Souza", perfil: "LOGISTICA", jti: "jti-1", exp: agora + 120 } });
  });

  it("recusa assinatura errada, outro emissor, token vencido e token de outro app", () => {
    expect(verificarTokenPortal(assinarTokenPortal(base, "outro-segredo-tambem-com-32-caracteres!"), SEGREDO, agora)).toEqual({ ok: false, motivo: "assinatura" });
    expect(verificarTokenPortal(assinarTokenPortal({ ...base, iss: "alguem" }, SEGREDO), SEGREDO, agora)).toEqual({ ok: false, motivo: "emissor" });
    expect(verificarTokenPortal(assinarTokenPortal(base, SEGREDO), SEGREDO, agora + 120 + 31)).toEqual({ ok: false, motivo: "expirado" });
    // 30 s de tolerância de relógio.
    expect(verificarTokenPortal(assinarTokenPortal(base, SEGREDO), SEGREDO, agora + 120 + 20).ok).toBe(true);
    expect(verificarTokenPortal(assinarTokenPortal({ ...base, aud: "checklist", app: "checklist" }, SEGREDO), SEGREDO, agora)).toEqual({ ok: false, motivo: "app" });
  });

  it("recusa 'none', token sem jti e sem e-mail", () => {
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    expect(verificarTokenPortal(`${enc({ alg: "none" })}.${enc(base)}.x`, SEGREDO, agora)).toEqual({ ok: false, motivo: "algoritmo" });
    expect(verificarTokenPortal(assinarTokenPortal({ ...base, jti: undefined }, SEGREDO), SEGREDO, agora)).toEqual({ ok: false, motivo: "formato" });
    expect(verificarTokenPortal(assinarTokenPortal({ ...base, email: "sem-arroba", sub: "x" }, SEGREDO), SEGREDO, agora)).toEqual({ ok: false, motivo: "email" });
    expect(verificarTokenPortal("lixo", SEGREDO, agora)).toEqual({ ok: false, motivo: "formato" });
  });

  it("papéis do portal (com ou sem acento) viram perfis; desconhecido vira null", () => {
    expect(perfilDoPortal("Administrador")).toBe("ADMIN");
    expect(perfilDoPortal("Gestão")).toBe("GESTAO");
    expect(perfilDoPortal("gestao")).toBe("GESTAO");
    expect(perfilDoPortal("Logística")).toBe("LOGISTICA");
    expect(perfilDoPortal("Cenografia")).toBe("CENOGRAFIA");
    expect(perfilDoPortal("Requisitante")).toBe("REQUISITANTE");
    expect(perfilDoPortal("Retaguarda")).toBeNull();
    expect(perfilDoPortal(undefined)).toBeNull();
  });
});
