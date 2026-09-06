import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("controles Proton", () => {
  it("explica quando a rota otimizada passa a valer", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    const button = html.match(/<button[^>]*id="protonOptimizeBtn"[^>]*>/)?.[0] ?? "";
    expect(button).toContain("fecha o Discord, troca a rota e só reabre quando a saída nova estiver comprovada");
    expect(button).toContain("aria-label=");
  });

  it("nao chama a rota de conectada antes de o bypass estar ativo", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/main.ts"), "utf8");
    const fnStart = source.indexOf("async function optimizeProtonRoute");
    const fnBody = source.slice(fnStart, fnStart + 2800);
    expect(fnBody).toContain("const rotaEmUso = currentState === 'ACTIVE';");
    expect(fnBody).toContain("Rota ${res.server} escolhida");
    expect(fnBody).toContain("rotaEmUso");
    expect(fnBody).toContain("Rota ${res.server} no ar");
    expect(fnBody).toContain("saia e entre de novo");
  });

  it("automatiza o CAPTCHA sem pedir token manual", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    expect(html).not.toContain('id="protonCaptchaPanel"');
    expect(html).not.toContain('id="protonCaptchaOpenBtn"');
    expect(html).not.toContain('id="protonCaptchaToken"');
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/main.ts"), "utf8");
    expect(source).toContain("onProtonCaptchaStatus");
    expect(source).not.toContain("humanVerificationToken: hvToken");
    expect(source).toContain("CAPTCHA_INVALID");
  });

  it("explica que a troca ativa fecha e reabre o Discord somente apos a prova", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toContain("fecha o Discord, troca a rota e só reabre quando a saída nova estiver comprovada");
  });

  it("distingue a prova funcional da telemetria auxiliar", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/main.ts"), "utf8");
    expect(source).toContain("res.readiness?.verified === false");
    expect(source).toContain("Não deu pra confirmar o detalhe extra da conexão, mas a rota já vale.");
  });

  it("oferece manter conectado para lembrar o login Proton", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toContain('id="protonStayLoggedIn"');
    expect(html).toContain("Manter conectado");
    const ui = fs.readFileSync(path.resolve(process.cwd(), "src/main.ts"), "utf8");
    expect(ui).toContain("stayLoggedIn: protonStayLoggedIn.checked");
    const main = fs.readFileSync(path.resolve(process.cwd(), "electron/main.ts"), "utf8");
    expect(main).toContain("proton.protonSettingsPatch");
    expect(main).toContain("reusando certificado WireGuard existente");
    expect(main).toContain("hasReusableProtonConfig");
  });

  it("avisa que .conf dedicado ajuda em upload e deixa copiar diagnostico", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toContain("Se o envio de foto no chat travar");
    expect(html).toContain('id="bugCopyDiag"');
    expect(html).not.toContain("github.com/bezumiya/GoLiveBypass");
    expect(html).toContain('settings-section--behavior" hidden');
  });
});
