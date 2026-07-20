import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  collectComparableSamples,
  generateEstimatedBoundary,
} from "../src/domain-v2/awards/estimate-core.ts";
import {
  EstimatedAwardBoundarySchema,
  OfficialAwardBoundarySchema,
  OfficialAwardRouteSchema,
} from "../src/domain-v2/awards/schema.ts";

export const TARGETS = Object.freeze([
  Object.freeze({ targetSeries: "2026-june", dataAsOf: "2025-08-14" }),
]);

export const canonicalize = value => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .filter(key => value[key] !== undefined)
      .map(key => [key, canonicalize(value[key])]));
  }
  return value;
};

export const canonicalStringify = value => JSON.stringify(canonicalize(value));
const sha256 = value => createHash("sha256").update(canonicalStringify(value)).digest("hex");
const variantsKey = variants => [...variants].sort().join(",");
const exactKey = (routeId, series, optionCode, variants) =>
  [routeId, series, optionCode ?? "", variantsKey(variants)].join("|");
const routeVariants = route => route.components.map(component =>
  route.board === "CAIE" ? component.code.slice(component.code.lastIndexOf("/") + 1) : component.code);
const boundaryKey = boundary => exactKey(
  boundary.routeId,
  boundary.targetSeries,
  boundary.optionCode,
  boundary.componentVariants,
);

const validateTargets = targets => targets.map(target => {
  if (!target || !/^\d{4}-(march|june|november)$/.test(target.targetSeries) ||
    typeof target.dataAsOf !== "string" || target.dataAsOf.length === 0) {
    throw new Error("Invalid Award estimate target");
  }
  return { targetSeries: target.targetSeries, dataAsOf: target.dataAsOf };
});

export function buildAwardEstimateArtifact(input) {
  const routes = input.routes.map(value => OfficialAwardRouteSchema.parse(value));
  const officialBoundaries = input.officialBoundaries.map(value => OfficialAwardBoundarySchema.parse(value));
  const targets = validateTargets(input.targets);
  const inputManifestHash = sha256({ officialBoundaries, routes, targets });
  const officialKeys = new Set(officialBoundaries.map(boundary => exactKey(
    boundary.routeId,
    boundary.series,
    boundary.optionCode,
    boundary.componentVariants,
  )));
  const boundaries = [];

  for (const target of targets) {
    for (const route of routes) {
      const targetKey = exactKey(route.id, target.targetSeries, route.optionCode, routeVariants(route));
      if (officialKeys.has(targetKey)) continue;
      const samples = collectComparableSamples(route, target.targetSeries, officialBoundaries);
      if (samples.length < 3) continue;

      const draft = generateEstimatedBoundary({ route, ...target, samples });
      const withManifest = { ...draft, inputManifestHash };
      const record = EstimatedAwardBoundarySchema.parse({
        ...withManifest,
        contentHash: sha256(withManifest),
      });
      boundaries.push(record);
    }
  }

  boundaries.sort((a, b) => boundaryKey(a).localeCompare(boundaryKey(b)));
  return {
    schemaVersion: 1,
    boundaries,
    inputManifestHash,
    contentHash: sha256(boundaries),
  };
}

const readJson = async path => JSON.parse(await readFile(path, "utf8"));

async function buildFromRepository() {
  const root = process.cwd();
  const [routesJson, aqaJson, ocrJson, ocrFsmqJson, pearson8ma0Json, caieJson] = await Promise.all([
    readJson(resolve(root, "src/data/official/awards/routes.json")),
    readJson(resolve(root, "src/data/official/awards/aqa-7357.json")),
    readJson(resolve(root, "src/data/official/awards/ocr-h240.json")),
    readJson(resolve(root, "src/data/official/awards/ocr-6993.json")),
    readJson(resolve(root, "src/data/official/awards/pearson-8ma0.json")),
    readJson(resolve(root, "src/data/official/awards/caie-9709.json")),
  ]);
  const artifact = buildAwardEstimateArtifact({
    routes: routesJson.routes,
    officialBoundaries: [...aqaJson.boundaries, ...ocrJson.boundaries, ...ocrFsmqJson.boundaries, ...pearson8ma0Json.boundaries, ...caieJson.boundaries],
    targets: TARGETS,
  });
  await writeFile(
    resolve(root, "generated/estimates/award-boundaries-v1.json"),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) await buildFromRepository();
