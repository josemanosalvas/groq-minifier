import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, evaluate } from "groq-js";
import { minifyGroq } from "groq-minifier";
import { scanJavaScript } from "../bench/span-scanner.mjs";

const fixtures = JSON.parse(
  readFileSync(new URL("../../fixtures/cases.json", import.meta.url), "utf8"),
);
const dataset = [
  { _id: "first", _type: "entry", n: 3, name: "one" },
  { _id: "second", _type: "entry", n: 5, name: "two" },
];
for (const fixture of fixtures.valid) {
  test(fixture.name, async () => {
    const output = minifyGroq(fixture.input);
    assert.equal(output, fixture.output);
    assert.equal(scanJavaScript(fixture.input), output);
    assert.equal(minifyGroq(output), output);
    assert.ok(Buffer.byteLength(output) <= Buffer.byteLength(fixture.input));
    if (fixture.oracle) {
      const original = parse(fixture.input);
      const minified = parse(output);
      assert.deepEqual(minified, original);
      assert.deepEqual(
        await (await evaluate(minified, { dataset })).get(),
        await (await evaluate(original, { dataset })).get(),
      );
    } else {
      assert.ok(
        fixture.reason,
        "Every fixture outside the oracle needs an explicit reason",
      );
    }
  });
}
for (const fixture of fixtures.invalid) {
  test(fixture.name, () => {
    for (const minify of [minifyGroq, scanJavaScript]) {
      assert.throws(
        () => minify(fixture.input),
        (error) =>
          error instanceof SyntaxError &&
          error.message.includes(fixture.reason) &&
          error.message.includes(`UTF-8 byte offset ${fixture.offset}`),
      );
    }
  });
}
test("all token pairs across every GROQ whitespace and comment separator", () => {
  for (const [left, right, expected] of fixtures.pairs) {
    for (const separator of fixtures.separators) {
      const query = left + separator + right;
      assert.equal(minifyGroq(query), expected, JSON.stringify(query));
      assert.equal(scanJavaScript(query), expected, JSON.stringify(query));
    }
  }
});
test("multiplication retains meaning and evaluates to six", async () => {
  for (const query of ["2 * *[0].n", minifyGroq("2 * *[0].n")]) {
    assert.equal(await (await evaluate(parse(query), { dataset })).get(), 6);
  }
  assert.notEqual(
    await (await evaluate(parse("2**[0].n"), { dataset })).get(),
    6,
  );
});
test("unpaired UTF-16 is rejected before encoding, even in comments", () => {
  for (const query of [
    "\ud800",
    "\udc00",
    "// \ud800",
    '"\ud800"',
    "\ud800x",
    "\udc00\ud800",
  ]) {
    assert.throws(() => minifyGroq(query), TypeError);
    assert.throws(() => scanJavaScript(query), TypeError);
  }
  assert.equal(minifyGroq('"👋"'), '"👋"');
});
test("non-string inputs are TypeErrors", () => {
  for (const value of [null, undefined, 3, {}, new String("x")])
    assert.throws(() => minifyGroq(value), TypeError);
});
test("all escapes and literal spelling remain intact", () => {
  for (let count = 0; count < 32; count++) {
    const literal = '"' + "\\".repeat(count) + (count % 2 ? '"x' : "x") + '"';
    assert.equal(minifyGroq(" " + literal + " "), literal);
  }
  assert.equal(
    minifyGroq('"\\u{' + "0".repeat(100_000) + '41}"').length,
    100_008,
  );
});
