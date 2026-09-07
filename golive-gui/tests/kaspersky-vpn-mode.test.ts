import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("modo Kaspersky", () => {
  it("tem aba e painel na GUI", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toContain('id="tabKaspersky"');
    expect(html).toContain('id="panelKaspersky"');
    expect(html).toContain('id="kasperskyDropZone"');
    expect(html).toContain('id="kasperskyImportBtn"');
    expect(html).toContain('id="kasperskyTestBtn"');
    expect(html).toContain("Rota predefinida");
    expect(html).toContain("A definição do servidor para conexão da rota é de responsabilidade do usuário");
    expect(html).toContain("my.kaspersky.com");
    expect(html).toContain("support.kaspersky.com/my-kaspersky/227551");
    expect(html).toContain("proton-hint--italic");
    expect(html).toContain("Importe o arquivo abaixo e ligue o bypass.");
    expect(html).toContain('class="bypass-disclaimer"');
    const protonTab = html.indexOf('id="tabProton"');
    const kasperskyTab = html.indexOf('id="tabKaspersky"');
    const customTab = html.indexOf('id="tabCustom"');
    expect(protonTab).toBeGreaterThan(-1);
    expect(protonTab).toBeLessThan(kasperskyTab);
    expect(kasperskyTab).toBeLessThan(customTab);
    expect(html).toContain("<span>Proton</span>");
    expect(html).not.toContain("Proton (automát.)");
    expect(html).toContain('src="./assets/kaspersky-favicon.png"');
    expect(fs.existsSync(path.resolve(process.cwd(), "assets/kaspersky-favicon.png"))).toBe(true);
    expect(html).toContain('class="vpn-brand-icon"');
    const main = fs.readFileSync(path.resolve(process.cwd(), "electron/main.ts"), "utf8");
    expect(main).toMatch(/MAIN_WINDOW_WIDTH = 1020/);
  });

  it("reusa o .conf importado e não dispara Proton", () => {
    const ui = fs.readFileSync(path.resolve(process.cwd(), "src/main.ts"), "utf8");
    expect(ui).toContain("switchVpnMode('kaspersky')");
    expect(ui).toContain("Selecione qual provedor você prefere utilizar para fazer a rota no Discord");
    expect(ui).not.toContain("Discord no ponto. Pode ligar.");
    expect(ui).toContain("Importa o .conf da Kaspersky");
    const proton = fs.readFileSync(path.resolve(process.cwd(), "electron/proton.ts"), "utf8");
    expect(proton).toContain("'kaspersky'");
    expect(proton).toContain("mode === 'kaspersky'");
    const main = fs.readFileSync(path.resolve(process.cwd(), "electron/main.ts"), "utf8");
    expect(main).toContain("proton.sanitizeVpnMode");
    expect(main).toContain('if (vpnMode === "proton")');
    expect(main).toContain("importe um .conf da Kaspersky");
  });
});
