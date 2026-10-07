# groq-minifier

An independent, spelling-preserving GROQ whitespace and comment minifier.
The Rust core uses only the standard library by default. The ESM npm package
contains precompiled WASM and TypeScript declarations. It needs no Rust
installation, Sanity credentials, dataset, or initialization call.

Both packages are versioned **0.1.0**. Registry publication is maintainer
controlled and gated by [release checks](docs/releasing.md). Until publication,
install a source-generated npm tarball or use the Rust checkout directly.

## Installation and examples

Once published:

```sh
cargo add groq-minifier@0.1.0
npm install groq-minifier@0.1.0
```

```rust
use groq_minifier::minify_groq;

assert_eq!(minify_groq("* [ n > 1 ] { n, }").unwrap(), "*[n>1]{n,}");
```

```js
import { minifyGroq } from "groq-minifier";

minifyGroq('* [ _type == "entry" ] { title }');
// '*[_type=="entry"]{title}'

minifyGroq("2 * *[0].n"); // '2* *[0].n', preserving multiplication
minifyGroq("// documentation only"); // ''
```

Rust API: `minify_groq(query: &str) -> Result<String, MinifyError>`.
JavaScript API: `minifyGroq(query: string): string`.
The package is ESM; CommonJS consumers can use `await import('groq-minifier')`.
Supported Node majors are 22, 24, and 26.

## Input and error guarantees

- Comments and redundant whitespace are removed. Token spelling, quote style,
  escapes, literal controls, commas, parentheses, and function declarations
  remain intact. No expressions or literals are rewritten.
- Whitespace is exactly GROQ's U+0009–U+000D, U+0020, U+0085, and U+00A0.
  Other Unicode spaces and BOM remain. Comments end only at LF or EOF.
- Empty, whitespace-only, and comment-only input returns an empty string.
  Valid output never grows in UTF-8 bytes and is idempotent.
- Both string quote styles support standard escapes, `\uXXXX`, `\u{hex+}`,
  and adjacent fixed-width UTF-16 high/low surrogate escape pairs. Braced
  escapes allow leading zeros. Invalid Unicode scalars, malformed escapes,
  and dangling backslashes are rejected.
- Rust distinguishes `UnterminatedString { offset }` from
  `InvalidEscape { offset, reason }`. Offsets are zero-based UTF-8 bytes in the
  original input: the opening quote for an unterminated string, or the
  offending escape's backslash. Incomplete escapes are invalid escapes.
- JavaScript throws `SyntaxError` with the reason and that UTF-8 byte offset.
  Non-string arguments and unpaired JavaScript UTF-16 surrogates throw
  `TypeError` before WASM encoding, including surrogates inside comments.
  A `TypeError` surrogate position uses UTF-16 code units and says so.
- This is a scanner, not a query parser. It validates string spelling;
  structural and application-level query validation is the caller's job.

```js
try {
  minifyGroq('"\\q"');
} catch (error) {
  // SyntaxError: invalid escape (unknown escape sequence) at UTF-8 byte offset 1
}
```

These guarantees follow [GROQ revision 3](https://spec.groq.dev/GROQ-1.revision3/).
The input check prevents the [UTF-16 replacement performed during WASM
encoding](https://wasm-bindgen.github.io/wasm-bindgen/reference/types/str.html#utf-16-vs-utf-8).

## Browser loading

Modern browsers need ES modules, top-level await, `TextEncoder`/`TextDecoder`,
`fetch`, and WebAssembly. Node initializes synchronously while importing its
entry point. Browsers await WASM initialization within the module; the exported
function is immediately usable once the import resolves. Each environment
initializes once per ESM module instance.

Bundlers select the `browser` export; Node selects `node`. Vite consumers
should enable top-level await, for example `build.target: 'es2022'`.
The wrapper uses `new URL('./groq_minifier_bg.wasm', import.meta.url)` so Vite
can emit and locate the asset. Serve WASM as `application/wasm` and allow its
fetch and compilation in your deployment's CSP.

For an unbundled deployment, copy the package's entire `dist/` directory:

```html
<script type="module">
  import { minifyGroq } from './groq-minifier/dist/browser.js';
  console.log(minifyGroq(' * [ n > 1 ] '));
</script>
```

No explicit `init()` call is needed. Browser startup includes an asynchronous
asset fetch; initialization failure rejects the module import.

## Development and verification

The root is the Rust crate; `npm/` owns JavaScript packaging. Shared fixtures
are in `fixtures/`. Install the pinned Rust toolchain in `rust-toolchain.toml`,
use Node 22.14.0 for reproducible builds, and add Cargo's bin directory to PATH.

```sh
cargo install wasm-bindgen-cli --version 0.2.105 --locked
npm --prefix npm ci
cargo fmt --check
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked
npm --prefix npm run build
npm --prefix npm run check
npm --prefix npm test
npm --prefix npm run test:differential
npm --prefix npm run test:pack
cd npm
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

`npm run build` generates artifacts from source with the pinned `wasm-bindgen`
CLI. Generated `dist/` files are excluded from git; `npm pack` builds and
includes them. The packed package has no runtime npm dependencies or install
scripts. The Rust WASM binding is enabled only with `--features wasm`.

CI checks formatting, Clippy, default/all-feature Rust tests, WASM builds,
JavaScript and types, and native/WASM/JavaScript equivalence. Packed consumers
run on Linux, macOS, and Windows with Node 22, 24, and 26. Browser imports and
a Vite production bundle run in Chromium, Firefox, and WebKit.

`groq-js@2.0.0` checks original/minified ASTs and evaluated results for supported
syntax. Unsupported specification cases have direct fixtures with explicit
reasons, including EOF comments and braced astral escapes. Tests never catch
parser failures and silently skip them. See [research notes](docs/research.md).
Rust property tests cover bounded arbitrary UTF-8, generated valid literals,
unchanged string spelling, byte offsets, non-growing output, and idempotence.

Private application queries can be checked locally without copying them into
the repository; see [corpus validation](docs/corpus.md). Application integration,
caching, product CLI support, and native Node bindings are separate work.

## Benchmarks and prior art

See [benchmark evidence and reproducible commands](benchmarks/README.md) for
native Rust, complete JavaScript→WASM→JavaScript calls, and an independent
JavaScript span scanner. Small, large, compact, comment-heavy, and Unicode-heavy
cases report median, p95, throughput, cold initialization, and artifact size.
Measurements are machine-specific; there is no fixed speedup gate or general
performance claim.

The GROQ specification and [groq-js](https://github.com/sanity-io/groq-js) are
language and correctness references. [groq](https://github.com/sanity-io/sanity/tree/main/packages/groq)
provides JavaScript query tagging. [go-groq](https://github.com/sanity-io/go-groq)
provides parsing and formatting tools, including GROQ minification. This project's scanner and
generic fixtures were written independently. Generated WASM/glue notices are
in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES). Project code is MIT licensed.
