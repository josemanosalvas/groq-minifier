import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse, evaluate } from "groq-js";
import { minifyGroq } from "groq-minifier";

assert.ok(process.argv[2], "Supply an external corpus JSON path");
const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const queries = Array.isArray(input) ? input : input.queries;
assert.ok(
  Array.isArray(queries) && queries.length > 0,
  "Corpus must contain queries",
);
let oracleChecked = 0,
  specificationChecked = 0;
for (let index = 0; index < queries.length; index++) {
  try {
    const entry = queries[index];
    const query = typeof entry === "string" ? entry : entry.query;
    const output = minifyGroq(query);
    assert.equal(minifyGroq(output), output);
    assert.ok(Buffer.byteLength(output) <= Buffer.byteLength(query));
    if (entry.oracle === false) {
      assert.ok(entry.reason, "Unsupported syntax needs a reason");
      specificationChecked++;
    } else {
      const original = parse(query);
      const minified = parse(output);
      assert.deepEqual(minified, original);
      const options = {
        dataset: input.dataset ?? [],
        params: input.params ?? {},
      };
      assert.deepEqual(
        await (await evaluate(minified, options)).get(),
        await (await evaluate(original, options)).get(),
      );
      oracleChecked++;
    }
  } catch {
    throw new Error(
      `Private corpus validation failed at entry ${index}; query details withheld`,
    );
  }
}
const sourceHashes = Object.fromEntries(
  ["src/lib.rs", "npm/src/checked.js"].map((file) => [
    file,
    createHash("sha256")
      .update(readFileSync(new URL("../../" + file, import.meta.url)))
      .digest("hex"),
  ]),
);
const summary = {
  version: "0.1.0",
  validatedAt: new Date().toISOString(),
  queryCount: queries.length,
  oracleChecked,
  specificationChecked,
  sourceHashes,
};
writeFileSync(
  new URL("../../docs/private-corpus-validation.json", import.meta.url),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(JSON.stringify(summary));
