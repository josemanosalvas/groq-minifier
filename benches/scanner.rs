use std::hint::black_box;
use std::time::Instant;

fn main() {
    let cases: serde_json::Value =
        serde_json::from_str(include_str!("../fixtures/benchmarks.json")).unwrap();
    let mut results = Vec::new();
    for case in cases.as_array().unwrap() {
        let query = case["query"].as_str().unwrap();
        let iterations = (262_144 / query.len().max(1)).clamp(1, 10_000);
        for _ in 0..1000 {
            black_box(groq_minifier::minify_groq(black_box(query)).unwrap());
        }
        let mut times = Vec::with_capacity(101);
        for _ in 0..101 {
            let start = Instant::now();
            for _ in 0..iterations {
                black_box(groq_minifier::minify_groq(black_box(query)).unwrap());
            }
            times.push(start.elapsed().as_secs_f64() * 1e9 / iterations as f64);
        }
        times.sort_by(f64::total_cmp);
        let median = times[50];
        results.push(serde_json::json!({
            "name": case["name"], "inputBytes": query.len(), "iterations": iterations,
            "samples": 101, "medianNs": median, "p95Ns": times[95],
            "throughputMiBs": query.len() as f64 / median * 1e9 / 1_048_576.0
        }));
    }
    println!(
        "{}",
        serde_json::json!({"implementation": "native Rust", "initializationNs": 0, "results": results})
    );
}
