/**
 * Gera build/icon.ico, build/icon.png e assets/tray.png a partir de assets/icon.png.
 * Uso: node build/gen-icons.mjs
 */
import { writeFileSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import pngToIco from "png-to-ico";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPng = join(root, "assets", "icon.png");

copyFileSync(srcPng, join(root, "build", "icon.png"));
const ico = await pngToIco(srcPng);
writeFileSync(join(root, "build", "icon.ico"), ico);
console.log("wrote build/icon.ico", ico.length, "bytes");
console.log("wrote build/icon.png");

const trayOut = join(root, "assets", "tray.png").replace(/\\/g, "\\\\");
const trayIn = srcPng.replace(/\\/g, "\\\\");
execFileSync(
  "python",
  [
    "-c",
    `from PIL import Image; Image.open(r'${trayIn}').convert('RGBA').resize((64,64), Image.Resampling.LANCZOS).save(r'${trayOut}')`,
  ],
  { stdio: "inherit" },
);
console.log("wrote assets/tray.png (64x64)");
