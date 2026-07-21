import { createHash } from "node:crypto";

const SOURCE_FIELDS = ["sourceUrl", "publishedAt", "accessedAt", "sourceRowId", "sourceDocumentHash"];
const LOWERCASE_SHA256 = /^[a-f0-9]{64}$/;

const deepFreeze = value => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const VERIFIED_ROUTE_SEMANTICS = deepFreeze({
  "award:aqa:7357:linear": {
    board: "AQA",
    qualificationCode: "7357",
    level: "A-Level",
    specificationVersion: "7357-2017",
    routeType: "linear",
    routeKey: "7357-linear",
    components: [
      { code: "7357/1", inputKind: "raw", maxRawMark: 100, weightingFactor: 1 },
      { code: "7357/2", inputKind: "raw", maxRawMark: 100, weightingFactor: 1 },
      { code: "7357/3", inputKind: "raw", maxRawMark: 100, weightingFactor: 1 },
    ],
    maximumMarkAfterWeighting: 300,
    roundingRule: "none",
    grades: ["A*", "A", "B", "C", "D", "E"],
  },
  "award:ocr:h240:linear": {
    board: "OCR",
    qualificationCode: "H240",
    level: "A-Level",
    specificationVersion: "H240-version-3",
    routeType: "linear",
    routeKey: "h240-linear",
    components: [
      { code: "H240/01", inputKind: "raw", maxRawMark: 100, weightingFactor: 1 },
      { code: "H240/02", inputKind: "raw", maxRawMark: 100, weightingFactor: 1 },
      { code: "H240/03", inputKind: "raw", maxRawMark: 100, weightingFactor: 1 },
    ],
    maximumMarkAfterWeighting: 300,
    roundingRule: "none",
    grades: ["A*", "A", "B", "C", "D", "E"],
  },
  "award:ocr:6993:linear": {
    board: "OCR",
    qualificationCode: "6993",
    level: "Level 3 FSMQ",
    specificationVersion: "6993-version-2.0-june-2026",
    routeType: "linear",
    routeKey: "6993-linear",
    components: [
      { code: "6993/01", inputKind: "raw", maxRawMark: 100, weightingFactor: 1 },
    ],
    maximumMarkAfterWeighting: 100,
    roundingRule: "none",
    grades: ["A", "B", "C", "D", "E"],
  },
  "award:pearson:8ma0:linear": {
    board: "Edexcel UK",
    qualificationCode: "8MA0",
    level: "AS-Level",
    specificationVersion: "8MA0-issue-3-october-2025",
    routeType: "linear",
    routeKey: "8ma0-linear",
    components: [
      { code: "8MA0/01", inputKind: "raw", maxRawMark: 100, weightingFactor: 1 },
      { code: "8MA0/02", inputKind: "raw", maxRawMark: 60, weightingFactor: 1 },
    ],
    maximumMarkAfterWeighting: 160,
    roundingRule: "none",
    grades: ["A", "B", "C", "D", "E"],
  },
  "award:caie:9709:2023-2025:as:S1": {
    board: "CAIE",
    qualificationCode: "9709",
    level: "AS-Level",
    specificationVersion: "9709-2023-2025",
    routeType: "same-series",
    routeKey: "9709-as-pure-pure",
    optionCode: "S1",
    components: [
      { code: "9709/11", inputKind: "raw", maxRawMark: 75, weightingFactor: 1 },
      { code: "9709/21", inputKind: "raw", maxRawMark: 50, weightingFactor: 1 },
    ],
    maximumMarkAfterWeighting: 125,
    roundingRule: "none",
    grades: ["a", "b", "c", "d", "e"],
  },
  "award:caie:9709:2023-2025:al:same-series:AX": {
    board: "CAIE",
    qualificationCode: "9709",
    level: "A-Level",
    specificationVersion: "9709-2023-2025",
    routeType: "same-series",
    routeKey: "9709-al-mechanics-statistics",
    optionCode: "AX",
    components: [
      { code: "9709/11", inputKind: "raw", maxRawMark: 75, weightingFactor: 1 },
      { code: "9709/31", inputKind: "raw", maxRawMark: 75, weightingFactor: 1 },
      { code: "9709/41", inputKind: "raw", maxRawMark: 50, weightingFactor: 1 },
      { code: "9709/51", inputKind: "raw", maxRawMark: 50, weightingFactor: 1 },
    ],
    maximumMarkAfterWeighting: 250,
    roundingRule: "none",
    grades: ["A*", "A", "B", "C", "D", "E"],
  },
  "award:caie:9709:2023-2025:al:staged:DX": {
    board: "CAIE",
    qualificationCode: "9709",
    level: "A-Level",
    specificationVersion: "9709-2023-2025",
    routeType: "staged",
    routeKey: "9709-al-staged-statistics",
    optionCode: "DX",
    components: [
      { code: "9709/31", inputKind: "raw", maxRawMark: 75, weightingFactor: 1 },
      { code: "9709/51", inputKind: "raw", maxRawMark: 50, weightingFactor: 1 },
      { code: "9709/84", inputKind: "carried-forward", maxRawMark: 125, weightingFactor: 1 },
    ],
    maximumMarkAfterWeighting: 250,
    roundingRule: "official-carry-forward",
    grades: ["A*", "A", "B", "C", "D", "E"],
  },
});

const ROUTE_SCALAR_FIELDS = [
  "board",
  "qualificationCode",
  "level",
  "specificationVersion",
  "routeType",
  "routeKey",
  "maximumMarkAfterWeighting",
  "roundingRule",
];

const routeComponents = route => (Array.isArray(route?.components) ? route.components : []).map(component => ({
  code: component?.code,
  inputKind: component?.inputKind,
  maxRawMark: component?.maxRawMark,
  weightingFactor: component?.weightingFactor,
}));

const sameJson = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const canonicalize = value => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .filter(key => value[key] !== undefined)
      .map(key => [key, canonicalize(value[key])]));
  }
  return value;
};
const canonicalHash = value => createHash("sha256")
  .update(JSON.stringify(canonicalize(value)))
  .digest("hex");

const auditVerifiedRouteSemantics = (routeById, failures) => {
  for (const routeId of Object.keys(VERIFIED_ROUTE_SEMANTICS)) {
    if (!routeById.has(routeId)) failures.push(`missing expected route "${routeId}"`);
  }

  for (const [routeId, route] of routeById) {
    const expected = VERIFIED_ROUTE_SEMANTICS[routeId];
    if (!expected) {
      failures.push(`unsupported extra route "${routeId}"`);
      continue;
    }

    for (const field of ROUTE_SCALAR_FIELDS) {
      if (route?.[field] !== expected[field]) {
        failures.push(`route semantic mismatch "${routeId}" field "${field}": expected ${JSON.stringify(expected[field])}, actual ${JSON.stringify(route?.[field])}`);
      }
    }

    const hasActualOption = Object.hasOwn(route, "optionCode");
    const hasExpectedOption = Object.hasOwn(expected, "optionCode");
    if (hasActualOption !== hasExpectedOption || route?.optionCode !== expected.optionCode) {
      failures.push(`route semantic mismatch "${routeId}" field "optionCode": expected ${hasExpectedOption ? JSON.stringify(expected.optionCode) : "<absent>"}, actual ${hasActualOption ? JSON.stringify(route?.optionCode) : "<absent>"}`);
    }

    const actualComponents = routeComponents(route);
    if (!sameJson(actualComponents, expected.components)) {
      failures.push(`route semantic mismatch "${routeId}" field "components": expected ${JSON.stringify(expected.components)}, actual ${JSON.stringify(actualComponents)}`);
    }
    if (!sameJson(route?.grades, expected.grades)) {
      failures.push(`route semantic mismatch "${routeId}" field "grades": expected ${JSON.stringify(expected.grades)}, actual ${JSON.stringify(route?.grades)}`);
    }
  }
};

/** @typedef {Record<string, any>} RawAwardRecord */
/**
 * @typedef {object} AwardAuditInput
 * @property {RawAwardRecord[]} [routes]
 * @property {RawAwardRecord[]} [officialBoundaries]
 * @property {RawAwardRecord[]} [estimatedBoundaries]
 * @property {RawAwardRecord} [sourceManifest]
 * @property {Record<string, string>} [normalizedContentHashes]
 * @property {RawAwardRecord} [estimateArtifact]
 * @property {RawAwardRecord[]} [estimateTargets]
 */

const sortedStrings = values => Array.isArray(values) ? [...values].map(String).sort() : [];
const exactKey = (boundary, seriesField) => [
  String(boundary?.routeId ?? ""),
  String(boundary?.[seriesField] ?? ""),
  String(boundary?.optionCode ?? ""),
  sortedStrings(boundary?.componentVariants).join(","),
].join("|");
const seriesValue = series => {
  const match = /^(\d{4})-(march|june|november)$/.exec(String(series));
  if (!match) return Number.NaN;
  return Number(match[1]) * 3 + ({ march: 0, june: 1, november: 2 })[match[2]];
};

const expectedVariants = route => sortedStrings((Array.isArray(route?.components) ? route.components : []).map(component => {
  const code = String(component?.code ?? "");
  if (route?.board !== "CAIE") return code;
  const separator = code.lastIndexOf("/");
  return separator === -1 ? code : code.slice(separator + 1);
}));

const auditSource = (source, label, failures) => {
  for (const field of SOURCE_FIELDS) {
    if (typeof source?.[field] !== "string" || source[field].length === 0) {
      failures.push(`${label} missing source field "${field}"`);
    }
  }
  if (!LOWERCASE_SHA256.test(source?.sourceDocumentHash ?? "")) {
    failures.push(`${label} sourceDocumentHash must be 64 lowercase hex characters`);
  }
};

const variantsMatch = (actualValues, expectedValues) => {
  const actual = sortedStrings(actualValues);
  const hasDuplicates = new Set(actual).size !== actual.length;
  return !hasDuplicates && actual.length === expectedValues.length &&
    actual.every((variant, index) => variant === expectedValues[index]);
};

const hasStrictCaieThresholdSource = route => {
  if (!route?.optionCode || !Array.isArray(route.supportingSources)) return false;
  const expectedSuffix = `-ROW-${route.optionCode}`;
  return route.supportingSources.some(source =>
    SOURCE_FIELDS.every(field => typeof source?.[field] === "string" && source[field].length > 0) &&
    LOWERCASE_SHA256.test(source.sourceDocumentHash) &&
    source.sourceRowId.endsWith(expectedSuffix));
};

/**
 * Independently audits raw parsed Award JSON. This module intentionally does not
 * import the TypeScript/browser catalog so the release gate has a separate path.
 * @param {AwardAuditInput} [input]
 */
export function auditAwardData(input = {}) {
  const {
    routes = [],
    officialBoundaries = [],
    estimatedBoundaries = [],
    sourceManifest = {},
    normalizedContentHashes = {},
    estimateArtifact,
    estimateTargets,
  } = input;
  const failures = [];
  const routeById = new Map();

  for (const [index, route] of routes.entries()) {
    const routeId = String(route?.id ?? "");
    if (routeById.has(routeId)) failures.push(`duplicate route ID "${routeId}"`);
    else routeById.set(routeId, route);

    auditSource(route, `route[${index}] "${routeId}"`, failures);
    for (const [sourceIndex, source] of (Array.isArray(route?.supportingSources) ? route.supportingSources : []).entries()) {
      auditSource(source, `route[${index}] "${routeId}" supportingSources[${sourceIndex}]`, failures);
    }
    if (route?.board === "CAIE" && !hasStrictCaieThresholdSource(route)) {
      failures.push(`CAIE route "${routeId}" lacks a strict supporting threshold source matching exact option code "${route?.optionCode ?? "<absent>"}"`);
    }
  }

  auditVerifiedRouteSemantics(routeById, failures);

  const auditBoundaries = (boundaries, source, seriesField) => {
    const keys = new Set();
    for (const [index, boundary] of boundaries.entries()) {
      const key = exactKey(boundary, seriesField);
      if (keys.has(key)) failures.push(`duplicate ${source} exact key "${key}"`);
      keys.add(key);

      if (source === "official") auditSource(boundary, `official boundary[${index}]`, failures);

      const route = routeById.get(String(boundary?.routeId ?? ""));
      if (!route) {
        failures.push(`${source} boundary[${index}] references unknown route "${boundary?.routeId ?? ""}"`);
        continue;
      }

      const actualOption = boundary?.optionCode ?? "<absent>";
      const routeOption = route?.optionCode ?? "<absent>";
      if (actualOption !== routeOption) {
        failures.push(`${source} boundary[${index}] option code "${actualOption}" does not match route option code "${routeOption}" for "${route.id}"`);
      }

      const expected = expectedVariants(route);
      if (!variantsMatch(boundary?.componentVariants, expected)) {
        failures.push(`${source} boundary[${index}] component variants [${sortedStrings(boundary?.componentVariants).join(",")}] do not match route components [${expected.join(",")}] for "${route.id}"`);
      }

      if (boundary?.maximumMarkAfterWeighting !== route?.maximumMarkAfterWeighting) {
        failures.push(`${source} boundary[${index}] maximum ${boundary?.maximumMarkAfterWeighting} does not match route maximum ${route?.maximumMarkAfterWeighting} for "${route.id}"`);
      }

      if (source === "official" && (route.board === "AQA" || route.qualificationCode === "H240")) {
        if (typeof boundary?.sourceRowId !== "string" || !boundary.sourceRowId.endsWith("OVERALL")) {
          failures.push(`${route.board} ${route.qualificationCode} official boundary[${index}] must be a qualification-level OVERALL row`);
        }
        if (boundary?.maximumMarkAfterWeighting !== 300) {
          failures.push(`${route.board} ${route.qualificationCode} official boundary[${index}] must total 300`);
        }
      }
      if (source === "official" && route.qualificationCode === "6993") {
        if (typeof boundary?.sourceRowId !== "string" || !/^OCR-20\d{2}-JUNE-6993-01$/.test(boundary.sourceRowId)) failures.push("OCR 6993 boundary must identify the official single-paper row");
        if (boundary?.maximumMarkAfterWeighting !== 100) failures.push("OCR 6993 official boundary must total 100");
        if (Object.hasOwn(boundary?.thresholds ?? {}, "A*")) failures.push("OCR 6993 does not award grade A*");
      }
      if (source === "official" && route.qualificationCode === "8MA0") {
        if (boundary?.sourceRowId !== "PEARSON-2025-JUNE-8MA0-OVERALL") failures.push("Pearson 8MA0 boundary must identify the official overall AS row");
        if (boundary?.maximumMarkAfterWeighting !== 160) failures.push("Pearson 8MA0 official boundary must total 160");
        if (Object.hasOwn(boundary?.thresholds ?? {}, "A*")) failures.push("Pearson 8MA0 AS does not award grade A*");
      }
    }
    return keys;
  };

  const officialKeys = auditBoundaries(officialBoundaries, "official", "series");
  const estimatedKeys = auditBoundaries(estimatedBoundaries, "estimated", "targetSeries");
  for (const key of estimatedKeys) {
    if (officialKeys.has(key)) failures.push(`official/estimate exact-key collision "${key}"`);
  }

  for (const [index, boundary] of estimatedBoundaries.entries()) {
    const label = `estimated boundary[${index}]`;
    const route = routeById.get(String(boundary?.routeId ?? ""));
    if (boundary?.source !== "estimated" || boundary?.isOfficial !== false ||
      boundary?.methodVersion !== "historical-weighted-median-v1") {
      failures.push(`${label} must be a non-official historical-weighted-median-v1 estimate`);
    }
    if (!Array.isArray(boundary?.sampleSeries) || boundary.sampleSeries.length < 3 ||
      boundary.sampleSeries.length > 5 || boundary?.sampleSize !== boundary.sampleSeries.length ||
      new Set(boundary.sampleSeries).size !== boundary.sampleSeries.length) {
      failures.push(`${label} must reference 3-5 unique official sample series`);
    }
    if (!LOWERCASE_SHA256.test(boundary?.inputManifestHash ?? "") ||
      !LOWERCASE_SHA256.test(boundary?.contentHash ?? "")) {
      failures.push(`${label} estimate hashes must be 64 lowercase hex characters`);
    } else {
      const { contentHash, ...recordWithoutHash } = boundary;
      if (canonicalHash(recordWithoutHash) !== contentHash) {
        failures.push(`${label} contentHash does not match canonical record content`);
      }
    }
    if (route && boundary?.thresholds && typeof boundary.thresholds === "object") {
      let previous;
      for (const grade of route.grades ?? []) {
        const band = boundary.thresholds[grade];
        const values = band && [band.lower, band.centre, band.upper];
        if (!values || !values.every(Number.isFinite) || band.lower < 0 ||
          band.lower > band.centre || band.centre > band.upper ||
          band.upper > route.maximumMarkAfterWeighting) {
          failures.push(`${label} grade "${grade}" has an invalid estimate band`);
          continue;
        }
        if (previous && (band.lower > previous.lower || band.centre > previous.centre || band.upper > previous.upper)) {
          failures.push(`${label} estimate bands are non-monotonic at grade "${grade}"`);
        }
        previous = band;
      }
      if (!sameJson(Object.keys(boundary.thresholds).sort(), [...(route.grades ?? [])].sort())) {
        failures.push(`${label} grade scale does not match route grades`);
      }
    }
    for (const series of Array.isArray(boundary?.sampleSeries) ? boundary.sampleSeries : []) {
      const sampleKey = exactKey({ ...boundary, series }, "series");
      if (!officialKeys.has(sampleKey)) failures.push(`${label} sample series "${series}" lacks an exact official boundary`);
      if (!(seriesValue(series) < seriesValue(boundary?.targetSeries))) {
        failures.push(`${label} sample series "${series}" is not earlier than its target`);
      }
    }
  }

  if (estimateArtifact !== undefined) {
    if (estimateArtifact?.schemaVersion !== 1) failures.push("estimate artifact schemaVersion must be 1");
    if (!sameJson(estimateArtifact?.boundaries, estimatedBoundaries)) {
      failures.push("estimate artifact boundaries do not match audited estimated boundaries");
    }
    if (!LOWERCASE_SHA256.test(estimateArtifact?.inputManifestHash ?? "") ||
      !LOWERCASE_SHA256.test(estimateArtifact?.contentHash ?? "")) {
      failures.push("estimate artifact hashes must be 64 lowercase hex characters");
    } else {
      if (canonicalHash(estimatedBoundaries) !== estimateArtifact.contentHash) {
        failures.push("estimate artifact contentHash does not match canonical sorted boundaries");
      }
      if (estimatedBoundaries.some(boundary => boundary?.inputManifestHash !== estimateArtifact.inputManifestHash)) {
        failures.push("estimate record inputManifestHash does not match the artifact inputManifestHash");
      }
      if (Array.isArray(estimateTargets)) {
        const normalizedRoutes = routes.map(route => ({
          ...route,
          supportingSources: Array.isArray(route?.supportingSources) ? route.supportingSources : [],
        }));
        const expectedManifestHash = canonicalHash({
          officialBoundaries,
          routes: normalizedRoutes,
          targets: estimateTargets,
        });
        if (expectedManifestHash !== estimateArtifact.inputManifestHash) {
          failures.push("estimate artifact inputManifestHash does not match canonical official inputs, routes, and targets");
        }
      }
    }
  }

  for (const [index, document] of (Array.isArray(sourceManifest?.sourceDocuments) ? sourceManifest.sourceDocuments : []).entries()) {
    if (!LOWERCASE_SHA256.test(document?.sha256 ?? "")) {
      failures.push(`source manifest sourceDocuments[${index}] sha256 must be 64 lowercase hex characters`);
    }
  }

  const manifestHashes = sourceManifest?.normalizedFiles ?? {};
  for (const file of Object.keys(normalizedContentHashes).sort()) {
    if (!Object.hasOwn(manifestHashes, file)) {
      failures.push(`missing normalized-file manifest entry for "${file}"`);
    } else if (manifestHashes[file] !== normalizedContentHashes[file]) {
      failures.push(`normalized-file hash mismatch for "${file}": manifest ${manifestHashes[file]} actual ${normalizedContentHashes[file]}`);
    }
  }

  return failures.sort();
}
