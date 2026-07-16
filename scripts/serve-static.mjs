import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist-static");
const port = Number(process.env.PORT ?? 3000);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
};

await access(join(root, "index.html"));

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname);
  const relative = normalize(pathname).replace(/^[/\\]+/, "");
  let file = join(root, relative || "index.html");
  if (!file.startsWith(root)) file = join(root, "index.html");
  try {
    if (!(await stat(file)).isFile()) file = join(root, "index.html");
  } catch {
    file = join(root, "index.html");
  }
  response.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
  response.setHeader("Cache-Control", file.endsWith("sw.js") ? "no-cache" : "public, max-age=0, must-revalidate");
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`ExamBridge static test server: http://127.0.0.1:${port}`);
});
