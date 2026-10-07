// This file is copied to a new project that contains only the packed dependency.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minifyGroq } from "groq-minifier";

const fixtures = JSON.parse(
  readFileSync(new URL("cases.json", import.meta.url), "utf8"),
);
for (const { input, output } of fixtures.valid) {
  assert.equal(minifyGroq(input), output);
  assert.equal(minifyGroq(output), output);
}
for (const { input, offset, reason } of fixtures.invalid) {
  assert.throws(
    () => minifyGroq(input),
    (error) =>
      error instanceof SyntaxError &&
      error.message.includes(reason) &&
      error.message.includes(`UTF-8 byte offset ${offset}`),
  );
}
for (const input of ["\ud800", "// \udc00", 3, null])
  assert.throws(() => minifyGroq(input), TypeError);
const second = await import("groq-minifier");
assert.equal(second.minifyGroq, minifyGroq);
console.log(`Clean ${process.platform} consumer passed on ${process.version}.`);
