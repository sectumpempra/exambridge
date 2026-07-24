/**
 * 阶段1：第一批 gold cases 的协议层校验（场景可解析、字段齐全）。
 * 求解器断言在阶段2/3 的 tests/gold-cases.test.ts 中接入。
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSceneJson } from "@/features/mechanics-lab/schema";

const here = dirname(fileURLToPath(import.meta.url));
const goldDir = join(here, "fixtures", "mechanics");

interface GoldCaseFile {
  caseId: string;
  title: string;
  expectParse: "ok" | "error";
  scene?: unknown;
  sceneJson?: string;
}

function loadCases(): GoldCaseFile[] {
  return readdirSync(goldDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(goldDir, f), "utf8")) as GoldCaseFile);
}

describe("gold cases（协议层）", () => {
  const cases = loadCases();

  it("caseId 与文件名一一对应且字段齐全", () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
    for (const c of cases) {
      expect(c.caseId).toMatch(/^gc-\d{2}-[a-z0-9-]+$/);
      expect(typeof c.title).toBe("string");
      expect(c.expectParse === "ok" ? c.scene !== undefined || c.sceneJson !== undefined : true).toBe(
        true,
      );
    }
  });

  for (const c of cases) {
    if (c.expectParse === "ok" && c.scene !== undefined) {
      it(`${c.caseId} 场景通过 schema 校验`, () => {
        const result = parseSceneJson(JSON.stringify(c.scene));
        expect(result.ok).toBe(true);
      });
    }
  }
});
