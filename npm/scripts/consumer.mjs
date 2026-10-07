import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const npmRoot = fileURLToPath(new URL("../", import.meta.url));
const consumer = path.join(npmRoot, ".consumer");
const artifacts = path.join(npmRoot, "artifacts");
mkdirSync(artifacts, { recursive: true });
assert.ok(
  process.env.npm_execpath,
  "Run this helper through npm run test:pack or test:browser",
);
const packed = JSON.parse(
  execFileSync(
    process.execPath,
    [
      process.env.npm_execpath,
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      artifacts,
    ],
    { cwd: npmRoot, encoding: "utf8" },
  ),
)[0];
assert.equal(packed.name, "groq-minifier");
for (const file of [
  "dist/groq_minifier_bg.wasm",
  "dist/index.d.ts",
  "dist/browser.js",
  "dist/node.js",
  "LICENSE",
])
  assert.ok(
    packed.files.some((f) => f.path === file),
    `Missing packed file ${file}`,
  );
assert.ok(
  packed.files.every(
    (f) =>
      f.path.startsWith("dist/") ||
      ["LICENSE", "README.md", "THIRD_PARTY_NOTICES", "package.json"].includes(
        f.path,
      ),
  ),
);
rmSync(consumer, { recursive: true, force: true });
mkdirSync(consumer, { recursive: true });
writeFileSync(
  path.join(consumer, "package.json"),
  JSON.stringify({
    name: "groq-minifier-clean-consumer",
    private: true,
    type: "module",
  }),
);
// Installation uses the tarball, with lifecycle scripts enabled and no Rust on PATH.
const cleanPath = process.env.PATH.split(path.delimiter)
  .filter((p) => !p.toLowerCase().includes(".cargo"))
  .join(path.delimiter);
execFileSync(
  process.execPath,
  [
    process.env.npm_execpath,
    "install",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    path.join(artifacts, packed.filename),
  ],
  { cwd: consumer, env: { ...process.env, PATH: cleanPath }, stdio: "inherit" },
);
cpSync(
  new URL("../../fixtures/cases.json", import.meta.url),
  path.join(consumer, "cases.json"),
);
cpSync(
  new URL("../test/packed-node.mjs", import.meta.url),
  path.join(consumer, "test.mjs"),
);
execFileSync(process.execPath, ["test.mjs"], {
  cwd: consumer,
  env: { ...process.env, PATH: cleanPath },
  stdio: "inherit",
});
writeFileSync(
  path.join(consumer, "types.ts"),
  'import {minifyGroq} from "groq-minifier"; const q: string = minifyGroq("1");\n// @ts-expect-error Only strings accepted\nminifyGroq(1);\n',
);
execFileSync(
  process.execPath,
  [
    path.join(npmRoot, "node_modules/typescript/bin/tsc"),
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "types.ts",
  ],
  { cwd: consumer, stdio: "inherit" },
);
if (
  process.argv.includes("--browser") ||
  process.argv.includes("--prepare-browser")
) {
  cpSync(
    new URL("../test/browser-entry.js", import.meta.url),
    path.join(consumer, "main.js"),
  );
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><title>GROQ packed consumer</title></head><body><p id="result">Running packed browser checks…</p><script type="module" src="/main.js"></script></body></html>';
  writeFileSync(path.join(consumer, "index.html"), html);
  writeFileSync(
    path.join(consumer, "raw.html"),
    html.replace(
      '<script type="module"',
      '<script type="importmap">{"imports":{"groq-minifier":"/node_modules/groq-minifier/dist/browser.js"}}</script><script type="module"',
    ),
  );
  mkdirSync(path.join(consumer, "public"));
  cpSync(
    path.join(consumer, "cases.json"),
    path.join(consumer, "public/cases.json"),
  );
  await build({
    root: consumer,
    base: "./",
    configFile: false,
    build: { target: "es2022", outDir: "bundle", assetsInlineLimit: 0 },
  });
  if (process.argv.includes("--browser"))
    execFileSync(
      process.execPath,
      [path.join(npmRoot, "node_modules/@playwright/test/cli.js"), "test"],
      { cwd: npmRoot, stdio: "inherit" },
    );
}
console.log(
  `Packed consumer passed (${packed.size} bytes compressed; ${packed.unpackedSize} unpacked).`,
);
