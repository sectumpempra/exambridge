import { describe, expect, it } from "vitest";
import {
  parseRaw as parseCaie,
  normalizeRecords as normalizeCaie,
  buildCAIE9709Catalog,
} from "@/adapters-v2/legacy-data/caie-9709-etl";
import {
  parseRaw as parsePearson,
  normalizeRecords as normalizePearson,
  buildYMA01Catalog,
} from "@/adapters-v2/legacy-data/yma01-etl";

describe("CAIE ETL defensive branches", () => {
  it("filters unrelated and malformed rows while preserving explicit nulls", () => {
    const result = parseCaie([
      null,
      {},
      { SubjectCode: "9231", Component: "11" },
      { SubjectCode: "9709", Component: "99" },
      { SubjectCode: "9709", Component: "11" },
      { SubjectCode: "9709", Subject: "Math", Series: "june-2025", Component: "12", MaxRawMark: "75", A: "60", B: "50", C: "40", D: "30", E: "20" },
    ]);
    expect(result.errors).toHaveLength(2);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].MaxRawMark).toBeNull();
    expect(result.records[1].A).toBe(60);
  });

  it("handles missing metadata in normalization", () => {
    const parsed = parseCaie([{ SubjectCode: "9709", Component: "11", MaxRawMark: 75 }]).records;
    const invalid = { ...parsed[0], Component: "99" };
    const normalized = normalizeCaie([...parsed, invalid]);
    expect(normalized.paperNums).toEqual(new Set([1]));
  });

  it("reports missing marks, duplicates and non-monotonic boundaries", () => {
    const base = { SubjectCode: "9709", Subject: "Math", Series: "june-2025" };
    const result = buildCAIE9709Catalog([
      { ...base, Component: "11", MaxRawMark: 75, A: 60, B: 50, C: 40, D: 30, E: 20 },
      { ...base, Component: "11", MaxRawMark: 75, A: 60, B: 50, C: 40, D: 30, E: 20 },
      { ...base, Component: "12", MaxRawMark: null, A: null, B: null, C: null, D: null, E: null },
      { ...base, Component: "31", MaxRawMark: 75, A: 50, B: 60, C: null, D: null, E: null },
      { ...base, Component: "51", MaxRawMark: 50, A: 40, B: 30, C: 20, D: 10, E: 5 },
      { ...base, Component: "52", MaxRawMark: 60, A: 45, B: 35, C: 25, D: 15, E: 5 },
      { ...base, Component: "52", MaxRawMark: 60, A: 45, B: 35, C: 25, D: 15, E: 5 },
    ]);
    expect(result.warnings.some((warning) => warning.code === "MISSING_MAX_MARK")).toBe(true);
    expect(result.errors.some((error) => error.code === "NON_MONOTONIC")).toBe(true);
    expect(result.catalogPartial.units.map((unit) => unit.stage)).toEqual(expect.arrayContaining(["AS", "A2"]));
  });

  it("builds a structurally explicit empty catalog", () => {
    const result = buildCAIE9709Catalog([]);
    expect(result.catalogPartial.units).toEqual([]);
    expect(result.catalogPartial.routes).toHaveLength(2);
  });
});

describe("Pearson ETL defensive branches", () => {
  it("filters malformed and unrelated rows and parses optional thresholds", () => {
    const result = parsePearson([
      null,
      {},
      { code: "WPH11" },
      { code: "WMA99", year: "2025", session: "June", max_mark: "75" },
      { code: "WMA11" },
      { code: "WME01", year: 2025, session: "June", unit: "M1", max_mark: "75", a_star: "70", a: "60", b: "50", c: "40", d: "30", e: "20", u: 0 },
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.records).toHaveLength(3);
    expect(result.records[1].a).toBeUndefined();
    expect(result.records[2].a_star).toBe(70);
  });

  it("skips unknown metadata during normalization", () => {
    const records = parsePearson([{ code: "WMA99" }, { code: "WMA11" }]).records;
    expect(normalizePearson(records).unitCodes).toEqual(new Set(["WMA11"]));
  });

  it("reports missing units, duplicates and non-monotonic boundaries", () => {
    const base = { year: "2025", session: "June", unit: "Math", max_mark: 75 };
    const result = buildYMA01Catalog([
      { ...base, code: "WMA11", a: 60, b: 50, c: 40, d: 30, e: 20 },
      { ...base, code: "WMA11", a: 60, b: 50, c: 40, d: 30, e: 20 },
      { ...base, code: "WMA12", a: 50, b: 60, c: 0, d: 0, e: 0 },
      { ...base, code: "WME01", a: 60, b: 50, c: 40, d: 30, e: 20 },
      { ...base, code: "WMA01", max_mark: 125, a: 100, b: 80, c: 60, d: 40, e: 20 },
    ]);
    expect(result.warnings.some((warning) => warning.code === "MISSING_UNIT_DATA")).toBe(true);
    expect(result.warnings.some((warning) => warning.code === "DUPLICATE_BOUNDARY")).toBe(true);
    expect(result.errors.some((error) => error.code === "NON_MONOTONIC_BOUNDARY")).toBe(true);
    expect(result.catalog.units.some((unit) => unit.specificationId.includes("old-spec"))).toBe(true);
  });

  it("keeps parse errors singular and produces an empty-unit catalog", () => {
    const result = buildYMA01Catalog([null]);
    expect(result.errors.filter((error) => error.code === "PARSE_ERROR")).toHaveLength(1);
    expect(result.catalog.units).toEqual([]);
  });
});
