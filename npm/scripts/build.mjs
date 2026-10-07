import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const npmRoot = path.join(root, "npm");
const dist = path.join(npmRoot, "dist");
const manifest = readFileSync(path.join(root, "Cargo.toml"), "utf8");
const version = /wasm-bindgen = \{ version = "=([^"]+)"/.exec(manifest)?.[1];
const actual = execFileSync("wasm-bindgen", ["--version"], {
  encoding: "utf8",
}).trim();
if (actual !== `wasm-bindgen ${version}`) {
  throw new Error(`Expected wasm-bindgen ${version}; got ${actual}`);
}
execFileSync(
  "cargo",
  [
    "build",
    "--locked",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "--features",
    "wasm",
    "--lib",
  ],
  { cwd: root, stdio: "inherit" },
);
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
execFileSync(
  "wasm-bindgen",
  [
    path.join(root, "target/wasm32-unknown-unknown/release/groq_minifier.wasm"),
    "--target",
    "web",
    "--out-dir",
    dist,
    "--out-name",
    "groq_minifier",
  ],
  { stdio: "inherit" },
);
for (const file of ["node.js", "browser.js", "checked.js", "index.d.ts"]) {
  cpSync(path.join(npmRoot, "src", file), path.join(dist, file));
}
for (const file of ["README.md", "LICENSE", "THIRD_PARTY_NOTICES"])
  cpSync(path.join(root, file), path.join(npmRoot, file));
