// Independent JavaScript benchmark/reference implementation. Not shipped in npm.
// A sticky lexical expression locates tokens; source spans are copied unchanged.
const tokens =
  /[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]*)?|[A-Za-z_][A-Za-z_0-9]*|\.{2,3}|\*\*|==|!=|<=|>=|=>|->|&&|\|\||::/y;
const compounds = new Set([
  "**",
  "==",
  "!=",
  "<=",
  ">=",
  "=>",
  "->",
  "&&",
  "||",
  "::",
  "//",
]);
const isWord = (char) => /[A-Za-z_0-9]/.test(char);
const isDigit = (char) => char !== undefined && /[0-9]/.test(char);
function gap(left, right, next) {
  if (!left) return false;
  const last = left.at(-1);
  const first = right[0];
  return (
    (isWord(last) && isWord(first)) ||
    (isDigit(left[0]) &&
      ((/[eE]$/.test(left) && /^[+-]/.test(right)) ||
        (/[eE][+-]$/.test(left) && isDigit(first)))) ||
    (isDigit(last) && right === "." && isDigit(next)) ||
    (left === "." && isDigit(first)) ||
    ((left === "." || left === "..") && first === ".") ||
    (left.length === 1 && compounds.has(last + first))
  );
}
export function scanJavaScript(query) {
  if (typeof query !== "string" || !query.isWellFormed())
    throw new TypeError("Expected well-formed UTF-16 string");
  const chunks = [];
  let pos = 0,
    span = 0,
    previous = "",
    separated = false;
  const fail = (offset, reason) => {
    throw new SyntaxError(
      `invalid escape (${reason}) at UTF-8 byte offset ${Buffer.byteLength(query.slice(0, offset))}`,
    );
  };
  const fixed = (offset) => {
    const hex = query.slice(pos, pos + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(hex))
      fail(offset, "expected four hexadecimal digits");
    pos += 4;
    return Number.parseInt(hex, 16);
  };
  while (pos < query.length) {
    const ch = query[pos];
    if (/[\t-\r \u0085\u00a0]/.test(ch) || query.startsWith("//", pos)) {
      if (!separated) chunks.push(query.slice(span, pos));
      separated = true;
      if (query.startsWith("//", pos)) {
        const lf = query.indexOf("\n", pos + 2);
        pos = lf < 0 ? query.length : lf;
      } else pos++;
      span = pos;
      continue;
    }
    const start = pos;
    if (ch === '"' || ch === "'") {
      pos++;
      let closed = false;
      while (pos < query.length) {
        if (query[pos] === ch) {
          pos++;
          closed = true;
          break;
        }
        if (query[pos++] !== "\\") continue;
        const offset = pos - 1;
        const escape = query[pos++];
        if (escape === undefined) fail(offset, "dangling backslash");
        if ("'\"\\/bfnrt".includes(escape)) continue;
        if (escape !== "u") fail(offset, "unknown escape sequence");
        if (query[pos] === "{") {
          const begin = ++pos;
          let value = 0;
          while (pos < query.length && /[0-9a-fA-F]/.test(query[pos])) {
            value = value * 16 + Number.parseInt(query[pos++], 16);
            if (value > 0x10ffff) fail(offset, "invalid Unicode scalar value");
          }
          if (pos === begin || query[pos] !== "}")
            fail(offset, "expected hexadecimal digits and closing brace");
          if (value >= 0xd800 && value <= 0xdfff)
            fail(offset, "invalid Unicode scalar value");
          pos++;
        } else {
          const value = fixed(offset);
          if (value >= 0xd800 && value <= 0xdbff) {
            if (!query.startsWith("\\u", pos))
              fail(offset, "unpaired high surrogate");
            const second = pos;
            pos += 2;
            const low = fixed(second);
            if (!(low >= 0xdc00 && low <= 0xdfff))
              fail(offset, "unpaired high surrogate");
          } else if (value >= 0xdc00 && value <= 0xdfff)
            fail(offset, "unpaired low surrogate");
        }
      }
      if (!closed)
        throw new SyntaxError(
          `unterminated string at UTF-8 byte offset ${Buffer.byteLength(query.slice(0, start))}`,
        );
    } else {
      tokens.lastIndex = pos;
      const match = tokens.exec(query);
      pos += match ? match[0].length : query.codePointAt(pos) > 0xffff ? 2 : 1;
    }
    const token = query.slice(start, pos);
    if (separated && gap(previous, token, query[pos])) chunks.push(" ");
    previous = token;
    separated = false;
  }
  chunks.push(query.slice(span, pos));
  return chunks.join("");
}
