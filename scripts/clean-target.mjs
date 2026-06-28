import { rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const target = join(root, "src-tauri", "target");
const gen = join(root, "src-tauri", "gen");

for (const dir of [target, gen]) {
  if (!existsSync(dir)) continue;
  console.log(`Removing ${dir} ...`);
  rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  console.log("Done.");
}

if (process.argv.includes("--build")) {
  const result = spawnSync("npm", ["run", "tauri", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  process.exit(result.status ?? 1);
}