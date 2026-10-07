import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../.consumer/", import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".json": "application/json",
};
http
  .createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      const filename = path.resolve(
        root,
        "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
      );
      if (!filename.startsWith(root)) throw new Error("Outside consumer root");
      const body = await readFile(filename);
      response.writeHead(200, {
        "Content-Type":
          types[path.extname(filename)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  })
  .listen(4173, "0.0.0.0", () =>
    console.log(
      "Packed consumers: http://localhost:4173/raw.html and /bundle/",
    ),
  );
