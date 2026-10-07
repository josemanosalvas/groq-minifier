// Bounded deterministic generators shared by differential and AST/result checks.
export function generatedQueries() {
  let state = 0x47524f51;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  const queries = [];
  const trivia = [
    " ",
    "\t",
    "\n",
    "\v",
    "\f",
    "\r",
    "\u0085",
    "\u00a0",
    "// generated\n",
  ];
  const wrap = (value) =>
    `${trivia[next() % trivia.length]}${value}${trivia[next() % trivia.length]}`;
  const expression = (depth) => {
    if (depth === 0 || next() % 3 === 0) return wrap(String(next() % 100));
    switch (next() % 5) {
      case 0:
        return (
          wrap("(") +
          expression(depth - 1) +
          wrap(["+", "-", "*", "**"][next() % 4]) +
          expression(depth - 1) +
          wrap(")")
        );
      case 1:
        return (
          wrap("[") +
          expression(depth - 1) +
          wrap(",") +
          expression(depth - 1) +
          wrap("]")
        );
      case 2:
        return wrap('{"é👋":') + expression(depth - 1) + wrap("}");
      case 3:
        return wrap('"escaped \\" quote // URL https://example.invalid é👋"');
      default:
        return wrap("(") + expression(depth - 1) + wrap(")");
    }
  };
  for (let i = 0; i < 256; i++) queries.push(expression(4));
  return { queries, next };
}
