# Benchmark evidence

Measured 2026-10-07T13:42:50.633Z on AMD Ryzen 7 5800X3D 8-Core Processor, linux/x64, v22.14.0, rustc 1.90.0 (1159e78c4 2025-09-14).

101 batches per case; batch iterations clamp(floor(256 KiB/input bytes), 1, 10000); 1000 warmup calls; nanoseconds per complete allocating call; p95 is sorted batch index 95. 21 fresh-process imports exclude process startup; p95 is sorted index 19. No concurrent workloads requested; host scheduling is uncontrolled.

Results measure allocation and output consumption. The WASM figures include UTF-16 validation, input encoding, Rust scanning, and output decoding. The independently authored JavaScript comparator implements the same fixture contract with sticky token matching and source-span copying; it is not a claim about every possible JavaScript implementation.

| Implementation | Query | UTF-8 bytes | Median µs | p95 µs | MiB/s |
| --- | --- | ---: | ---: | ---: | ---: |
| native Rust | small | 58 | 0.175 | 0.177 | 316.3 |
| native Rust | large | 61442 | 177.858 | 179.428 | 329.5 |
| native Rust | already compact | 42 | 0.090 | 0.093 | 442.7 |
| native Rust | comment heavy | 23098 | 6.767 | 11.369 | 3255.4 |
| native Rust | Unicode heavy | 27138 | 48.765 | 50.263 | 530.7 |
| JavaScript/WASM round trip | small | 58 | 0.862 | 0.906 | 64.2 |
| JavaScript/WASM round trip | large | 61442 | 520.951 | 534.337 | 112.5 |
| JavaScript/WASM round trip | already compact | 42 | 0.547 | 0.568 | 73.2 |
| JavaScript/WASM round trip | comment heavy | 23098 | 86.278 | 90.611 | 255.3 |
| JavaScript/WASM round trip | Unicode heavy | 27138 | 204.785 | 219.321 | 126.4 |
| JavaScript span scanner | small | 58 | 2.824 | 2.894 | 19.6 |
| JavaScript span scanner | large | 61442 | 3339.559 | 3426.437 | 17.5 |
| JavaScript span scanner | already compact | 42 | 0.796 | 0.822 | 50.3 |
| JavaScript span scanner | comment heavy | 23098 | 26.834 | 33.355 | 820.9 |
| JavaScript span scanner | Unicode heavy | 27138 | 749.547 | 758.823 | 34.5 |

Cold module initialization (filesystem cache may be warm; process startup excluded):
- JavaScript/WASM round trip: median 6.268 ms; p95 6.784 ms.
- JavaScript span scanner: median 2.588 ms; p95 3.072 ms.
- Native Rust: no module initialization or runtime loading; compilation/linking excluded.

Artifacts: WASM 36120 bytes (17304 bytes gzip), JavaScript 8807 bytes, npm tarball 25777 bytes (61984 unpacked).

Raw samples are summarized in [results.json](results.json), with source hashes and build-tool versions. These are machine-specific measurements with no fixed speedup gate or general performance claim. Browser networking and device-specific WASM startup must be measured in the consumer's deployment.

Reproduce from the repository root:

```sh
cargo install wasm-bindgen-cli --version 0.2.105 --locked
npm --prefix npm ci
npm --prefix npm run build
npm --prefix npm run bench
```
