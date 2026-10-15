# Private corpus validation

Run the corpus helper locally against queries you own. Application source,
datasets, and query strings must stay outside this repository. The helper emits
aggregate counts only. It does not print queries, source paths, ASTs, values, or
parser messages. A failure identifies an entry by index.

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

The WASM scanner checks every query. The helper also checks that minification
is idempotent and does not increase the query's size. For queries that `groq-js`
supports, the helper compares the ASTs and evaluation results of the original
and minified queries using the local dataset and parameters. Each query marked
as unsupported must include a reason. The helper checks these queries lexically
and counts them separately. It does not silently skip parser failures. Expand
application templates and interpolations locally before supplying complete
strings.

```sh
npm --prefix npm run build
node npm/scripts/validate-corpus.mjs /absolute/private/corpus.json
```

After every query passes, the helper writes only version, date, source hashes,
and counts to `docs/private-corpus-validation.json`. Commit only this aggregate
attestation. You can build and test the project without a private corpus. The
original release plan requires the attestation. That check remains pending
until the maintainer supplies the corpus location.
