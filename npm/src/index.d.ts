/**
 * Remove GROQ comments and redundant whitespace, preserving retained spelling.
 * WASM initializes once during import; no explicit initialization is required.
 * @throws {SyntaxError} Invalid string escapes or unterminated strings; messages
 * contain a reason and a zero-based UTF-8 byte offset in the original input.
 * @throws {TypeError} Non-string input or unpaired JavaScript UTF-16 surrogates.
 */
export declare function minifyGroq(query: string): string;
