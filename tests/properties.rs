use groq_minifier::minify_groq;
use proptest::prelude::*;

proptest! {
    #![proptest_config(ProptestConfig { cases: 256, max_shrink_iters: 2048, .. ProptestConfig::default() })]

    #[test]
    fn arbitrary_utf8_terminates_and_preserves_invariants(chars in prop::collection::vec(any::<char>(), 0..2048)) {
        let input: String = chars.into_iter().collect();
        match minify_groq(&input) {
            Ok(output) => {
                prop_assert!(output.len() <= input.len());
                prop_assert_eq!(minify_groq(&output).unwrap(), output);
            }
            Err(error) => {
                prop_assert!(error.offset() < input.len());
                prop_assert!(input.is_char_boundary(error.offset()));
            }
        }
    }

    #[test]
    fn generated_valid_json_queries(values in prop::collection::vec(-10000_i32..10000, 0..100), separator in prop::sample::select(vec![" ", "\t", "\n", "\r", "\u{b}", "\u{c}", "\u{85}", "\u{a0}", "// generated\n"])) {
        let input = format!("{separator}[{separator}{}{separator}]{separator}", values.iter().map(|n| n.to_string()).collect::<Vec<_>>().join(&format!("{separator},{separator}")));
        let output = minify_groq(&input).unwrap();
        prop_assert_eq!(serde_json::from_str::<serde_json::Value>(&output).unwrap(), serde_json::json!(values));
        prop_assert!(output.len() <= input.len());
        prop_assert_eq!(minify_groq(&output).unwrap(), output);
    }

    #[test]
    fn strings_are_never_rewritten(text in ".{0,256}") {
        let literal = serde_json::to_string(&text).unwrap();
        let input = format!(" // prefix\n {literal} // suffix");
        prop_assert_eq!(minify_groq(&input).unwrap(), literal);
    }
}

#[test]
fn long_adversarial_inputs_are_bounded() {
    let input = format!("\"\\u{{{}41}}\"", "0".repeat(100_000));
    assert_eq!(minify_groq(&input).unwrap(), input);
    assert_eq!(
        minify_groq(&format!("//{}", "é".repeat(100_000))).unwrap(),
        ""
    );
    assert!(minify_groq(&format!("\"{}", "\\\\".repeat(100_000))).is_err());
}
