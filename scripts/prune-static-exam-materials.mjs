import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const materialsPath = resolve(process.cwd(), "dist-static/exam-materials");

// Official materials are persistent server data. A release archive must never
// provide this path, even when Vite copied only the public SOURCES.md marker.
await rm(materialsPath, { recursive: true, force: true });

console.log("Removed exam-materials from the static release artifact.");
