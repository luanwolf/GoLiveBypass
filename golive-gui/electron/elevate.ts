/**
 * O WireSock, o serviço e os prompts de instalação no Windows exigem admin.
 * requestedExecutionLevel no exe instalado cobre C:\GoLiveBypass\GoLiveBypass.exe.
 * Este helper cobre o caso asInvoker (dev, exe velho) relancando com RunAs.
 *
 * O prompt UAC nao pode nascer de um processo hidden: o Windows recusa ou
 * engole o dialogo, o app sai e parece que "nao abriu".
 */
import { execFileSync, spawnSync } from "child_process";

export function isWindowsElevated(): boolean {
  if (process.platform !== "win32") return true;
  try {
    execFileSync("net", ["session"], { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function elevationTarget(): { exe: string; args: string[] } {
  const args = process.argv.slice(process.defaultApp ? 2 : 1);
  return { exe: process.execPath, args };
}

export type ElevationResult = "ok" | "relaunched" | "denied";

/** ponytail: net session é o probe de admin do Windows; teto = falso negativo se net.exe sumir. */
export function ensureWindowsAdmin(): ElevationResult {
  if (process.platform !== "win32") return "ok";
  if (isWindowsElevated()) return "ok";
  const { exe, args } = elevationTarget();
  const argList = args.length ? ` -ArgumentList @(${args.map(psQuote).join(",")})` : "";
  // windowsHide:false: o UAC e um desktop seguro; esconder o host faz o Windows
  // negar o verbo runas sem mostrar o dialogo.
  const launched = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-STA", "-Command", `Start-Process -LiteralPath ${psQuote(exe)} -Verb RunAs${argList}`],
    { windowsHide: false, encoding: "utf8", timeout: 180_000 },
  );
  return launched.status === 0 ? "relaunched" : "denied";
}
