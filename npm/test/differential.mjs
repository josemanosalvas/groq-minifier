import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse, evaluate } from "groq-js";
import { minifyGroq } from "groq-minifier";
import { scanJavaScript } from "../bench/span-scanner.mjs";
import { generatedQueries } from "./generated.mjs";

const fixtures = JSON.parse(
  readFileSync(new URL("../../fixtures/cases.json", import.meta.url), "utf8"),
);
const generated = generatedQueries();
for (const query of generated.queries) {
  const output = minifyGroq(query);
  assert.deepEqual(parse(output), parse(query));
  assert.deepEqual(
    await (await evaluate(parse(output))).get(),
    await (await evaluate(parse(query))).get(),
  );
  assert.equal(minifyGroq(output), output);
  assert.ok(Buffer.byteLength(output) <= Buffer.byteLength(query));
}
const queries = [
  ...fixtures.valid.map((f) => f.input),
  ...fixtures.invalid.map((f) => f.input),
  ...generated.queries,
];
for (const [left, right] of fixtures.pairs)
  for (const separator of fixtures.separators)
    queries.push(left + separator + right);
const alphabet = [
  ..."abE1e2+*/.=!&|:'\"\\u{}[]()\n\t ",
  "é",
  "👋",
  "\u0085",
  "\u00a0",
  "\u2028",
  "\0",
];
for (let i = 0; i < 512; i++) {
  let input = "";
  for (let len = generated.next() % 256; len > 0; len--)
    input += alphabet[generated.next() % alphabet.length];
  queries.push(input);
}
const result = (query) => {
  try {
    return { output: minifyGroq(query) };
  } catch (error) {
    assert.ok(error instanceof SyntaxError);
    return { error: error.message };
  }
};
const root = fileURLToPath(new URL("../../", import.meta.url));
execFileSync("cargo", ["build", "--locked", "--example", "fixture_runner"], {
  cwd: root,
  stdio: "inherit",
});
const native = execFileSync(
  fileURLToPath(
    new URL(
      `../../target/debug/examples/fixture_runner${process.platform === "win32" ? ".exe" : ""}`,
      import.meta.url,
    ),
  ),
  {
    input: queries.map((query) => JSON.stringify(query)).join("\n") + "\n",
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  },
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
for (let i = 0; i < queries.length; i++) {
  const actual = result(queries[i]);
  assert.deepEqual(actual, native[i], JSON.stringify(queries[i]));
  if (actual.output !== undefined) {
    assert.equal(scanJavaScript(queries[i]), actual.output);
    assert.equal(minifyGroq(actual.output), actual.output);
    assert.ok(
      Buffer.byteLength(actual.output) <= Buffer.byteLength(queries[i]),
    );
  } else {
    assert.throws(
      () => scanJavaScript(queries[i]),
      (error) => error.message === actual.error,
    );
  }
}
console.log(
  `Checked ${queries.length} native/WASM/JavaScript cases; 256 generated AST/result pairs.`,
);
