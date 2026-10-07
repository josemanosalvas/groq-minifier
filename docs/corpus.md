# Private corpus validation

Run this locally against queries you own. Application source, datasets, and
query strings must stay outside this repository. The helper emits aggregate
counts only; it does not print queries, source paths, ASTs, values, or parser
messages. A failure identifies an entry by index.

Provide an external JSON file containing either an array of query strings, or:

```json
{
  "queries": [
    {"query": "1 + 2"},
    {"query": "1 // EOF comment", "oracle": false, "reason": "groq-js EOF comment limitation"}
  ],
  "dataset": [],
  "params": {}
}
```

Examples above are generic. Every query is checked by the WASM scanner and
for idempotence and non-growth. Queries supported by `groq-js` additionally
compare original/minified ASTs and evaluation results using the provided local
dataset/parameters. Any explicitly unsupported query must include a reason;
it receives direct lexical checks and is counted separately. There is no
catch-and-skip fallback. Expand application templates/interpolations locally
before supplying complete strings.

```sh
npm --prefix npm run build
node npm/scripts/validate-corpus.mjs /absolute/private/corpus.json
```

After every query passes, the helper writes only version, date, source hashes,
and counts to `docs/private-corpus-validation.json`. This aggregate attestation
is the only corpus artifact that should be committed. No corpus is required
to build or test this project. The first release gate requires a completed
attestation; until the maintainer supplies the corpus location, it remains
pending.
