//! Remove GROQ comments and redundant whitespace without rewriting retained tokens.
//!
//! This is a lexical minifier, not a parser. Query structure is the caller's responsibility.
#![forbid(unsafe_code)]

use std::fmt;

/// A string-literal error with a zero-based UTF-8 byte offset in the original input.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MinifyError {
    /// The offset points to the opening quote.
    UnterminatedString { offset: usize },
    /// The offset points to the backslash that begins the invalid escape.
    InvalidEscape { offset: usize, reason: &'static str },
}

impl MinifyError {
    /// Zero-based UTF-8 byte offset, not a character or UTF-16 index.
    pub fn offset(&self) -> usize {
        match self {
            Self::UnterminatedString { offset } | Self::InvalidEscape { offset, .. } => *offset,
        }
    }
}

impl fmt::Display for MinifyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnterminatedString { offset } => {
                write!(f, "unterminated string at UTF-8 byte offset {offset}")
            }
            Self::InvalidEscape { offset, reason } => {
                write!(f, "invalid escape ({reason}) at UTF-8 byte offset {offset}")
            }
        }
    }
}

impl std::error::Error for MinifyError {}

/// Minify a GROQ query, preserving the spelling of every retained source span.
///
/// Empty input and input containing only GROQ whitespace or comments produce `""`.
/// Both quote styles are checked for valid escapes and Unicode scalar values.
/// Literal control characters within strings are preserved.
pub fn minify_groq(query: &str) -> Result<String, MinifyError> {
    let bytes = query.as_bytes();
    let mut output = String::with_capacity(query.len());
    let mut pos = 0;
    let mut span_start = 0;
    let mut previous = "";
    let mut separated = false;

    while pos < bytes.len() {
        let ws_len = whitespace_len(bytes, pos);
        let comment = bytes[pos..].starts_with(b"//");
        if ws_len != 0 || comment {
            if !separated {
                output.push_str(&query[span_start..pos]);
            }
            separated = true;
            if comment {
                pos += 2;
                while pos < bytes.len() && bytes[pos] != b'\n' {
                    pos += 1;
                }
            } else {
                pos += ws_len;
            }
            span_start = pos;
            continue;
        }

        let start = pos;
        pos = token_end(query, pos)?;
        let token = &query[start..pos];
        if separated && needs_separator(previous, token, bytes.get(pos).copied()) {
            output.push(' ');
        }
        previous = token;
        separated = false;
    }
    output.push_str(&query[span_start..pos]);
    Ok(output)
}

fn whitespace_len(bytes: &[u8], pos: usize) -> usize {
    match bytes[pos] {
        b'\t'..=b'\r' | b' ' => 1,
        0xc2 if matches!(bytes.get(pos + 1), Some(0x85 | 0xa0)) => 2,
        _ => 0,
    }
}

fn word(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_'
}

// Scan tokens only as far as necessary to protect lexical boundaries. Unknown syntax
// remains verbatim; this deliberately does not validate the surrounding expression.
fn token_end(query: &str, start: usize) -> Result<usize, MinifyError> {
    let bytes = query.as_bytes();
    let byte = bytes[start];
    if matches!(byte, b'\'' | b'"') {
        return string_end(bytes, start);
    }
    let mut pos = start + 1;
    if byte.is_ascii_digit() {
        while pos < bytes.len() && bytes[pos].is_ascii_digit() {
            pos += 1;
        }
        if bytes.get(pos) == Some(&b'.') && bytes.get(pos + 1).is_some_and(u8::is_ascii_digit) {
            pos += 2;
            while pos < bytes.len() && bytes[pos].is_ascii_digit() {
                pos += 1;
            }
        }
        if matches!(bytes.get(pos), Some(b'e' | b'E')) {
            let mut end = pos + 1;
            if matches!(bytes.get(end), Some(b'+' | b'-')) {
                end += 1;
            }
            // Keep an incomplete numeric prefix together as boundary context too:
            // removing the gap in `1e+ 2` or `1e +2` would create a new number.
            pos = end;
            while pos < bytes.len() && bytes[pos].is_ascii_digit() {
                pos += 1;
            }
        }
    } else if word(byte) {
        while pos < bytes.len() && word(bytes[pos]) {
            pos += 1;
        }
    } else if byte == b'.' && bytes.get(pos) == Some(&b'.') {
        pos += 1;
        if bytes.get(pos) == Some(&b'.') {
            pos += 1;
        }
    } else if bytes.get(pos).is_some_and(|next| compound(byte, *next)) {
        pos += 1;
    } else if !byte.is_ascii() {
        // Input is &str, so each scalar and every copied span ends on a UTF-8 boundary.
        pos = start
            + query[start..]
                .chars()
                .next()
                .expect("nonempty suffix")
                .len_utf8();
    }
    Ok(pos)
}

fn compound(left: u8, right: u8) -> bool {
    matches!(
        (left, right),
        (b'*', b'*')
            | (b'=', b'=')
            | (b'!', b'=')
            | (b'<', b'=')
            | (b'>', b'=')
            | (b'=', b'>')
            | (b'-', b'>')
            | (b'&', b'&')
            | (b'|', b'|')
            | (b':', b':')
    )
}

fn needs_separator(left: &str, right: &str, following: Option<u8>) -> bool {
    let Some(&last) = left.as_bytes().last() else {
        return false;
    };
    let first = right.as_bytes()[0];
    // Words, numeric suffixes, and adjacent numbers must not be fused.
    if word(last) && word(first) {
        return true;
    }
    if left.as_bytes()[0].is_ascii_digit()
        && ((matches!(last, b'e' | b'E') && matches!(first, b'+' | b'-'))
            || ((left.ends_with("e+")
                || left.ends_with("e-")
                || left.ends_with("E+")
                || left.ends_with("E-"))
                && first.is_ascii_digit()))
    {
        return true;
    }
    // A fractional part must not be created across a removed gap. Ranges are safe.
    if last.is_ascii_digit() && right == "." && following.is_some_and(|b| b.is_ascii_digit()) {
        return true;
    }
    if left == "." && first.is_ascii_digit() {
        return true;
    }
    // Protect .. versus ... and every multi-character operator, notably * *.
    if matches!(left, "." | "..") && first == b'.' {
        return true;
    }
    left.len() == 1 && (compound(last, first) || (last == b'/' && first == b'/'))
}

fn invalid(offset: usize, reason: &'static str) -> MinifyError {
    MinifyError::InvalidEscape { offset, reason }
}

fn hex4(bytes: &[u8], pos: &mut usize, offset: usize) -> Result<u32, MinifyError> {
    let mut value = 0;
    for _ in 0..4 {
        let digit = bytes
            .get(*pos)
            .and_then(|b| char::from(*b).to_digit(16))
            .ok_or_else(|| invalid(offset, "expected four hexadecimal digits"))?;
        value = value * 16 + digit;
        *pos += 1;
    }
    Ok(value)
}

fn string_end(bytes: &[u8], start: usize) -> Result<usize, MinifyError> {
    let quote = bytes[start];
    let mut pos = start + 1;
    while pos < bytes.len() {
        match bytes[pos] {
            byte if byte == quote => return Ok(pos + 1),
            b'\\' => {
                let offset = pos;
                pos += 1;
                match bytes.get(pos) {
                    Some(b'\'' | b'"' | b'\\' | b'/' | b'b' | b'f' | b'n' | b'r' | b't') => {
                        pos += 1;
                    }
                    Some(b'u') => {
                        pos += 1;
                        if bytes.get(pos) == Some(&b'{') {
                            pos += 1;
                            let digits_start = pos;
                            let mut value = 0_u32;
                            while let Some(digit) =
                                bytes.get(pos).and_then(|b| char::from(*b).to_digit(16))
                            {
                                value = value
                                    .checked_mul(16)
                                    .and_then(|v| v.checked_add(digit))
                                    .filter(|v| *v <= 0x10ffff)
                                    .ok_or_else(|| {
                                        invalid(offset, "invalid Unicode scalar value")
                                    })?;
                                pos += 1;
                            }
                            if pos == digits_start || bytes.get(pos) != Some(&b'}') {
                                return Err(invalid(
                                    offset,
                                    "expected hexadecimal digits and closing brace",
                                ));
                            }
                            if char::from_u32(value).is_none() {
                                return Err(invalid(offset, "invalid Unicode scalar value"));
                            }
                            pos += 1;
                        } else {
                            let value = hex4(bytes, &mut pos, offset)?;
                            if (0xd800..=0xdbff).contains(&value) {
                                if bytes.get(pos..pos + 2) != Some(b"\\u") {
                                    return Err(invalid(offset, "unpaired high surrogate"));
                                }
                                let second_offset = pos;
                                pos += 2;
                                let low = hex4(bytes, &mut pos, second_offset)?;
                                if !(0xdc00..=0xdfff).contains(&low) {
                                    return Err(invalid(offset, "unpaired high surrogate"));
                                }
                            } else if (0xdc00..=0xdfff).contains(&value) {
                                return Err(invalid(offset, "unpaired low surrogate"));
                            }
                        }
                    }
                    None => return Err(invalid(offset, "dangling backslash")),
                    _ => return Err(invalid(offset, "unknown escape sequence")),
                }
            }
            _ => pos += 1,
        }
    }
    Err(MinifyError::UnterminatedString { offset: start })
}

#[cfg(feature = "wasm")]
mod bindings {
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen(js_name = minifyGroq)]
    pub fn minify(query: &str) -> Result<String, JsValue> {
        super::minify_groq(query).map_err(|error| JsValue::from_str(&error.to_string()))
    }
}
