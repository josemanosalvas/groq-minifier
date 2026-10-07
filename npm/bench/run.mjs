import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { minifyGroq } from "groq-minifier";
import { scanJavaScript } from "./span-scanner.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
mkdirSync(path.join(root, "benchmarks"), { recursive: true });
const cases = JSON.parse(
  readFileSync(path.join(root, "fixtures/benchmarks.json"), "utf8"),
);
const native = JSON.parse(
  execFileSync(
    "cargo",
    ["bench", "--locked", "--bench", "scanner", "--quiet"],
    { cwd: root, encoding: "utf8" },
  ),
);
const results = [];
let consumed = 0;
for (const [implementation, minify] of [
  ["JavaScript/WASM round trip", minifyGroq],
  ["JavaScript span scanner", scanJavaScript],
]) {
  const rows = [];
  for (const { name, query } of cases) {
    assert.equal(minify(query), minifyGroq(query));
    const inputBytes = Buffer.byteLength(query);
    const iterations = Math.max(
      1,
      Math.min(10_000, Math.floor(262_144 / Math.max(1, inputBytes))),
    );
    for (let i = 0; i < 1000; i++) consumed ^= minify(query).length;
    const times = [];
    for (let sample = 0; sample < 101; sample++) {
      const start = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) consumed ^= minify(query).length;
      times.push(Number(process.hrtime.bigint() - start) / iterations);
    }
    times.sort((a, b) => a - b);
    rows.push({
      name,
      inputBytes,
      iterations,
      samples: 101,
      medianNs: times[50],
      p95Ns: times[95],
      throughputMiBs: ((inputBytes / times[50]) * 1e9) / 1_048_576,
    });
  }
  const importTarget = implementation.includes("WASM")
    ? "groq-minifier"
    : "./bench/span-scanner.mjs";
  const cold = [];
  for (let sample = 0; sample < 21; sample++) {
    const code = `const start=process.hrtime.bigint();await import(${JSON.stringify(importTarget)});console.log(Number(process.hrtime.bigint()-start));`;
    cold.push(
      Number(
        execFileSync(
          process.execPath,
          ["--input-type=module", "--eval", code],
          { cwd: path.join(root, "npm"), encoding: "utf8" },
        ),
      ),
    );
  }
  cold.sort((a, b) => a - b);
  results.push({
    implementation,
    initialization: { samples: 21, medianNs: cold[10], p95Ns: cold[19] },
    results: rows,
  });
}
const sourceFiles = [
  "src/lib.rs",
  "Cargo.toml",
  "Cargo.lock",
  "rust-toolchain.toml",
  "fixtures/benchmarks.json",
  "benches/scanner.rs",
  "npm/src/checked.js",
  "npm/src/node.js",
  "npm/src/browser.js",
  "npm/bench/span-scanner.mjs",
  "npm/bench/run.mjs",
  "npm/package-lock.json",
];
const sourceHashes = Object.fromEntries(
  sourceFiles.map((file) => [
    file,
    createHash("sha256")
      .update(readFileSync(path.join(root, file)))
      .digest("hex"),
  ]),
);
const wasm = readFileSync(path.join(root, "npm/dist/groq_minifier_bg.wasm"));
const tarball = path.join(root, "npm/artifacts/groq-minifier-0.1.0.tgz");
const packed = JSON.parse(
  execFileSync(
    process.execPath,
    [
      process.env.npm_execpath,
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      path.dirname(tarball),
    ],
    { cwd: path.join(root, "npm"), encoding: "utf8" },
  ),
)[0];
const report = {
  version: "0.1.0",
  measuredAt: new Date().toISOString(),
  environment: {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0].model,
    logicalCpus: os.cpus().length,
    node: process.version,
    rust: execFileSync("rustc", ["--version"], { encoding: "utf8" }).trim(),
    wasmBindgen: execFileSync("wasm-bindgen", ["--version"], {
      encoding: "utf8",
    }).trim(),
  },
  method:
    "101 batches per case; batch iterations clamp(floor(256 KiB/input bytes), 1, 10000); 1000 warmup calls; nanoseconds per complete allocating call; p95 is sorted batch index 95. 21 fresh-process imports exclude process startup; p95 is sorted index 19. No concurrent workloads requested; host scheduling is uncontrolled.",
  sourceHashes,
  artifacts: {
    wasmBytes: wasm.length,
    wasmGzipBytes: gzipSync(wasm).length,
    wasmSha256: createHash("sha256").update(wasm).digest("hex"),
    javascriptBytes: readdirSync(path.join(root, "npm/dist"))
      .filter((file) => file.endsWith(".js"))
      .reduce(
        (sum, file) => sum + statSync(path.join(root, "npm/dist", file)).size,
        0,
      ),
    npmTarballBytes: packed.size,
    npmUnpackedBytes: packed.unpackedSize,
  },
  implementations: [native, ...results],
  consumed,
};
writeFileSync(
  path.join(root, "benchmarks/results.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const lines = [
  "# Benchmark evidence",
  "",
  `Measured ${report.measuredAt} on ${report.environment.cpu}, ${report.environment.platform}/${report.environment.arch}, ${report.environment.node}, ${report.environment.rust}.`,
  "",
  report.method,
  "",
  "Results measure allocation and output consumption. The WASM figures include UTF-16 validation, input encoding, Rust scanning, and output decoding. The independently authored JavaScript comparator implements the same fixture contract with sticky token matching and source-span copying; it is not a claim about every possible JavaScript implementation.",
  "",
  "| Implementation | Query | UTF-8 bytes | Median µs | p95 µs | MiB/s |",
  "| --- | --- | ---: | ---: | ---: | ---: |",
];
for (const implementation of report.implementations)
  for (const row of implementation.results)
    lines.push(
      `| ${implementation.implementation} | ${row.name} | ${row.inputBytes} | ${(row.medianNs / 1000).toFixed(3)} | ${(row.p95Ns / 1000).toFixed(3)} | ${row.throughputMiBs.toFixed(1)} |`,
    );
lines.push(
  "",
  "Cold module initialization (filesystem cache may be warm; process startup excluded):",
);
for (const implementation of results)
  lines.push(
    `- ${implementation.implementation}: median ${(implementation.initialization.medianNs / 1e6).toFixed(3)} ms; p95 ${(implementation.initialization.p95Ns / 1e6).toFixed(3)} ms.`,
  );
lines.push(
  "- Native Rust: no module initialization or runtime loading; compilation/linking excluded.",
  "",
  `Artifacts: WASM ${wasm.length} bytes (${report.artifacts.wasmGzipBytes} bytes gzip), JavaScript ${report.artifacts.javascriptBytes} bytes, npm tarball ${packed.size} bytes (${packed.unpackedSize} unpacked).`,
  "",
  "Raw samples are summarized in [results.json](results.json), with source hashes and build-tool versions. These are machine-specific measurements with no fixed speedup gate or general performance claim. Browser networking and device-specific WASM startup must be measured in the consumer's deployment.",
  "",
  "Reproduce from the repository root:",
  "",
  "```sh",
  "cargo install wasm-bindgen-cli --version 0.2.105 --locked",
  "npm --prefix npm ci",
  "npm --prefix npm run build",
  "npm --prefix npm run bench",
  "```",
  "",
);
writeFileSync(path.join(root, "benchmarks/README.md"), lines.join("\n"));
console.log(
  `Wrote benchmarks/results.json and benchmarks/README.md; WASM ${wasm.length} bytes, npm tarball ${packed.size} bytes.`,
);
