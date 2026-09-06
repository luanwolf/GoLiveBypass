import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("modo Kaspersky", () => {
  it("tem aba e painel na GUI", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toContain('id="tabKaspersky"');
    expect(html).toContain('id="panelKaspersky"');
    expect(html).toContain('id="kasperskyImportBtn"');
    expect(html).toContain("Kaspersky só no Discord");
    expect(html).toContain("my.kaspersky.com");
    expect(html).toContain("support.kaspersky.com/my-kaspersky/227551");
    expect(html).toContain("Dois túneis ao mesmo tempo brigam");
    const protonTab = html.indexOf('id="tabProton"');
    const kasperskyTab = html.indexOf('id="tabKaspersky"');
    const customTab = html.indexOf('id="tabCustom"');
    expect(protonTab).toBeGreaterThan(-1);
    expect(protonTab).toBeLessThan(kasperskyTab);
    expect(kasperskyTab).toBeLessThan(customTab);
    expect(html).toContain('class="vpn-brand-icon"');
    const main = fs.readFileSync(path.resolve(process.cwd(), "electron/main.ts"), "utf8");
    expect(main).toMatch(/MAIN_WINDOW_WIDTH = 1020/);
  });

  it("reusa o .conf importado e não dispara Proton", () => {
    const ui = fs.readFileSync(path.resolve(process.cwd(), "src/main.ts"), "utf8");
    expect(ui).toContain("switchVpnMode('kaspersky')");
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
