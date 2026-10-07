import { minifyGroq } from "groq-minifier";

try {
  const fixtures = await (await fetch("/cases.json")).json();
  let checked = 0;
  for (const { input, output } of fixtures.valid) {
    if (minifyGroq(input) !== output || minifyGroq(output) !== output)
      throw new Error("Unexpected minified output");
    checked++;
  }
  for (const { input, offset, reason } of fixtures.invalid) {
    let caught = false;
    try {
      minifyGroq(input);
    } catch (error) {
      caught =
        error instanceof SyntaxError &&
        error.message.includes(reason) &&
        error.message.includes(`UTF-8 byte offset ${offset}`);
    }
    if (!caught)
      throw new Error("Expected SyntaxError with reason and UTF-8 offset");
    checked++;
  }
  for (const input of ["\ud800", "// \udc00", 3, null]) {
    let caught = false;
    try {
      minifyGroq(input);
    } catch (error) {
      caught = error instanceof TypeError;
    }
    if (!caught) throw new Error("Expected TypeError before encoding");
    checked++;
  }
  const repeated = await import("groq-minifier");
  if (repeated.minifyGroq !== minifyGroq)
    throw new Error("Module was not initialized once");
  const wasmLoads = performance
    .getEntriesByType("resource")
    .filter((r) => r.name.endsWith(".wasm")).length;
  if (wasmLoads !== 1)
    throw new Error(`Expected one WASM fetch; got ${wasmLoads}`);
  globalThis.consumerResult = { ok: true, checked, wasmLoads };
  document.querySelector("#result").textContent =
    `Passed ${checked} packed browser checks; WASM loaded once.`;
} catch (error) {
  globalThis.consumerResult = { ok: false, error: String(error) };
  document.querySelector("#result").textContent = String(error);
  throw error;
}
