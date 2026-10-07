/** @param {unknown} query @returns {asserts query is string} */
export function checkInput(query) {
  if (typeof query !== "string") {
    throw new TypeError("GROQ query must be a string");
  }
  // TextEncoder and wasm-bindgen replace unpaired UTF-16 surrogates with U+FFFD.
  // Check before crossing that boundary, including text inside comments.
  for (let i = 0; i < query.length; i++) {
    const unit = query.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = query.charCodeAt(i + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) {
        throw new TypeError(
          `Unpaired UTF-16 surrogate at code unit offset ${i}`,
        );
      }
      i++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TypeError(`Unpaired UTF-16 surrogate at code unit offset ${i}`);
    }
  }
}

/**
 * @param {(query: string) => string} wasmMinify
 * @param {string} query
 * @returns {string}
 */
export function checkedMinify(wasmMinify, query) {
  checkInput(query);
  try {
    return wasmMinify(query);
  } catch (error) {
    if (typeof error === "string") throw new SyntaxError(error);
    throw error;
  }
}
