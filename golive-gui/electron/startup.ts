/**
 * Autostart multiplataforma.
 *
 * O Electron prove app.setLoginItemSettings() (e o getLoginItemSettings()), mas
 * em build portable do Windows ele NAO funciona: o metodo delega ao instalador
 * Squirrel/MSI para criar a entrada de Run, e o portable nao tem instalador. O
 * usuario clica "Iniciar com Windows", o app chama setLoginItemSettings({...}),
 * o metodo retorna sucesso -- e nada acontece. O checkbox no renderer continua
 * desmarcado na proxima abertura porque o getLoginItemSettings tambem le do
 * instalador (que nao escreveu nada), e nao tem como a interface saber que a
 * chamada "funcionou" sem efeito.
 *
 * Workaround: no Windows o exe pede administrador, e HKCU\\...\\Run nao inicia
 * programas que exigem UAC. A tarefa ONLOGON /RL HIGHEST sobe elevado sem
 * prompt extra. A entrada antiga de Run e apagada na migracao.
 *
 * No macOS, o setLoginItemSettings funciona (foi reescrito no Electron 22+
 * para portable, e o app oficial e dmg/zip com category). Mantemos o caminho
 * antigo. No Linux, o caminho do .desktop em ~/.config/autostart continua.
 */
import { app } from "electron";
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";

const IS_WINDOWS = process.platform === "win32";
const IS_LINUX = process.platform === "linux";
const IS_MAC = process.platform === "darwin";

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const ENTRY_NAME = "GoLiveBypass";
const TASK_NAME = "GoLiveBypass";

export interface StartupResult {
  success: boolean;
  error?: string;
}

/**
 * Retorna o caminho do executavel que deve ser usado para iniciar o app no boot.
 *
 * No Linux, quando o app esta rodando de dentro de um AppImage, o `process.execPath`
 * e o caminho dentro do mountpoint FUSE temporario (`/tmp/.mount_GoLiveXXX/golive-gui`),
 * que NAO persiste entre sessoes -- o mountpoint e desmontado junto com o AppImage.
 * A variavel de ambiente `APPIMAGE` (definida pelo runtime do AppImage) guarda o
 * caminho real do .AppImage no disco, e e isso que o .desktop precisa usar.
 *
 * No Windows o portable NAO usa o process.execPath (veja realExecPath): ele aponta
 * para a extracao temporaria. No macOS, o app.asar/Contents/MacOS/GoLiveBypass.
 */
function realExecPath(): string {
  if (IS_LINUX) {
    const appImage = process.env.APPIMAGE;
    if (appImage && fs.existsSync(appImage)) return appImage;
  }
  // O portable do Windows se auto-extrai num dir %TEMP% aleatorio a CADA execucao:
  // o process.execPath dentro do app e o exe EXTRAIDO. Gravar a Run key com ele
  // morria quando o temp era limpo (Storage Sense/CCleaner) e apontava o boot para
  // uma copia velha depois de update — o "nao abre mesmo ativando" dos usuarios do
  // portable. O PORTABLE_EXECUTABLE_FILE e o exe ORIGINAL que o usuario rodou (o
  // updater ja usa a mesma variavel para se substituir).
  if (IS_WINDOWS && process.env.PORTABLE_EXECUTABLE_FILE &&
      fs.existsSync(process.env.PORTABLE_EXECUTABLE_FILE)) {
    return process.env.PORTABLE_EXECUTABLE_FILE;
  }
  return process.execPath;
}

// Escape minimo exigido pelo formato Desktop Entry para caminhos com espacos,
// aspas, barras invertidas ou caracteres especiais.
function desktopExecPath(value: string): string {
  return `"${value.replace(/([\\"`$])/g, "\\$1")}"`;
}

function removeLegacyRunKey() {
  try {
    execFileSync("reg.exe", ["delete", RUN_KEY, "/v", ENTRY_NAME, "/f"], { stdio: "ignore", windowsHide: true });
  } catch {
    // Entrada antiga ausente: migracao ja feita.
  }
}

function hasScheduledTask(): boolean {
  try {
    execFileSync("schtasks.exe", ["/Query", "/TN", TASK_NAME], { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function hasLegacyRunKey(): boolean {
  try {
    const output = execFileSync("reg.exe", ["query", RUN_KEY, "/v", ENTRY_NAME], { encoding: "utf8", windowsHide: true });
    return output.includes(ENTRY_NAME);
  } catch {
    return false;
  }
}

/**
 * Marca o app para iniciar com o login do usuario.
 * - Windows: tarefa agendada ONLOGON /RL HIGHEST (exe elevado)
 * - macOS: app.setLoginItemSettings (funciona em dmg/zip)
 * - Linux: ~/.config/autostart/golivebypass.desktop
 *
 * Args de execucao: ["--hidden"] para subir so na bandeja no login, sem abrir
 * a janela do GUI. A primeira coisa que o main faz com --hidden e a checagem
 * launchedHidden() (ver main.ts), que decide se cria a janela visivel.
 */
export function setStartup(enabled: boolean): StartupResult {
  if (IS_WINDOWS) {
    if (enabled) {
      const executable = realExecPath();
      if (!executable || !fs.existsSync(executable)) {
        return { success: false, error: "O executável atual do GoLiveBypass não foi encontrado." };
      }
      const tr = `"${executable}" --hidden`;
      try {
        execFileSync("schtasks.exe", [
          "/Create",
          "/TN", TASK_NAME,
          "/TR", tr,
          "/SC", "ONLOGON",
          "/RL", "HIGHEST",
          "/F",
        ], { stdio: "ignore", windowsHide: true });
      } catch (error) {
        console.error("falha ao criar tarefa de inicializacao:", error);
        return { success: false, error: "O Windows recusou a criação da inicialização automática." };
      }
      removeLegacyRunKey();
      if (!getStartup()) return { success: false, error: "A tarefa foi criada, mas não pôde ser confirmada." };
    } else {
      try {
        execFileSync("schtasks.exe", ["/Delete", "/TN", TASK_NAME, "/F"], { stdio: "ignore", windowsHide: true });
      } catch {
        // Tarefa ausente: ja estava desligada.
      }
      removeLegacyRunKey();
    }
    return { success: true };
  }

  if (IS_LINUX) {
    const file = path.join(app.getPath("home"), ".config", "autostart", "golivebypass.desktop");
    if (enabled) {
      const dir = path.dirname(file);
      try {
        fs.mkdirSync(dir, { recursive: true });
        const content = [
          "[Desktop Entry]",
          "Type=Application",
          "Name=GoLiveBypass",
          "Comment=Devolve o Go Live e a camera no Discord",
          `Exec=${desktopExecPath(realExecPath())} --hidden`,
          `TryExec=${desktopExecPath(realExecPath())}`,
          "X-GNOME-Autostart-enabled=true",
          "X-GNOME-Autostart-Delay=5",
          "",
        ].join("\n");
        const temp = `${file}.tmp-${process.pid}`;
        fs.writeFileSync(temp, content);
        fs.renameSync(temp, file);
        if (!fs.existsSync(file)) return { success: false, error: "O arquivo de inicialização não foi criado." };
      } catch (error) {
        console.error("falha ao escrever .desktop:", error);
        return { success: false, error: "Não foi possível criar a inicialização automática do Linux." };
      }
    } else if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        console.error("falha ao remover .desktop:", error);
        return { success: false, error: "Não foi possível desativar a inicialização automática do Linux." };
      }
    }
    return { success: true };
  }

  if (IS_MAC) {
    // setLoginItemSettings no Electron 22+ funciona em dmg/zip (foi
    // reescrito para suportar portable, mas o app oficial do projeto e
    // dmg). Mantemos o caminho padrao.
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: ["--hidden"],
    });
    return { success: true };
  }
  return { success: true };
}

/**
 * Le o estado atual do autostart. Retorna true se o app vai subir com o
 * login, false caso contrario.
 *
 * No Windows, lemos a tarefa agendada (e a Run key antiga, ate migrar).
 */
export function getStartup(): boolean {
  if (IS_LINUX) {
    const file = path.join(app.getPath("home"), ".config", "autostart", "golivebypass.desktop");
    return fs.existsSync(file);
  }
  if (IS_WINDOWS) {
    return hasScheduledTask() || hasLegacyRunKey();
  }
  return app.getLoginItemSettings().openAtLogin;
}

/**
 * Reescreve a entrada de Run com o caminho ATUAL do exe, se a entrada existir.
 *
 * O valor da Run key congela o caminho de quando o usuario ativou o toggle — e o
 * portable muda de lugar o tempo todo (baixa na Downloads, move para o Desktop,
 * renomeia, o updater substitui). O Windows falha em SILENCIO quando o caminho do
 * valor nao existe mais: o app simplesmente nao abre no boot, com o checkbox
 * marcado — getStartup() so confere se a ENTRADA existe, nao se o caminho dela e
 * valido. Rodar isto a cada abertura do app cura todos esses casos (um reg add
 * idempotente, custo desprezivel) e devolve a flag --hidden se ela se perdeu.
 */
export function syncStartupEntry(): void {
  if (!IS_WINDOWS) return;
  if (!getStartup()) return;
  setStartup(true);
}

/**
 * Detecta se o app foi iniciado pelo autostart (Run key no Windows,
 * openAsHidden do macOS, ou o .desktop do Linux). Usado para nao abrir a
 * janela visivel em boots automaticos -- o usuario so precisa do icone
 * na bandeja.
 */
export function launchedHidden(): boolean {
  if (process.argv.includes("--hidden")) return true;
  if (IS_MAC) {
    return app.getLoginItemSettings().wasOpenedAtLogin;
  }
  if (IS_LINUX) {
    return process.argv.includes("--hidden");
  }
  return false;
}
