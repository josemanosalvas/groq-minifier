// JSON-lines differential test helper. This is not a distributed product CLI.
use std::io::{self, BufRead};

fn main() {
    for line in io::stdin().lock().lines() {
        let query: String = serde_json::from_str(&line.unwrap()).unwrap();
        let result = match groq_minifier::minify_groq(&query) {
            Ok(output) => serde_json::json!({"output": output}),
            Err(error) => serde_json::json!({"error": error.to_string()}),
        };
        println!("{result}");
    }
}
