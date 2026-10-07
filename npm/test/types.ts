import { minifyGroq } from "groq-minifier";
const result: string = minifyGroq('* [ _type == "entry" ]');
void result;
// @ts-expect-error Only strings are accepted.
minifyGroq(123);
