import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditAwardData } from "../scripts/audit-awards.mjs";
import routesJson from "@/data/official/awards/routes.json";
import aqaJson from "@/data/official/awards/aqa-7357.json";
import ocrJson from "@/data/official/awards/ocr-h240.json";
import ocr6993Json from "@/data/official/awards/ocr-6993.json";
import caieJson from "@/data/official/awards/caie-9709.json";
import pearson8ma0Json from "@/data/official/awards/pearson-8ma0.json";
import sourceManifestJson from "@/data/official/awards/source-manifest.json";
import estimatesJson from "../generated/estimates/award-boundaries-v1.json";

type MutableSource = Record<string, unknown> & {
  sourceUrl?: string;
  publishedAt?: string;
  accessedAt?: string;
  sourceRowId?: string;
  sourceDocumentHash?: string;
};

type MutableRoute = MutableSource & {
  id?: string;
  board?: string;
  qualificationCode?: string;
  level?: string;
  specificationVersion?: string;
  routeType?: string;
  routeKey?: string;
  optionCode?: string;
  components?: Array<Record<string, unknown> & {
    code?: string;
    inputKind?: string;
    maxRawMark?: number;
    weightingFactor?: number;
  }>;
  maximumMarkAfterWeighting?: number;
  roundingRule?: string;
  grades?: string[];
  supportingSources?: MutableSource[];
};

type MutableBoundary = MutableSource & {
  routeId?: string;
  series?: string;
  targetSeries?: string;
  optionCode?: string;
  componentVariants?: string[];
  maximumMarkAfterWeighting?: number;
};

type AuditFixture = {
  routes: MutableRoute[];
  officialBoundaries: MutableBoundary[];
  estimatedBoundaries: MutableBoundary[];
  sourceManifest: Record<string, unknown> & {
    sourceDocuments: Array<Record<string, unknown> & { sha256?: string }>;
    normalizedFiles: Record<string, string>;
  };
  normalizedContentHashes: Record<string, string>;
};

const awardFiles = [
  "src/data/official/awards/routes.json",
  "src/data/official/awards/aqa-7357.json",
  "src/data/official/awards/ocr-h240.json",
  "src/data/official/awards/ocr-6993.json",
  "src/data/official/awards/pearson-8ma0.json",
  "src/data/official/awards/caie-9709.json",
];

const normalizedContentHashes: Record<string, string> = Object.fromEntries(awardFiles.map(file => [
  file,
  createHash("sha256").update(readFileSync(join(process.cwd(), file))).digest("hex"),
]));

const realData: AuditFixture = {
  routes: routesJson.routes,
  officialBoundaries: [...aqaJson.boundaries, ...ocrJson.boundaries, ...ocr6993Json.boundaries, ...pearson8ma0Json.boundaries, ...caieJson.boundaries],
  estimatedBoundaries: estimatesJson.boundaries,
  sourceManifest: sourceManifestJson,
  normalizedContentHashes,
};

const audit = (mutate?: (data: AuditFixture) => void) => {
  const data = structuredClone(realData);
  mutate?.(data);
  return auditAwardData(data);
};

const aqaBoundaryIndex = 0;
const caieBoundaryIndex = aqaJson.boundaries.length + ocrJson.boundaries.length + ocr6993Json.boundaries.length + pearson8ma0Json.boundaries.length;
const caieRouteIndex = routesJson.routes.findIndex(route => route.board === "CAIE");

describe("Award data audit", () => {
  it("accepts the committed raw Award data and normalized-file hashes", () => {
    expect(audit()).toEqual([]);
  });

  it("rejects coordinated CAIE route and boundary component corruption", () => {
    expect(audit(data => {
      const route = data.routes.find(candidate => candidate.id?.endsWith(":AX"))!;
      const boundary = data.officialBoundaries.find(candidate => candidate.routeId === route.id)!;
      route.components!.find(component => component.code === "9709/41")!.code = "9709/61";
      boundary.componentVariants = boundary.componentVariants!.map(variant => variant === "41" ? "61" : variant);
    })).toEqual(expect.arrayContaining([expect.stringMatching(/route semantic mismatch.*AX.*components/i)]));
  });

  it("rejects staged component 84 changing from carried-forward to raw", () => {
    expect(audit(data => {
      const route = data.routes.find(candidate => candidate.id?.endsWith(":DX"))!;
      route.components!.find(component => component.code === "9709/84")!.inputKind = "raw";
    })).toEqual(expect.arrayContaining([expect.stringMatching(/route semantic mismatch.*DX.*components/i)]));
  });

  it("rejects DX rounding drift", () => {
    expect(audit(data => {
      data.routes.find(candidate => candidate.id?.endsWith(":DX"))!.roundingRule = "none";
    })).toEqual(expect.arrayContaining([expect.stringMatching(/route semantic mismatch.*DX.*roundingRule/i)]));
  });

  it("rejects a missing expected route even when its boundary is also removed", () => {
    expect(audit(data => {
      const missingId = "award:caie:9709:2023-2025:as:S1";
      data.routes = data.routes.filter(route => route.id !== missingId);
      data.officialBoundaries = data.officialBoundaries.filter(boundary => boundary.routeId !== missingId);
    })).toEqual(expect.arrayContaining([expect.stringMatching(/missing expected route.*:S1/i)]));
  });

  it("rejects an extra invented CAIE route and matching boundary", () => {
    expect(audit(data => {
      const route = structuredClone(data.routes.find(candidate => candidate.id?.endsWith(":AX"))!);
      route.id = "award:caie:9709:2026-2027:al:same-series:ZZ";
      route.specificationVersion = "9709-2026-2027";
      route.optionCode = "ZZ";
      route.supportingSources![0].sourceRowId = "CAIE-9709-2026-JUNE-P2-ROW-ZZ";
      data.routes.push(route);

      const boundary = structuredClone(data.officialBoundaries.find(candidate => candidate.routeId?.endsWith(":AX"))!);
      boundary.routeId = route.id;
      boundary.optionCode = "ZZ";
      boundary.sourceRowId = "CAIE-9709-2026-JUNE-P2-ROW-ZZ";
      data.officialBoundaries.push(boundary);
    })).toEqual(expect.arrayContaining([expect.stringMatching(/unsupported extra route.*:ZZ/i)]));
  });

  it("rejects AQA qualification semantic drift", () => {
    expect(audit(data => {
      data.routes.find(candidate => candidate.board === "AQA")!.qualificationCode = "7358";
    })).toEqual(expect.arrayContaining([expect.stringMatching(/route semantic mismatch.*aqa.*qualificationCode/i)]));
  });

  it.each([
    ["route IDs", (data: typeof realData) => data.routes.push(structuredClone(data.routes[0]))],
    ["official exact keys", (data: typeof realData) => data.officialBoundaries.push(structuredClone(data.officialBoundaries[0]))],
    ["estimated exact keys", (data: typeof realData) => {
      const estimate = {
        source: "estimated", routeId: data.routes[0].id, targetSeries: "2026-june",
        componentVariants: ["7357/1", "7357/2", "7357/3"], maximumMarkAfterWeighting: 300,
      };
      data.estimatedBoundaries.push(estimate, structuredClone(estimate));
    }],
  ])("reports duplicate %s", (_label, mutate) => {
    expect(audit(mutate as never)).toEqual(expect.arrayContaining([expect.stringMatching(/duplicate/i)]));
  });

  it("reports an orphan official boundary", () => {
    expect(audit(data => { data.officialBoundaries[aqaBoundaryIndex].routeId = "award:missing"; }))
      .toEqual(expect.arrayContaining([expect.stringMatching(/unknown route.*award:missing/i)]));
  });

  it("reports an exact option mismatch", () => {
    expect(audit(data => { data.officialBoundaries[caieBoundaryIndex].optionCode = "DX"; }))
      .toEqual(expect.arrayContaining([expect.stringMatching(/option code.*does not match/i)]));
  });

  it.each([
    ["CAIE printed suffix variants", caieBoundaryIndex, ["9709/11", "9709/31", "9709/41", "9709/51"]],
    ["AQA full component codes", aqaBoundaryIndex, ["1", "2", "3"]],
  ])("enforces board-specific component normalization for %s", (_label, boundaryIndex, variants) => {
    expect(audit(data => { data.officialBoundaries[boundaryIndex].componentVariants = variants; }))
      .toEqual(expect.arrayContaining([expect.stringMatching(/component variants.*do not match/i)]));
  });

  it("reports missing, extra, and duplicate component variants", () => {
    for (const variants of [["11", "31", "41"], ["11", "31", "41", "51", "61"], ["11", "31", "41", "51", "51"]]) {
      expect(audit(data => { data.officialBoundaries[caieBoundaryIndex].componentVariants = variants; }))
        .toEqual(expect.arrayContaining([expect.stringMatching(/component variants.*do not match/i)]));
    }
  });

  it("reports a route/boundary maximum mismatch", () => {
    expect(audit(data => { data.officialBoundaries[aqaBoundaryIndex].maximumMarkAfterWeighting = 299; }))
      .toEqual(expect.arrayContaining([expect.stringMatching(/maximum.*299.*route maximum 300/i)]));
  });

  it("reports an exact official/estimate target collision", () => {
    expect(audit(data => {
      const boundary = data.officialBoundaries[aqaBoundaryIndex];
      data.estimatedBoundaries.push({
        source: "estimated",
        routeId: boundary.routeId,
        targetSeries: boundary.series,
        componentVariants: [...(boundary.componentVariants ?? [])],
        maximumMarkAfterWeighting: boundary.maximumMarkAfterWeighting,
      });
    })).toEqual(expect.arrayContaining([expect.stringMatching(/official\/estimate.*collision/i)]));
  });

  it.each([
    ["route", (data: typeof realData) => { data.routes[0].sourceDocumentHash = "ABC"; }],
    ["supporting route source", (data: typeof realData) => { delete data.routes[caieRouteIndex].supportingSources?.[0].publishedAt; }],
    ["official boundary", (data: typeof realData) => { delete data.officialBoundaries[0].sourceRowId; }],
  ])("reports invalid or missing provenance on a %s", (_label, mutate) => {
    expect(audit(mutate as never)).toEqual(expect.arrayContaining([expect.stringMatching(/source(DocumentHash| field|RowId| publishedAt)/i)]));
  });

  it("requires a CAIE threshold support row for the route's exact option", () => {
    expect(audit(data => {
      data.routes[caieRouteIndex].supportingSources![0].sourceRowId = "CAIE-9709-2025-JUNE-P2-ROW-NOT-S1";
    })).toEqual(expect.arrayContaining([expect.stringMatching(/supporting threshold.*S1/i)]));
  });

  it.each([
    ["AQA", aqaBoundaryIndex],
    ["OCR", aqaJson.boundaries.length],
  ])("requires %s qualification-level OVERALL rows totaling 300", (_board, boundaryIndex) => {
    expect(audit(data => {
      data.officialBoundaries[boundaryIndex].sourceRowId = "COMPONENT-ROW";
      data.officialBoundaries[boundaryIndex].maximumMarkAfterWeighting = 100;
    })).toEqual(expect.arrayContaining([
      expect.stringMatching(/OVERALL/),
      expect.stringMatching(/total 300/),
    ]));
  });

  it("reports a normalized-file manifest content-hash mismatch", () => {
    expect(audit(data => {
      data.normalizedContentHashes[awardFiles[0]] = "0".repeat(64);
    })).toEqual(expect.arrayContaining([expect.stringMatching(/normalized-file hash mismatch.*routes\.json/i)]));
  });

  it("reports a missing normalized-file manifest entry", () => {
    expect(audit(data => {
      delete data.sourceManifest.normalizedFiles[awardFiles[0]];
    })).toEqual(expect.arrayContaining([expect.stringMatching(/missing normalized-file manifest entry.*routes\.json/i)]));
  });

  it("writes the required zero-failure Award summary through the real audit script", () => {
    execFileSync(process.execPath, ["scripts/audit-data.mjs"], { cwd: process.cwd(), stdio: "pipe" });
    const report = JSON.parse(readFileSync(join(process.cwd(), "generated/data-quality-report.json"), "utf8"));

    expect(report.awards).toEqual({
      routeCount: 7,
      officialBoundaryCount: 25,
      estimatedBoundaryCount: 2,
      failureCount: 0,
      failures: [],
      officialContentHashes: normalizedContentHashes,
    });
  });
});
