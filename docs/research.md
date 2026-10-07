# Scanner research

Checked on 2026-10-07. These notes and example queries were written independently;
no upstream implementation or test fixtures were copied.

## Specification contract

- Whitespace is exactly U+0009–U+000D, U+0020, U+0085, and U+00A0. Other
  Unicode spaces, line separators, and BOM are not removable whitespace.
- Comments start with `//` outside strings and end at LF or EOF. CR, NEL, and
  Unicode line separators do not terminate them.
- Identifiers use ASCII letters, digits, and underscore, beginning with a letter
  or underscore. Numbers include decimals and `e`/`E` exponents.
- Both quote styles allow raw control characters and newlines. Accepted escapes
  are `\'`, `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`, `\uXXXX`, and
  `\u{hex+}`. Adjacent fixed-width high/low surrogate escapes form one scalar.
  Invalid Unicode values are syntax errors.
- Namespaced `fn` declarations precede the expression and end with `;`.

These rules come from [GROQ revision 3, syntax](https://spec.groq.dev/GROQ-1.revision3/#sec-Syntax),
[numbers and strings](https://spec.groq.dev/GROQ-1.revision3/#sec-Number), and
[custom functions](https://spec.groq.dev/GROQ-1.revision3/#sec-Custom-Functions).

Unicode scalars exclude U+D800–U+DFFF and stop at U+10FFFF; unassigned characters
and noncharacters are still scalars. See [Unicode 17, section 3.9](https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-3/#G7404).
The braced grammar has no maximum digit count. Consequently, leading zeros must
not cause rejection of a valid value; bounded accumulation can reject overflow
without allocating or parsing an unbounded integer.

## Boundary deductions

Removing a separator can merge identifier fragments, digits, a decimal point,
or an exponent fragment. It can also create `**`, `//`, `==`, `=>`, `!=`, `<=`,
`>=`, `&&`, `||`, `::`, `->`, `..`, or `...`. Numeric fragments such as `1e+ 2`
need preceding-token context, beyond the adjacent `+` and `2`. These are scanner
test candidates even when the surrounding input is structurally invalid.
Retained token spans should preserve spelling; validation should never decode
and re-encode strings. See the independent deductions above against the
[upstream token recognition](https://github.com/sanity-io/groq-js/blob/f6a2c5ee680d051e0ac8d260c59dc106b8d76925/src/rawParser.js).

In a local evaluator probe with dataset `[{n:3}]`, `2 * *[0].n` returned `6`,
while `2**[0].n` returned `null`. The gap between the two stars is required.
Odd/even backslash parity before closing quotes, URLs, LF-free comments, all
eight whitespace characters, and long braced escapes deserve direct fixtures.

## Evaluator coverage and explicit limitations

The inspected release was `groq-js@2.0.0`, commit
`f6a2c5ee680d051e0ac8d260c59dc106b8d76925`. Its public API supplies parsing and
evaluation; its AST is experimental, so comparisons must pin the dependency.
See the [upstream README](https://github.com/sanity-io/groq-js#versioning).

Local probes established these limitations:

- EOF comments are rejected; the whitespace regex requires an LF after a
  comment. `1//comment\n` succeeds, while `1//comment` fails.
- `"\u{1F600}"` evaluates to U+F600 rather than the intended astral scalar.
  Fixed-width `"\uD83D\uDE00"` evaluates correctly. The decoder uses
  `String.fromCharCode` for both escape forms.
- Invalid escapes and lone surrogate escapes can be accepted. For example,
  `"\q"` evaluates to the string `undefined`; `"\uZZZZ"` to a NUL.
- `length ("ab")` fails although `length("ab")` succeeds. This prevents direct
  AST comparison for specification-permitted spacing in that position.

These behaviors are visible in [the raw parser](https://github.com/sanity-io/groq-js/blob/f6a2c5ee680d051e0ac8d260c59dc106b8d76925/src/rawParser.js)
and [the string decoder](https://github.com/sanity-io/groq-js/blob/f6a2c5ee680d051e0ac8d260c59dc106b8d76925/src/parser.ts#L48).

Custom functions support one parameter and projection-shaped bodies, not
arbitrary arithmetic bodies. The independently authored query
`fn local::copy($x) = $x {name}; local::copy({"name":"one"})` evaluates to
`{"name":"one"}`. See [custom-function validation](https://github.com/sanity-io/groq-js/blob/f6a2c5ee680d051e0ac8d260c59dc106b8d76925/src/parser.ts#L905).

Use explicit fixtures with documented oracle coverage. Specification cases
outside that coverage still require direct expected-output/error tests; a
catch-and-skip parser comparison would hide missing coverage.

## JavaScript input encoding

`wasm-bindgen` converts JavaScript strings with `TextEncoder`, which replaces
unpaired UTF-16 surrogates with U+FFFD. Validate the complete JavaScript input
before entering WASM, including characters that would later be removed as
comments. Paired surrogates are valid. Written ASCII escapes such as
`"\uD800"` pass the UTF-16 input check and are rejected by Rust's escape
validator instead. Preserve Rust's UTF-8 byte offset in `SyntaxError` messages;
JavaScript code-unit positions are a different unit. See
[the wasm-bindgen string conversion contract](https://wasm-bindgen.github.io/wasm-bindgen/reference/types/str.html#utf-16-vs-utf-8).
