// Substituicao do exe portable no Windows (target "portable" do electron-builder) e o
// relanço desacoplado depois da troca. Mora num modulo proprio, sem import do Electron,
// para o vitest exercitar a logica real de troca de arquivo (issue #135).
//
// O stub portable (o .exe que a pessoa clica) costuma estar EBUSY: o SFX, o Defender
// ou a pasta dist-app seguram o arquivo. Renomear o exe em uso falhava e o update
// morria depois do clique. A troca nova GRAVA um exe irmao (GoLiveBypass-X.Y.Z.exe)
// e o helper espera o PID velho morrer antes de abrir o novo — o .old do SFX nao e
// a imagem em execucao (que mora em %TEMP%), entao apagar .old nao serve de sonda.

import { spawn } from "child_process";
import { existsSync, rmSync, renameSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

export const OLD_SUFFIX = ".old";

export function stagedPortablePath(currentExe: string, version: string): string {
  const dest = join(dirname(currentExe), `GoLiveBypass-${version}.exe`);
  if (dest.toLowerCase() === currentExe.toLowerCase()) return `${currentExe}.new`;
  return dest;
}

// Uma unica tentativa; joga o erro se falhou (o chamador decide a retentativa).
export function attemptReplace(target: string, downloaded: string): void {
  const antigo = target + OLD_SUFFIX;
  if (existsSync(antigo)) {
    // Sobra de um update anterior que o boot nao limpou; sem isto o rename abaixo
    // falharia com destino existente.
    rmSync(antigo, { force: true });
  }
  renameSync(target, antigo);
  try {
    renameSync(downloaded, target);
  } catch (error) {
    // Rollback: sem ele o atalho do usuario apontaria para arquivo que nao existe.
    // (O app segue rodando — rename nao afeta a imagem em memoria.)
    try {
      renameSync(antigo, target);
    } catch {
      // Raro (antivirus segurando os dois); o proximo update limpa o ".old" antes.
    }
    throw error;
  }
}

// Boot do app atualizado: o ".old" de ontem nao roda mais, entao agora da para apagar.
export function cleanupOldExe(target: string): void {
  try {
    rmSync(target + OLD_SUFFIX, { force: true });
  } catch {
    // Antivirus pode segurar o arquivo por um tempo; tenta de novo no proximo boot.
  }
}

// ------------------------------------------------------------------ relanço externo (Windows)

// O .bat e disparado por um helper externo para reabrir o app depois que o processo
// velho morrer. O CONTEUDO do arquivo e 100% ASCII e os caminhos chegam como %1..%4:
// o cmd le o .bat no codepage OEM, entao path embutido no conteudo (username "Joao",
// pasta "Configuracoes") embaralharia na leitura — como argumento, porem, o caminho
// viaja em Unicode pelo CreateProcessW e sobrevive intacto.
//
// A sonda e o PID do Electron velho (%~4). O stub portable nao e a imagem em
// execucao (que o SFX extrai em %TEMP%), entao apagar o .old liberava na hora e o
// helper abria a copia nova ainda com o lock de instancia unica — fecha e nao reabre.
export function buildWindowsUpdateScript(): string {
  return [
    "@echo off",
    `set "TRIES=90"`,
    "",
    ":loop",
    `tasklist /FI "PID eq %~4" | find "%~4" >NUL`,
    "if errorlevel 1 goto launch",
    `set /a TRIES-=1`,
    `if %TRIES% leq 0 goto launch`,
    `ping 127.0.0.1 -n 2 >NUL`,
    "goto loop",
    "",
    ":launch",
    `start "" "%~1"`,
    `if not "%~3"=="" if exist "%~3" del "%~3" >NUL 2>&1`,
    `del "%~f0" >NUL 2>&1`,
    "",
  ].join("\r\n");
}

export function buildWindowsUpdateLauncher(
  batPath: string,
  exePath: string,
  oldPath: string,
  vbsPath: string,
  pid: number,
): string {
  const quoted = (p: string) => `Chr(34) & "${p}" & Chr(34)`;
  const command = [quoted(batPath), quoted(exePath), quoted(oldPath), quoted(vbsPath), quoted(String(pid))].join(
    ' & " " & ',
  );
  const body = [
    'Set WshShell = CreateObject("WScript.Shell")',
    `WshShell.Run ${command}, 0, False`,
    "",
  ].join("\r\n");
  return "\uFEFF" + body;
}

export function spawnWindowsUpdateHelper(exePath: string, oldPath: string, pid: number): boolean {
  try {
    const timestamp = Date.now();
    const batPath = join(tmpdir(), `GoLiveBypass-update-${timestamp}.bat`);
    const vbsPath = join(tmpdir(), `GoLiveBypass-update-${timestamp}.vbs`);
    writeFileSync(batPath, buildWindowsUpdateScript(), "utf8");
    writeFileSync(vbsPath, buildWindowsUpdateLauncher(batPath, exePath, oldPath, vbsPath, pid), "utf16le");
    spawn("wscript.exe", ["//b", "//nologo", vbsPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    })
      .on("error", (error) => console.error("[updater] helper de relanco falhou:", error))
      .unref();
    return true;
  } catch (error) {
    console.error("[updater] erro ao agendar o relanco do Windows:", error);
    return false;
  }
}
