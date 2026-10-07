import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const failures = [];
const readJson = (file) =>
  JSON.parse(readFileSync(path.join(root, file), "utf8"));
const check = (message, action) => {
  try {
    action();
  } catch (error) {
    failures.push(`${message}: ${error.message}`);
  }
};
const requireTrue = (condition, message) => {
  if (!condition) throw new Error(message);
};
check("Versions", () => {
  const rustVersion = /^version = "([^"]+)"/m.exec(
    readFileSync(path.join(root, "Cargo.toml"), "utf8"),
  )[1];
  requireTrue(
    rustVersion === "0.1.0" &&
      readJson("npm/package.json").version === rustVersion,
    "Both packages must be 0.1.0",
  );
});
check("Benchmark evidence", () => {
  const report = readJson("benchmarks/results.json");
  requireTrue(
    report.version === "0.1.0" && report.implementations.length === 3,
    "Complete benchmark evidence required",
  );
  for (const implementation of report.implementations) {
    requireTrue(
      implementation.results.length === 5,
      "Every query category is required",
    );
    for (const result of implementation.results)
      requireTrue(
        result.samples >= 101 &&
          result.medianNs > 0 &&
          result.p95Ns > 0 &&
          result.throughputMiBs > 0,
        "Missing measurements",
      );
  }
  for (const [file, hash] of Object.entries(report.sourceHashes))
    requireTrue(
      createHash("sha256")
        .update(readFileSync(path.join(root, file)))
        .digest("hex") === hash,
      `Stale benchmark source: ${file}`,
    );
  requireTrue(
    createHash("sha256")
      .update(readFileSync(path.join(root, "npm/dist/groq_minifier_bg.wasm")))
      .digest("hex") === report.artifacts.wasmSha256,
    "Stale WASM artifact",
  );
});
check("Private corpus", () => {
  const summary = readJson("docs/private-corpus-validation.json");
  requireTrue(
    summary.version === "0.1.0" &&
      summary.queryCount > 0 &&
      summary.oracleChecked + summary.specificationChecked ===
        summary.queryCount,
    "Corpus must be fully checked",
  );
  for (const [file, hash] of Object.entries(summary.sourceHashes))
    requireTrue(
      createHash("sha256")
        .update(readFileSync(path.join(root, file)))
        .digest("hex") === hash,
      `Stale corpus validation: ${file}`,
    );
});
check("Clean checkout", () =>
  requireTrue(
    execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim() === "",
    "Commit all release sources/evidence first",
  ),
);
check("CI", () => {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const runs = JSON.parse(
    execFileSync(
      "gh",
      [
        "run",
        "list",
        "--repo",
        "josemanosalvas/groq-minifier",
        "--workflow",
        "CI",
        "--commit",
        commit,
        "--limit",
        "1",
        "--json",
        "status,conclusion",
      ],
      { encoding: "utf8" },
    ),
  );
  requireTrue(
    runs[0]?.status === "completed" && runs[0]?.conclusion === "success",
    "Current commit requires a successful full CI matrix",
  );
});
// Only 404 proves an unused name; network/auth/server failures never count as available.
for (const [registry, url] of [
  ["npm", "https://registry.npmjs.org/groq-minifier"],
  ["crates.io", "https://index.crates.io/gr/oq/groq-minifier"],
]) {
  try {
    const response = await fetch(url);
    if (response.status === 200)
      failures.push(
        `${registry}: groq-minifier is occupied; stop for a maintainer naming decision`,
      );
    else if (response.status !== 404)
      failures.push(
        `${registry}: availability could not be verified (HTTP ${response.status})`,
      );
    else console.log(`${registry}: name is currently unused`);
  } catch (error) {
    failures.push(
      `${registry}: availability could not be verified (${error.message})`,
    );
  }
}
if (failures.length) {
  console.error(
    "Release blocked:\n" + failures.map((failure) => "- " + failure).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    "0.1.0 release gates passed. Publication remains a maintainer action; use the same v0.1.0 tag for both packages.",
  );
}
