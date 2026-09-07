import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { ensureWindowsAdmin, isWindowsElevated } from "../electron/elevate";

describe("elevacao do GoLiveBypass.exe", () => {
  it("pede administrador no manifesto do exe", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    expect(pkg.build.win.requestedExecutionLevel).toBe("requireAdministrator");
    // O instalador NSIS (perMachine) pede admin; o exe em C:\GoLiveBypass herda o manifesto.
    expect(pkg.build.win.target).toBe("nsis");
    expect(pkg.build.nsis.perMachine).toBe(true);
    // FileDescription/comentario do atalho NSIS vem de package.json description;
    // a frase longa virava o nome na barra de tarefas do Windows.
    expect(pkg.description).toBe("GoLiveBypass");
  });

  it("relanca com UAC visivel antes do lock de instancia unica", () => {
    const elevate = fs.readFileSync(path.resolve(process.cwd(), "electron/elevate.ts"), "utf8");
    const spawn = elevate.slice(elevate.indexOf("const launched = spawnSync"));
    expect(spawn).toContain("windowsHide: false");
    expect(spawn).toContain("-Verb RunAs");
    expect(spawn).not.toContain("WindowStyle Hidden");

    const main = fs.readFileSync(path.resolve(process.cwd(), "electron/main.ts"), "utf8");
    const elevateAt = main.indexOf("ensureWindowsAdmin()");
    const lockAt = main.indexOf("requestSingleInstanceLock()");
    expect(elevateAt).toBeGreaterThan(0);
    expect(lockAt).toBeGreaterThan(elevateAt);
    expect(main).toContain('windowsElevation === "ok" && app.requestSingleInstanceLock()');
  });

  it("fora do Windows a elevacao e no-op", () => {
    if (process.platform === "win32") {
      expect(typeof isWindowsElevated()).toBe("boolean");
      return;
    }
    expect(isWindowsElevated()).toBe(true);
    expect(ensureWindowsAdmin()).toBe("ok");
  });
});
