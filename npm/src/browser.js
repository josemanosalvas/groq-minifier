import init, { minifyGroq as wasmMinify } from "./groq_minifier.js";
import { checkedMinify } from "./checked.js";

await init({
  module_or_path: new URL("./groq_minifier_bg.wasm", import.meta.url),
});

/** @param {string} query @returns {string} */
export function minifyGroq(query) {
  return checkedMinify(wasmMinify, query);
}
