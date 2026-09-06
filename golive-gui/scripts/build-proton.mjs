import { mkdirSync } from "fs";
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "tools", "proton-confgen");
mkdirSync(join(root, "build"), { recursive: true });

function build(out, extraEnv = {}) {
  const result = spawnSync("go", ["build", "-o", out, "./cmd/protonvpn-wg"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32",
  });
  if (result.status) process.exit(result.status ?? 1);
}

if (process.platform === "win32") {
  build("build/proton-confgen.exe");
} else {
  build("build/proton-confgen");
  build("build/proton-confgen.exe", { GOOS: "windows", GOARCH: "amd64", CGO_ENABLED: "0" });
}
