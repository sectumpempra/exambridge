import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const publicRoot = new URL("../public/", import.meta.url);
const serverRoot = new URL("../dist/server/", import.meta.url);

for (const entry of await readdir(publicRoot)) {
  await rm(join(serverRoot.pathname, entry), { recursive: true, force: true });
}
