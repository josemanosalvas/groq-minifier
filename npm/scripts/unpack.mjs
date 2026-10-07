// CI consumers use the Linux-built tarball and never compile Rust themselves.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temp = mkdtempSync(path.join(os.tmpdir(), "groq-unpack-"));
execFileSync("tar", [
  "-xzf",
  path.join(root, "artifacts/groq-minifier-0.1.0.tgz"),
  "-C",
  temp,
]);
mkdirSync(path.join(root, "dist"), { recursive: true });
cpSync(path.join(temp, "package/dist"), path.join(root, "dist"), {
  recursive: true,
});
for (const file of ["LICENSE", "README.md", "THIRD_PARTY_NOTICES"])
  cpSync(path.join(temp, "package", file), path.join(root, file));
