// Atualizacao automatica via GitHub Releases — sem servidor proprio.
//
// Windows (NSIS em C:\GoLiveBypass) e Linux (AppImage): electron-updater le
// latest.yml / beta.yml publicados pelo electron-builder na release. Canal beta
// = allowPrerelease. macOS fica de fora ate o app ser assinado.

import { app, dialog, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { type Canal } from "./updater-channel";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let updateReady = false;

// O main process consulta esta flag no before-quit: quando o auto-update esta
// aplicando, o quit nao pode ser segurado (senao o app antigo fica vivo e o
// novo morre no lock de instancia unica — o "fecha mas nao abre").
let quittingForUpdate = false;
export function markQuittingForUpdate() {
  quittingForUpdate = true;
}
export function isQuittingForUpdate() {
  return quittingForUpdate;
}

export function setupUpdater(
  getMainWindow: () => BrowserWindow | null,
  isAutoUpdateEnabled: () => boolean = () => true,
  canalAtual: () => Canal = () => "stable",
) {
  // Em desenvolvimento nao existe um AppImage/NSIS que possa receber update. Forcar
  // electron-updater a usar dev-app-update.yml fazia o npm run dev consultar uma release
  // com a versao local e registrar um 404 ruidoso no terminal.
  const isDev = !app.isPackaged;
  if (isDev) {
    console.log("[updater] desenvolvimento: checagem de atualizacoes desativada.");
    return;
  }

  // macOS fica de fora por enquanto. O MacUpdater exige app assinado com Developer ID, e o
  // certificado ainda nao existe (os secrets CSC_LINK/CSC_KEY_PASSWORD nao estao configurados).
  // Sem assinatura ele detecta a versao nova, tenta baixar e falha: pior do que nao oferecer,
  // porque a pessoa fica esperando uma atualizacao que nunca chega. Para religar, basta
  // configurar os secrets (ver UPDATER.md) e apagar este bloco.
  if (process.platform === "darwin") {
    console.log("[updater] macOS: auto-update desligado ate o app ser assinado.");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.logger = console;

  const aplicarCanal = () => {
    // Canal beta: allowPrerelease faz o electron-updater ler beta.yml — que o
    // electron-builder publica sozinho para versao com sufixo de prerelease —
    // em vez do latest.yml. Reaplicado a cada checagem de 4h para o toggle
    // valer sem reiniciar. Desligar nao faz downgrade: a stable mais nova
    // substitui a beta pelo semver (1.1.12 > 1.1.12-beta.7).
    autoUpdater.allowPrerelease = canalAtual() === "beta";
  };
  aplicarCanal();

  // O download corre sozinho em background; ao terminar, avisa o usuario e
  // so instala com o OK dele — atualizar sem avisar derruba o app na hora.
  autoUpdater.on("update-downloaded", async (info) => {
    if (!isAutoUpdateEnabled()) return;
    if (updateReady) return;
    updateReady = true;
    const win = getMainWindow();
    // showMessageBox (assincrono), nao showMessageBoxSync: o sincrono bloqueia a
    // thread JS do processo principal ate a pessoa clicar um botao -- inclusive o
    // setInterval do watchdog.
    const choice = win
      ? (await dialog.showMessageBox(win, {
          type: "info",
          title: "Atualização disponível",
          message: `O GoLiveBypass ${info.version} já baixou.`,
          detail: "Baixar e instalar update agora? O app irá reiniciar durante o processo.",
          buttons: ["Reiniciar agora", "Depois"],
          defaultId: 0,
          cancelId: 1,
        })).response
      : 0;

    if (choice === 0 && !isDev) {
      markQuittingForUpdate();
      autoUpdater.quitAndInstall();
    }
  });

  const checar = () => {
    if (!isAutoUpdateEnabled() || updateReady) return;
    aplicarCanal();
    autoUpdater.checkForUpdates().catch(() => {});
  };

  checar();
  setInterval(checar, CHECK_INTERVAL_MS);
}
