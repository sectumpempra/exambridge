import { describe, expect, it } from "vitest";
import { awardCatalog, createAwardCatalog } from "@/domain-v2/awards/catalog";

const aqaRoute = awardCatalog.getAwardRoute("award:aqa:7357:linear")!;
const aqaBoundary = awardCatalog.officialBoundaries.find(boundary =>
  boundary.routeId === aqaRoute.id && boundary.series === "2025-june"
)!;
const caieRoute = awardCatalog.getAwardRoute("award:caie:9709:2023-2025:al:same-series:AX")!;
const caieBoundary = awardCatalog.officialBoundaries.find(boundary => boundary.routeId === caieRoute.id)!;

const estimate = (overrides: Record<string, unknown> = {}) => ({
  source: "estimated",
  methodVersion: "historical-weighted-median-v1",
  routeId: aqaRoute.id,
  targetSeries: "2026-june",
  componentVariants: ["7357/1", "7357/2", "7357/3"],
  maximumMarkAfterWeighting: 300,
  sampleSeries: ["2022-june", "2023-june", "2024-june"],
  sampleSize: 3,
  thresholds: { A: { centre: 221, lower: 210, upper: 230 } },
  confidence: "low",
  dataAsOf: "2025-08-14",
  inputManifestHash: "a".repeat(64),
  contentHash: "b".repeat(64),
  isOfficial: false,
  ...overrides,
});

const createSingleRouteCatalog = ({
  route = aqaRoute,
  officialBoundaries = [],
  estimatedBoundaries = [],
}: {
  route?: unknown;
  officialBoundaries?: unknown[];
  estimatedBoundaries?: unknown[];
} = {}) => createAwardCatalog({ routes: [route], officialBoundaries, estimatedBoundaries });

describe("Award catalog", () => {
  it("indexes the three first-batch qualifications", () => {
    expect(awardCatalog.listAwardRoutes("7357").map(route => route.id)).toEqual(["award:aqa:7357:linear"]);
    expect(awardCatalog.listAwardRoutes("H240").map(route => route.id)).toEqual(["award:ocr:h240:linear"]);
    expect(awardCatalog.listAwardRoutes("9709").length).toBeGreaterThanOrEqual(2);
  });

  it("finds the exact AQA 2025 overall row", () => {
    expect(awardCatalog.findOfficialBoundary({
      routeId: "award:aqa:7357:linear", series: "2025-june",
      componentVariants: ["7357/1", "7357/2", "7357/3"],
    }))
      .toMatchObject({ maximumMarkAfterWeighting: 300, thresholds: { "A*": 260, A: 221, E: 71 } });
  });

  it("requires CAIE option and variants for an exact match", () => {
    expect(awardCatalog.findOfficialBoundary({
      routeId: "award:caie:9709:2023-2025:al:same-series:AX", series: "2025-june",
    })).toBeUndefined();
  });

  it("rejects an official and estimate exact-key collision before it can be enumerated", () => {
    expect(() => createSingleRouteCatalog({
      officialBoundaries: [aqaBoundary],
      estimatedBoundaries: [estimate({ targetSeries: "2025-june" })],
    })).toThrow(/official\/estimated exact-key collision.*award:aqa:7357:linear\|2025-june/);
  });

  it("rejects duplicate route IDs", () => {
    expect(() => createAwardCatalog({
      routes: [aqaRoute, aqaRoute],
      officialBoundaries: [],
      estimatedBoundaries: [],
    })).toThrow(/duplicate route ID.*award:aqa:7357:linear/);
  });

  it("rejects duplicate official exact keys", () => {
    expect(() => createSingleRouteCatalog({
      officialBoundaries: [aqaBoundary, { ...aqaBoundary }],
    })).toThrow(/duplicate official exact key.*award:aqa:7357:linear\|2025-june/);
  });

  it("rejects duplicate estimated exact keys", () => {
    expect(() => createSingleRouteCatalog({
      estimatedBoundaries: [estimate(), estimate({ contentHash: "c".repeat(64) })],
    })).toThrow(/duplicate estimated exact key.*award:aqa:7357:linear\|2026-june/);
  });

  it.each([
    ["official", [{ ...aqaBoundary, routeId: "award:missing" }], []],
    ["estimated", [], [estimate({ routeId: "award:missing" })]],
  ])("rejects an orphan %s boundary", (source, officialBoundaries, estimatedBoundaries) => {
    expect(() => createSingleRouteCatalog({ officialBoundaries, estimatedBoundaries }))
      .toThrow(new RegExp(`${source} boundary references unknown route.*award:missing`));
  });

  it.each([
    ["official", [{ ...caieBoundary, optionCode: undefined }], []],
    ["estimated", [], [estimate({ optionCode: "AX" })]],
  ])("rejects an %s boundary option present-vs-absent mismatch", (source, officialBoundaries, estimatedBoundaries) => {
    const route = source === "official" ? caieRoute : aqaRoute;
    expect(() => createSingleRouteCatalog({ route, officialBoundaries, estimatedBoundaries }))
      .toThrow(new RegExp(`${source} boundary option code.*does not match route option code`));
  });

  it.each([
    ["missing", ["11", "31", "41"]],
    ["extra", ["11", "31", "41", "51", "61"]],
    ["duplicate", ["11", "31", "41", "51", "51"]],
    ["not normalized", ["9709/11", "9709/31", "9709/41", "9709/51"]],
  ])("rejects CAIE %s component variants", (_case, componentVariants) => {
    expect(() => createSingleRouteCatalog({
      route: caieRoute,
      officialBoundaries: [{ ...caieBoundary, componentVariants }],
    })).toThrow(/official boundary component variants.*do not match route components/);
  });

  it("accepts CAIE printed variants in any order after board-specific normalization", () => {
    const catalog = createSingleRouteCatalog({
      route: caieRoute,
      officialBoundaries: [{ ...caieBoundary, componentVariants: ["51", "11", "41", "31"] }],
    });
    expect(catalog.findOfficialBoundary({
      routeId: caieRoute.id,
      series: "2025-june",
      optionCode: "AX",
      componentVariants: ["31", "41", "51", "11"],
    })).toBeDefined();
  });

  it.each([
    ["official", [{ ...aqaBoundary, maximumMarkAfterWeighting: 299 }], []],
    ["estimated", [], [estimate({ maximumMarkAfterWeighting: 299 })]],
  ])("rejects an %s boundary maximum mismatch", (source, officialBoundaries, estimatedBoundaries) => {
    expect(() => createSingleRouteCatalog({ officialBoundaries, estimatedBoundaries }))
      .toThrow(new RegExp(`${source} boundary maximumMarkAfterWeighting 299 does not match route maximum 300`));
  });

  it("keeps both strict CAIE provenance inputs directly reachable from every route", () => {
    const caieRoutes = awardCatalog.listAwardRoutes("9709");
    expect(caieRoutes).toHaveLength(3);
    for (const route of caieRoutes) {
      expect(route).toMatchObject({
        sourceUrl: "https://www.cambridgeinternational.org/Images/597421-2023-2025-syllabus.pdf",
        publishedAt: "2020-09",
        accessedAt: "2026-07-13",
        sourceDocumentHash: "3a7a37692399f47ff5e0d94cc41f9dd33d3b99467ce83aa4bad28c6136f96256",
        supportingSources: [{
          sourceUrl: "https://www.cambridgeinternational.org/Images/740340-mathematics-9709-june-2025-grade-threshold-table.pdf",
          publishedAt: "2025-08-12",
          accessedAt: "2026-07-13",
          sourceRowId: expect.stringMatching(/^CAIE-9709-2025-JUNE-P2-ROW-(S1|AX|DX)$/),
          sourceDocumentHash: "97d20864ca653e7a772eddc9950ecc1dc55b2ed6e506d72f181786707bd025c3",
        }],
      });
      expect(route.sourceRowId).toMatch(/^CAIE-9709-SYLLABUS-2023-2025-/);
    }
  });

  it("still constructs the unchanged built-in catalog", () => {
    expect(() => createAwardCatalog({
      routes: awardCatalog.routes,
      officialBoundaries: awardCatalog.officialBoundaries,
      estimatedBoundaries: awardCatalog.estimatedBoundaries,
    })).not.toThrow();
  });
});
