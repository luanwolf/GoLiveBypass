import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  attemptReplace,
  buildWindowsUpdateLauncher,
  buildWindowsUpdateScript,
  cleanupOldExe,
  OLD_SUFFIX,
  stagedPortablePath,
} from "../electron/updater-replace";

// O cenario do Windows (exe em uso nao apaga, mas renomeia) nao existe no Linux —
// aqui o que se testa e a coreografia: rename-aside, troca, rollback e limpeza.
// Os builders do helper (.bat/.vbs) sao testados como conteudo: disparar o helper
// de verdade (spawnWindowsUpdateHelper) exigiria wscript/cmd e sujaria o %TEMP%
// real da maquina, entao ele nao roda em teste.
describe("updater-replace", () => {
  let dir: string;
  let target: string;
  let downloaded: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "golive-replace-test-"));
    target = path.join(dir, "GoLiveBypass-1.1.11.exe");
    downloaded = path.join(dir, "GoLiveBypass-1.1.12.exe");
    fs.writeFileSync(target, "exe em uso");
    fs.writeFileSync(downloaded, "exe novo");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("troca o exe no lugar e deixa a versao antiga como .old", () => {
    attemptReplace(target, downloaded);
    expect(fs.readFileSync(target, "utf8")).toBe("exe novo");
    expect(fs.readFileSync(target + OLD_SUFFIX, "utf8")).toBe("exe em uso");
    expect(fs.existsSync(downloaded)).toBe(false);
  });

  it("limpa sobra .old de um update anterior antes de trocar", () => {
    fs.writeFileSync(target + OLD_SUFFIX, "exe velho de ontem");
    attemptReplace(target, downloaded);
    expect(fs.readFileSync(target, "utf8")).toBe("exe novo");
    // O ".old" de agora e o exe que estava em uso; o de ontem foi embora.
    expect(fs.readFileSync(target + OLD_SUFFIX, "utf8")).toBe("exe em uso");
  });

  it("faz rollback quando o exe novo nao entra no lugar", () => {
    fs.rmSync(downloaded); // origem da troca some: o rename-in tem que falhar
    expect(() => attemptReplace(target, downloaded)).toThrow();
    expect(fs.readFileSync(target, "utf8")).toBe("exe em uso");
    expect(fs.existsSync(target + OLD_SUFFIX)).toBe(false);
  });

  it("cleanupOldExe apaga a sobra quando o exe velho ja nao roda", () => {
    fs.writeFileSync(target + OLD_SUFFIX, "sobra");
    cleanupOldExe(target);
    expect(fs.existsSync(target + OLD_SUFFIX)).toBe(false);
  });

  it("cleanupOldExe nao falha quando nao ha sobra", () => {
    expect(() => cleanupOldExe(target)).not.toThrow();
  });

  it("bat do helper e ASCII puro com caminhos como argumentos (imune ao codepage OEM)", () => {
    const script = buildWindowsUpdateScript();
    expect(script).toMatch(/^[\x20-\x7E\r\n]+$/);
    expect(script).toContain('start "" "%~1"');
    expect(script).toContain('PID eq %~4');
    expect(script).toContain('del "%~3" >NUL 2>&1');
    expect(script).toContain('del "%~f0"');
    expect(script).not.toMatch(/(^|[^\r])\n/);
    expect(script.split("\r\n").length).toBeGreaterThan(10);
    expect(script).toContain("goto launch");
  });

  it("vbs do helper comeca com BOM UTF-16LE e cita os quatro caminhos mais o pid", () => {
    const bat = "C:\\Users\\João\\AppData\\Local\\Temp\\g-1.bat";
    const exe = "C:\\Users\\João\\Desktop\\GoLiveBypass-1.1.12.exe";
    const vbs = "C:\\Users\\João\\AppData\\Local\\Temp\\g-1.vbs";
    const launcher = buildWindowsUpdateLauncher(bat, exe, exe + OLD_SUFFIX, vbs, 4321);
    expect(launcher.charCodeAt(0)).toBe(0xfeff);
    expect(launcher).toContain(bat);
    expect(launcher).toContain(exe);
    expect(launcher).toContain(vbs);
    expect(launcher).toContain(`Chr(34) & "${exe}" & Chr(34)`);
    expect(launcher).toContain(`Chr(34) & "4321" & Chr(34)`);
    expect(launcher).toContain(", 0, False");
  });

  it("grava o exe novo ao lado, sem sobrescrever o que esta rodando", () => {
    const current = path.join("D:", "apps", "GoLiveBypass-2.1.5.exe");
    expect(stagedPortablePath(current, "2.1.7")).toBe(path.join("D:", "apps", "GoLiveBypass-2.1.7.exe"));
    const same = path.join("D:", "apps", "GoLiveBypass-2.1.7.exe");
    expect(stagedPortablePath(same, "2.1.7")).toBe(`${same}.new`);
  });
});
