# First release: 0.1.0

The public repository is [josemanosalvas/groq-minifier](https://github.com/josemanosalvas/groq-minifier).
Both package versions are 0.1.0 and use the same Git tag, `v0.1.0`. MIT project
licensing and generated-artifact notices must ship with the npm artifact.

The first npm/crates.io publication is performed by the maintainer, with their
registry credentials and two-factor authentication where required. CI builds
and tests artifacts; it has no publication tokens and never publishes on push.

## Gates

1. The full CI matrix is green for the exact release commit: Rust formatting,
   Clippy, default/all-feature tests, WASM build, JavaScript/types, differential
   tests, clean packed Node consumers on all three operating systems and Node
   22/24/26, and Chromium/Firefox/WebKit raw imports and Vite production bundles.
2. The benchmark report covers native Rust, complete WASM round trips, and the
   independent JavaScript span scanner for all five categories, including
   median/p95, throughput, import initialization, and artifact size. Source
   hashes must match. There is no fixed speedup requirement.
3. The existing application's private query corpus has been validated locally.
   Commit only the aggregate attestation produced by the
   [corpus helper](corpus.md); never application queries or source code.
4. `cargo package --locked` and the packed npm artifact have been reviewed.
   Build tools/dependencies and lockfiles are pinned/committed.
5. Immediately before publication, recheck both names. `npm run release:check`
   queries the npm registry and crates.io index; only HTTP 404 means available.
   If either name is occupied or availability is uncertain, stop. An occupied
   name requires a naming decision; do not automatically rename either package.

## Reproduce and publish

From a clean checkout with Cargo on PATH:

```sh
cargo install wasm-bindgen-cli --version 0.2.105 --locked
npm --prefix npm ci
npm --prefix npm run build
cargo package --locked
npm --prefix npm run test:pack
npm --prefix npm run bench
```

Validate the private corpus, commit the aggregate evidence, and wait for the
full CI matrix. Then run the release gate immediately before publishing:

```sh
npm --prefix npm run release:check
git tag -a v0.1.0 -m 'groq-minifier 0.1.0'
git push origin v0.1.0
cargo publish --locked
npm publish npm/artifacts/groq-minifier-0.1.0.tgz --access public
```

Publish the exact tested tarball, which contains WASM and declarations and
requires no consumer toolchain. Archive its checksum and the crate generated
by `cargo package` in a GitHub release for `v0.1.0`. Publication to two registries
is not atomic; if one upload fails after the other succeeds, preserve the tag
and version, verify ownership, and complete the remaining upload. Do not rerun
the initial unused-name gate as if an already published package were a naming
collision. Future releases need a separate ownership-aware process.

The macOS checkout requested for later can be created independently:

```sh
git clone https://github.com/josemanosalvas/groq-minifier.git /Users/manosalvashj/Developer/groq-minifier
```
