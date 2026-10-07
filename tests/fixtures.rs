use groq_minifier::{minify_groq, MinifyError};
use serde_json::Value;

#[test]
fn shared_fixtures() {
    let fixtures: Value = serde_json::from_str(include_str!("../fixtures/cases.json")).unwrap();
    for case in fixtures["valid"].as_array().unwrap() {
        let input = case["input"].as_str().unwrap();
        let expected = case["output"].as_str().unwrap();
        let output = minify_groq(input).unwrap();
        assert_eq!(output, expected, "{}", case["name"]);
        assert_eq!(minify_groq(&output).unwrap(), output);
        assert!(output.len() <= input.len());
    }
    for case in fixtures["invalid"].as_array().unwrap() {
        let error = minify_groq(case["input"].as_str().unwrap()).unwrap_err();
        assert_eq!(
            error.offset(),
            case["offset"].as_u64().unwrap() as usize,
            "{case}"
        );
        assert_eq!(
            matches!(error, MinifyError::UnterminatedString { .. }),
            case["kind"] == "unterminated",
            "{case}"
        );
        assert!(
            error.to_string().contains(case["reason"].as_str().unwrap()),
            "{case}: {error}"
        );
    }
}

#[test]
fn all_token_pairs_across_all_trivia() {
    let fixtures: Value = serde_json::from_str(include_str!("../fixtures/cases.json")).unwrap();
    for pair in fixtures["pairs"].as_array().unwrap() {
        for separator in fixtures["separators"].as_array().unwrap() {
            let input = format!(
                "{}{}{}",
                pair[0].as_str().unwrap(),
                separator.as_str().unwrap(),
                pair[1].as_str().unwrap()
            );
            assert_eq!(
                minify_groq(&input).unwrap(),
                pair[2].as_str().unwrap(),
                "{input:?}"
            );
        }
    }
}
