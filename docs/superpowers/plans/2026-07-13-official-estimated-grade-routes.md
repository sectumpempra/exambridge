# ExamBridge Official and Estimated Grade Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AQA A-Level Mathematics 7357、OCR A-Level Mathematics A H240 与 CAIE AS & A-Level Mathematics 9709 建立可审计的官方整体等级计算，并在目标考季尚未发布整体边界时提供严格隔离、明确标注、可复现的非官方统计预估。

**Architecture:** 新增独立的 `domain-v2/awards` 纵向模块，官方路线、官方整体边界、预估边界分别采用不同 schema、目录和查询接口；现有 Edexcel IAL UMS 引擎保持不变。构建时先生成确定性的预估产物，再执行统一数据审计；页面通过薄适配层选择旧 Edexcel 流程或新 Award 流程，任何官方记录存在时都禁止对应预估进入页面索引。

**Tech Stack:** TypeScript 5.9、React 19、Zod 4、Vitest 4、Playwright 1.61、Axe、Vinext/Vite、静态 JSON、`write-excel-file`、Node.js 22 构建脚本。

## Global Constraints

- 首批范围严格限定为 AQA 7357、OCR H240、CAIE 9709；不实现 GCSE、物理、化学或其他课程。
- 不改变 Edexcel IAL Mathematics 现有已验证 Raw→UMS 路线。
- 官方整体边界和预估边界不得放入同一数据文件或使用隐式 fallback。
- AQA/OCR 只能使用 qualification-level/Overall 边界，不能累计单卷 notional/component boundaries。
- CAIE 必须精确匹配 level、route、option code、component variants、满分与舍入规则；staged 路线不得把上一考季 Paper 原始分当作 carried-forward mark。
- 预估只允许使用最近 3–5 个完全可比的官方整体边界样本；不得使用 component boundary、Paper grade、PUM 或预估样本。
- 预估算法固定为 `historical-weighted-median-v1`，结果必须由输入清单哈希确定性生成。
- 目标 route/series/option 已有官方边界时，不生成、不索引、不展示对应预估。
- 页面、分享 URL、CSV、Excel、打印和截图必须保留“非官方预估”、置信度、样本考季与算法版本。
- 输入、URL 与 localStorage 均使用 Zod 校验；拒绝负分、超分、NaN、Infinity、缺卷、重复卷和跨考季。
- 新 Award 核心模块行覆盖率至少 95%、分支覆盖率至少 90%；Axe 不得出现 serious/critical 问题。
- 所有新增官方数据必须具备来源 URL、发布日期、访问日期、原始页/行标识与内容哈希；考试数据继续受 `DATA_RIGHTS.md` 单独声明约束。
- 只在功能分支开发，先发布私有 Sites 灰度；GitHub、Sites 归档和部署必须对应同一提交 SHA。

---

## File Structure

### 新建文件

- `src/domain-v2/awards/schema.ts`：官方路线、官方边界、预估边界、输入、结果与能力状态的唯一 Zod/TypeScript 契约。
- `src/domain-v2/awards/catalog.ts`：分别索引官方与预估数据，执行精确 route/series/option/variant 查询并实现官方优先规则。
- `src/domain-v2/awards/official-engine.ts`：AQA/OCR 线性合分与 CAIE option/weight/carry-forward 的纯函数官方计算器。
- `src/domain-v2/awards/weighted-quantile.ts`：确定性的加权分位数算法。
- `src/domain-v2/awards/estimate-core.ts`：Node 构建脚本与浏览器共用的历史样本筛选、边界生成和置信度算法。
- `src/domain-v2/awards/estimate-engine.ts`：只负责把用户总分映射到构建生成的预估边界与等级范围。
- `src/domain-v2/awards/share-state.ts`：版本化、限长、可升级的计算器分享状态。
- `src/domain-v2/awards/index.ts`：Award 模块的受控公开接口。
- `src/data/official/awards/routes.json`：三个首批资格的已核验 route 与组件规则。
- `src/data/official/awards/aqa-7357.json`：仅保存 AQA 7357 qualification-level Overall 边界。
- `src/data/official/awards/ocr-h240.json`：仅保存 OCR H240 Overall 边界。
- `src/data/official/awards/caie-9709.json`：保存 CAIE 9709 option-level 整体 thresholds 与精确 component variants。
- `src/data/official/awards/source-manifest.json`：锁定来源文档 SHA-256、规范化文件 SHA-256 与访问日期，供构建审计检测未同步的数据变化。
- `generated/estimates/award-boundaries-v1.json`：构建生成、与官方目录隔离的预估产物。
- `scripts/build-award-estimates.mjs`：读取官方边界、生成预估、写入输入哈希与内容哈希。
- `src/pages/grade-calculator/AwardCalculatorPanel.tsx`：新路线的选择、输入和免责声明交互。
- `src/pages/grade-calculator/AwardResultCard.tsx`：官方/预估结果的互斥视觉呈现。
- `src/pages/grade-calculator/exportAwardResult.ts`：共享同一行模型的 CSV/Excel 导出。
- `tests/award-schema.test.ts`：schema、安全输入与非法数据测试。
- `tests/award-catalog.test.ts`：查询精确性、官方优先和能力状态测试。
- `tests/award-official-engine.test.ts`：AQA/OCR/CAIE 官方计算、边界值与错误路线测试。
- `tests/award-estimate-engine.test.ts`：加权分位数、置信度、拒绝条件与确定性测试。
- `tests/award-share-export.test.ts`：分享状态、升级和导出标识测试。

### 修改文件

- `src/pages/GradeCalculator.tsx`：保留 Edexcel IAL 流程，将 AQA/OCR/CAIE 委托给 `AwardCalculatorPanel`。
- `src/course-context/types.ts`：增加独立的 `GradeCalculationAvailability`，不提升现有 verification 状态。
- `src/course-context/catalog-source.ts`：由 Award catalog 派生三门课程的 official/estimated/unavailable 能力。
- `src/course-context/catalog.ts`：保留生成目录兼容性并解析新能力元数据。
- `src/course-context/audit.ts`：校验课程能力声明与 Award route 一致。
- `scripts/audit-data.mjs`：增加官方路线、整体边界、预估边界和官方覆盖优先审计。
- `package.json`：将预估生成器加入 build/data/check 链路。
- `vitest.config.ts`：为 `src/domain-v2/awards/**` 设置 95%/90% 覆盖门槛。
- `e2e/routes.spec.ts`：增加三个考试局、预估确认、分享恢复、键盘与 375px 回归。
- `README.md`、`DATA_SOURCES.md`、`DATA_RIGHTS.md`：记录算法边界、官方来源和数据权利。

---

### Task 1: Lock the Award Domain Contracts

**Files:**
- Create: `src/domain-v2/awards/schema.ts`
- Create: `src/domain-v2/awards/index.ts`
- Create: `tests/award-schema.test.ts`

**Interfaces:**
- Consumes: `z` from `zod`.
- Produces: `OfficialAwardRouteSchema`, `OfficialAwardBoundarySchema`, `EstimatedAwardBoundarySchema`, `AwardCalculationInputSchema`, `AwardCalculationResultSchema`, `GradeCalculationAvailabilitySchema` and their inferred types.

- [ ] **Step 1: Write failing schema tests**

```ts
// tests/award-schema.test.ts
import { describe, expect, it } from "vitest";
import {
  AwardCalculationInputSchema,
  EstimatedAwardBoundarySchema,
  OfficialAwardBoundarySchema,
  OfficialAwardRouteSchema,
} from "@/domain-v2/awards/schema";

const source = {
  sourceUrl: "https://www.aqa.org.uk/exams-administration/results-days/grade-boundaries",
  publishedAt: "2025-08-14",
  accessedAt: "2026-07-13",
};

describe("Award domain schemas", () => {
  it("accepts a verified AQA linear route", () => {
    const parsed = OfficialAwardRouteSchema.parse({
      id: "award:aqa:7357:linear",
      board: "AQA",
      qualificationCode: "7357",
      level: "A-Level",
      specificationVersion: "7357-2017",
      routeType: "linear",
      routeKey: "7357-linear",
      components: ["7357/1", "7357/2", "7357/3"].map(code => ({
        code, inputKind: "raw", maxRawMark: 100, weightingFactor: 1,
      })),
      maximumMarkAfterWeighting: 300,
      roundingRule: "none",
      grades: ["A*", "A", "B", "C", "D", "E"],
      sourceUrl: "https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-7357-SP-2017.PDF",
      accessedAt: "2026-07-13",
      verificationStatus: "verified",
    });
    expect(parsed.components).toHaveLength(3);
  });

  it("rejects a non-monotonic official boundary", () => {
    expect(() => OfficialAwardBoundarySchema.parse({
      source: "official",
      routeId: "award:aqa:7357:linear",
      series: "2025-june",
      componentVariants: ["7357/1", "7357/2", "7357/3"],
      maximumMarkAfterWeighting: 300,
      thresholds: { "A*": 260, A: 221, B: 230, C: 145, D: 108, E: 71 },
      ...source,
      sourceRowId: "AQA-2025-JUNE-7357-OVERALL",
      verificationStatus: "verified",
    })).toThrow();
  });

  it("rejects estimated records with fewer than three samples", () => {
    expect(() => EstimatedAwardBoundarySchema.parse({
      source: "estimated",
      methodVersion: "historical-weighted-median-v1",
      routeId: "award:aqa:7357:linear",
      targetSeries: "2026-june",
      componentVariants: ["7357/1", "7357/2", "7357/3"],
      maximumMarkAfterWeighting: 300,
      sampleSeries: ["2025-june", "2024-june"],
      sampleSize: 2,
      thresholds: { A: { centre: 221, lower: 220, upper: 223 } },
      confidence: "medium",
      dataAsOf: "2025-08-14",
      inputManifestHash: "a".repeat(64),
      contentHash: "b".repeat(64),
      isOfficial: false,
    })).toThrow();
  });

  it.each([NaN, Infinity, -1])("rejects unsafe raw score %s", rawScore => {
    expect(() => AwardCalculationInputSchema.parse({
      routeId: "award:aqa:7357:linear",
      series: "2025-june",
      scores: [{ componentCode: "7357/1", series: "2025-june", rawScore }],
      estimateConsent: false,
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `pnpm vitest run tests/award-schema.test.ts`

Expected: FAIL because `@/domain-v2/awards/schema` does not exist.

- [ ] **Step 3: Implement the domain schemas with cross-field validation**

```ts
// src/domain-v2/awards/schema.ts
import { z } from "zod";

const GradeSchema = z.enum(["A*", "A", "B", "C", "D", "E", "a", "b", "c", "d", "e"]);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);

const thresholdsAreValid = (thresholds: Record<string, number>, max: number) => {
  const values = Object.values(thresholds);
  return values.length > 0 && values.every(Number.isFinite) &&
    values.every(value => value >= 0 && value <= max) &&
    values.every((value, index) => index === 0 || value <= values[index - 1]);
};

export const AwardComponentSchema = z.object({
  code: z.string().min(1),
  inputKind: z.enum(["raw", "carried-forward"]),
  maxRawMark: z.number().positive(),
  weightingFactor: z.number().positive(),
});

export const OfficialAwardRouteSchema = z.object({
  id: z.string().min(1),
  board: z.enum(["AQA", "OCR", "CAIE"]),
  qualificationCode: z.enum(["7357", "H240", "9709"]),
  level: z.enum(["A-Level", "AS-Level"]),
  specificationVersion: z.string().min(1),
  routeType: z.enum(["linear", "same-series", "staged"]),
  routeKey: z.string().min(1),
  optionCode: z.string().min(1).optional(),
  components: z.array(AwardComponentSchema).min(1),
  maximumMarkAfterWeighting: z.number().positive(),
  roundingRule: z.enum(["none", "nearest-integer", "official-carry-forward"]),
  grades: z.array(GradeSchema).min(1),
  sourceUrl: z.string().url(),
  publishedAt: z.string().min(1).optional(),
  accessedAt: z.string().min(1),
  verificationStatus: z.literal("verified"),
});

export const OfficialAwardBoundarySchema = z.object({
  source: z.literal("official"),
  routeId: z.string().min(1),
  series: z.string().regex(/^\d{4}-(march|june|november)$/),
  optionCode: z.string().min(1).optional(),
  componentVariants: z.array(z.string().min(1)).min(1),
  maximumMarkAfterWeighting: z.number().positive(),
  thresholds: z.record(z.string(), z.number()),
  sourceUrl: z.string().url(),
  sourceRowId: z.string().min(1),
  publishedAt: z.string().min(1),
  accessedAt: z.string().min(1),
  verificationStatus: z.literal("verified"),
}).superRefine((value, ctx) => {
  if (!thresholdsAreValid(value.thresholds, value.maximumMarkAfterWeighting)) {
    ctx.addIssue({ code: "custom", path: ["thresholds"], message: "Thresholds must be monotonic and within the maximum mark" });
  }
});

const EstimateBandSchema = z.object({
  centre: z.number().nonnegative(), lower: z.number().nonnegative(), upper: z.number().nonnegative(),
}).refine(value => value.lower <= value.centre && value.centre <= value.upper, "Estimate band must contain its centre");

export const EstimatedAwardBoundarySchema = z.object({
  source: z.literal("estimated"),
  methodVersion: z.literal("historical-weighted-median-v1"),
  routeId: z.string().min(1),
  targetSeries: z.string().regex(/^\d{4}-(march|june|november)$/),
  optionCode: z.string().min(1).optional(),
  componentVariants: z.array(z.string().min(1)).min(1),
  maximumMarkAfterWeighting: z.number().positive(),
  sampleSeries: z.array(z.string()).min(3).max(5),
  sampleSize: z.number().int().min(3).max(5),
  thresholds: z.record(z.string(), EstimateBandSchema),
  confidence: z.enum(["high", "medium", "low"]),
  dataAsOf: z.string().min(1),
  inputManifestHash: HashSchema,
  contentHash: HashSchema,
  isOfficial: z.literal(false),
}).refine(value => value.sampleSize === value.sampleSeries.length, "Sample size must match sample series")
  .superRefine((value, ctx) => {
    const bands = Object.values(value.thresholds);
    const inRange = bands.every(band => band.upper <= value.maximumMarkAfterWeighting);
    const monotonic = bands.every((band, index) => index === 0 ||
      band.centre <= bands[index - 1].centre && band.lower <= bands[index - 1].lower && band.upper <= bands[index - 1].upper);
    if (!inRange || !monotonic) ctx.addIssue({
      code: "custom", path: ["thresholds"], message: "Estimate bands must be monotonic and within the maximum mark",
    });
  });

export const AwardScoreInputSchema = z.object({
  componentCode: z.string().min(1),
  variant: z.string().min(1).optional(),
  series: z.string().regex(/^\d{4}-(march|june|november)$/),
  rawScore: z.number().finite().nonnegative(),
});

export const AwardCalculationInputSchema = z.object({
  routeId: z.string().min(1),
  series: z.string().regex(/^\d{4}-(march|june|november)$/),
  optionCode: z.string().min(1).optional(),
  scores: z.array(AwardScoreInputSchema).min(1),
  estimateConsent: z.boolean(),
});

export const AwardCalculationResultSchema = z.object({
  source: z.enum(["official", "estimated"]),
  routeId: z.string(), series: z.string(), optionCode: z.string().optional(),
  total: z.number(), maximumMarkAfterWeighting: z.number().positive(),
  grade: z.string(), gradeRange: z.tuple([z.string(), z.string()]).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  sampleSeries: z.array(z.string()).optional(), methodVersion: z.string().optional(),
  warning: z.string().optional(), sourceUrls: z.array(z.string().url()),
});

export const GradeCalculationAvailabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("official"), routeIds: z.array(z.string()).min(1) }),
  z.object({ status: z.literal("estimated"), routeIds: z.array(z.string()).min(1), disclaimerRequired: z.literal(true) }),
  z.object({ status: z.literal("unavailable"), reason: z.string().min(1) }),
]);

export type OfficialAwardRoute = z.infer<typeof OfficialAwardRouteSchema>;
export type OfficialAwardBoundary = z.infer<typeof OfficialAwardBoundarySchema>;
export type EstimatedAwardBoundary = z.infer<typeof EstimatedAwardBoundarySchema>;
export type AwardCalculationInput = z.infer<typeof AwardCalculationInputSchema>;
export type AwardCalculationResult = z.infer<typeof AwardCalculationResultSchema>;
export type GradeCalculationAvailability = z.infer<typeof GradeCalculationAvailabilitySchema>;
```

`src/domain-v2/awards/index.ts` 只 re-export 上述类型和后续任务明确加入的公共函数，不导出 JSON 数组。

- [ ] **Step 4: Run schema tests and typecheck**

Run: `pnpm vitest run tests/award-schema.test.ts && pnpm tsc --noEmit`

Expected: 6 tests PASS; TypeScript exits 0.

- [ ] **Step 5: Commit the contracts**

```bash
git add src/domain-v2/awards/schema.ts src/domain-v2/awards/index.ts tests/award-schema.test.ts
git commit -m "feat: define award calculation contracts"
```

### Task 2: Add Verified Route and Official Overall Boundary Data

**Files:**
- Create: `src/data/official/awards/routes.json`
- Create: `src/data/official/awards/aqa-7357.json`
- Create: `src/data/official/awards/ocr-h240.json`
- Create: `src/data/official/awards/caie-9709.json`
- Create: `src/data/official/awards/source-manifest.json`
- Create: `generated/estimates/award-boundaries-v1.json`
- Create: `src/domain-v2/awards/catalog.ts`
- Create: `tests/award-catalog.test.ts`

**Interfaces:**
- Consumes: schemas from Task 1 and static official JSON.
- Produces: `createAwardCatalog(data)`, `awardCatalog`, `getAwardRoute(routeId)`, `listAwardRoutes(qualificationCode)`, `findOfficialBoundary(query)`, `findEstimatedBoundary(query)` and `getGradeCalculationAvailability(qualificationCode)`.

- [ ] **Step 1: Write catalog tests that reject ambiguous and non-overall records**

```ts
// tests/award-catalog.test.ts
import { describe, expect, it } from "vitest";
import { awardCatalog, createAwardCatalog } from "@/domain-v2/awards/catalog";

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
    expect(awardCatalog.findOfficialBoundary({ routeId: "award:caie:9709:2023-2025:al:same-series:AX", series: "2025-june" })).toBeUndefined();
  });

  it("never returns an estimate when an official target exists", () => {
    const catalog = createAwardCatalog({
      routes: awardCatalog.routes,
      officialBoundaries: awardCatalog.officialBoundaries,
      estimatedBoundaries: [{
        source: "estimated", methodVersion: "historical-weighted-median-v1",
        routeId: "award:aqa:7357:linear", targetSeries: "2025-june",
        componentVariants: ["7357/1", "7357/2", "7357/3"], maximumMarkAfterWeighting: 300,
        sampleSeries: ["2022-june", "2023-june", "2024-june"], sampleSize: 3,
        thresholds: { A: { centre: 221, lower: 210, upper: 230 } }, confidence: "low",
        dataAsOf: "2025-08-14", inputManifestHash: "a".repeat(64), contentHash: "b".repeat(64), isOfficial: false,
      }],
    });
    expect(catalog.findEstimatedBoundary({
      routeId: "award:aqa:7357:linear", series: "2025-june",
      componentVariants: ["7357/1", "7357/2", "7357/3"],
    })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the catalog tests and verify the red state**

Run: `pnpm vitest run tests/award-catalog.test.ts`

Expected: FAIL because Award catalog and official route files do not exist.

- [ ] **Step 3: Transcribe and normalize only official overall records**

Use these stable IDs and source rules in the JSON files:

```json
{
  "routes": [
    {
      "id": "award:aqa:7357:linear",
      "board": "AQA",
      "qualificationCode": "7357",
      "level": "A-Level",
      "specificationVersion": "7357-2017",
      "routeType": "linear",
      "routeKey": "7357-linear",
      "components": [
        { "code": "7357/1", "inputKind": "raw", "maxRawMark": 100, "weightingFactor": 1 },
        { "code": "7357/2", "inputKind": "raw", "maxRawMark": 100, "weightingFactor": 1 },
        { "code": "7357/3", "inputKind": "raw", "maxRawMark": 100, "weightingFactor": 1 }
      ],
      "maximumMarkAfterWeighting": 300,
      "roundingRule": "none",
      "grades": ["A*", "A", "B", "C", "D", "E"],
      "sourceUrl": "https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-7357-SP-2017.PDF",
      "accessedAt": "2026-07-13",
      "verificationStatus": "verified"
    }
  ]
}
```

Add OCR route `award:ocr:h240:linear` with `H240/01`, `H240/02`, `H240/03`, max 100 each, factor 1, total 300 and `roundingRule: "none"`. CAIE route IDs must also include the specification range: `award:caie:9709:<spec>:as:<option>`, `award:caie:9709:<spec>:al:same-series:<option>` and `award:caie:9709:<spec>:al:staged:<option>`. For the June 2025 golden slice, define `2023-2025:as:S1` with components 11/21 and max 125, `2023-2025:al:same-series:AX` with 11/31/41/51 and max 250, and `2023-2025:al:staged:DX` with 31/51/84 and max 250. Define 2026–2027 routes under separate IDs from the 2026–2027 syllabus; never reuse 2025 samples for a 2026 estimate merely because the visible component pattern is unchanged.

For AQA, normalize the seven existing Overall rows from `src/data/official/aqa-a-level-math-grade-boundaries.json`; the 2025 golden record must be exactly:

```json
{
  "source": "official",
  "routeId": "award:aqa:7357:linear",
  "series": "2025-june",
  "componentVariants": ["7357/1", "7357/2", "7357/3"],
  "maximumMarkAfterWeighting": 300,
  "thresholds": { "A*": 260, "A": 221, "B": 183, "C": 145, "D": 108, "E": 71 },
  "sourceUrl": "https://www.aqa.org.uk/exams-administration/results-days/grade-boundaries",
  "sourceRowId": "AQA-2025-JUNE-7357-OVERALL",
  "publishedAt": "2025-08-14",
  "accessedAt": "2026-07-13",
  "verificationStatus": "verified"
}
```

For OCR, transcribe only rows whose official label is exactly `H240 Overall`; never copy `H240/01`, `H240/02` or `H240/03` component boundaries into this file. For CAIE, one record equals one threshold-table option row and must retain the printed option code, printed component variants, printed maximum mark after weighting, PDF page/row in `sourceRowId`, and the table URL.

Download each cited official PDF once, compute `shasum -a 256`, and record the URL, SHA-256, published/accessed dates and normalized destination in `source-manifest.json`. Also compute SHA-256 for `routes.json`, `aqa-7357.json`, `ocr-h240.json` and `caie-9709.json`; those four normalized hashes are committed review locks, not regenerated during an ordinary audit.

- [ ] **Step 4: Implement exact-key catalog indexes**

```ts
// src/domain-v2/awards/catalog.ts (core shape)
import routesJson from "@/data/official/awards/routes.json";
import aqaJson from "@/data/official/awards/aqa-7357.json";
import ocrJson from "@/data/official/awards/ocr-h240.json";
import caieJson from "@/data/official/awards/caie-9709.json";
import estimatesJson from "../../../generated/estimates/award-boundaries-v1.json";
import {
  EstimatedAwardBoundarySchema, OfficialAwardBoundarySchema, OfficialAwardRouteSchema,
  type EstimatedAwardBoundary, type GradeCalculationAvailability,
  type OfficialAwardBoundary, type OfficialAwardRoute,
} from "./schema";

type BoundaryQuery = { routeId: string; series: string; optionCode?: string; componentVariants?: string[] };
type AwardCatalogData = { routes: unknown[]; officialBoundaries: unknown[]; estimatedBoundaries: unknown[] };
const variantsKey = (variants?: string[]) => variants ? [...variants].sort().join(",") : "";
const key = (routeId: string, series: string, optionCode?: string, variants?: string[]) =>
  [routeId, series, optionCode ?? "", variantsKey(variants)].join("|");

export function createAwardCatalog(data: AwardCatalogData) {
  const routes = data.routes.map(value => OfficialAwardRouteSchema.parse(value));
  const officialBoundaries = data.officialBoundaries.map(value => OfficialAwardBoundarySchema.parse(value));
  const estimatedBoundaries = data.estimatedBoundaries.map(value => EstimatedAwardBoundarySchema.parse(value));
  const routeById = new Map(routes.map(route => [route.id, route]));
  const officialByKey = new Map(officialBoundaries.map(boundary => [key(boundary.routeId, boundary.series, boundary.optionCode, boundary.componentVariants), boundary]));
  const estimateByKey = new Map(estimatedBoundaries.map(boundary => [key(boundary.routeId, boundary.targetSeries, boundary.optionCode, boundary.componentVariants), boundary]));

  const findOfficialBoundary = (query: BoundaryQuery): OfficialAwardBoundary | undefined =>
    officialByKey.get(key(query.routeId, query.series, query.optionCode, query.componentVariants));
  const findEstimatedBoundary = (query: BoundaryQuery): EstimatedAwardBoundary | undefined => {
    if (findOfficialBoundary(query)) return undefined;
    return estimateByKey.get(key(query.routeId, query.series, query.optionCode, query.componentVariants));
  };

  return {
    routes, officialBoundaries, estimatedBoundaries,
    getAwardRoute: (routeId: string): OfficialAwardRoute | undefined => routeById.get(routeId),
    listAwardRoutes: (qualificationCode: string): OfficialAwardRoute[] => routes.filter(route => route.qualificationCode === qualificationCode),
    findOfficialBoundary, findEstimatedBoundary,
    getGradeCalculationAvailability(qualificationCode: string): GradeCalculationAvailability {
      const routeIds = routes.filter(route => route.qualificationCode === qualificationCode).map(route => route.id);
      if (officialBoundaries.some(boundary => routeIds.includes(boundary.routeId))) return { status: "official", routeIds };
      if (estimatedBoundaries.some(boundary => routeIds.includes(boundary.routeId))) return { status: "estimated", routeIds, disclaimerRequired: true };
      return { status: "unavailable", reason: "没有完整且已核验的整体资格路线与边界" };
    },
  };
}

export const awardCatalog = createAwardCatalog({
  routes: routesJson.routes,
  officialBoundaries: [...aqaJson.boundaries, ...ocrJson.boundaries, ...caieJson.boundaries],
  estimatedBoundaries: estimatesJson.boundaries,
});
```

- [ ] **Step 5: Run catalog tests and full data-specific tests**

Run: `pnpm vitest run tests/award-schema.test.ts tests/award-catalog.test.ts tests/aqa-caie-math-data.test.ts tests/ocr-official-boundaries.test.ts`

Expected: all tests PASS; no component/notional record appears in `officialBoundaries`.

- [ ] **Step 6: Commit verified data and catalog**

```bash
git add src/data/official/awards src/domain-v2/awards/catalog.ts src/domain-v2/awards/index.ts tests/award-catalog.test.ts generated/estimates/award-boundaries-v1.json
git commit -m "feat: add verified award routes and overall boundaries"
```

### Task 3: Make Award Data Audit a Build Gate

**Files:**
- Modify: `scripts/audit-data.mjs`
- Modify: `package.json`
- Modify: `src/data/official/awards/source-manifest.json`
- Test: `tests/award-catalog.test.ts`

**Interfaces:**
- Consumes: four official Award JSON files and generated estimate JSON.
- Produces: `report.awards` with route, official, estimate, failure and hash summaries; non-zero exit for any official failure.

- [ ] **Step 1: Add failing mutation-oriented audit assertions**

Add to `tests/award-catalog.test.ts`:

```ts
it("rejects duplicate overall primary keys", () => {
  const record = awardCatalog.officialBoundaries[0];
  expect(() => createAwardCatalog({
    routes: awardCatalog.routes,
    officialBoundaries: [record, record],
    estimatedBoundaries: [],
  })).toThrow(/duplicate/i);
});

it("rejects boundaries whose route does not exist", () => {
  expect(() => createAwardCatalog({
    routes: awardCatalog.routes,
    officialBoundaries: [{ ...awardCatalog.officialBoundaries[0], routeId: "missing" }],
    estimatedBoundaries: [],
  })).toThrow(/route/i);
});
```

- [ ] **Step 2: Run the tests and verify both new assertions fail**

Run: `pnpm vitest run tests/award-catalog.test.ts`

Expected: FAIL because the catalog does not yet enforce referential integrity and unique keys.

- [ ] **Step 3: Add catalog invariants and script-level audit**

In `createAwardCatalog`, reject duplicate route IDs, duplicate official keys, duplicate estimate keys, missing route references, route/boundary maximum mismatches, mismatched option codes, component sets outside the route, and estimated records shadowed by an official record. In `scripts/audit-data.mjs`, define a plain-JavaScript `auditAwardData` helper mirroring those invariants, compare every normalized Award file hash with `source-manifest.json`, validate every source-document hash as 64 lowercase hex characters, and append:

```js
report.awards = {
  routeCount: routes.length,
  officialBoundaryCount: officialBoundaries.length,
  estimatedBoundaryCount: estimatedBoundaries.length,
  failureCount: awardFailures.length,
  failures: awardFailures,
  officialContentHashes: Object.fromEntries(awardFiles.map(file => [file, hashes[file]])),
};
verifiedFailures.push(...awardFailures);
```

The CAIE audit must compare sorted route component codes with sorted boundary `componentVariants`; the AQA and OCR audit must require `sourceRowId` to end in `OVERALL` and total 300.

- [ ] **Step 4: Lock the pre-generator empty estimate artifact**

Keep the existing package scripts unchanged until Task 6 creates the generator. Create `generated/estimates/award-boundaries-v1.json` with `boundaries: []`, `inputManifestHash: "f606dcba0e60798048aa68d0b6111507cc39452e401b4209eb64233b306ad71c"` (SHA-256 of `{"officialBoundaries":[],"routes":[],"targets":[]}`) and `contentHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"` (SHA-256 of `[]`). Task 6 replaces this file and wires the real generator into every consumer in one atomic commit.

- [ ] **Step 5: Run the audit and tests**

Run: `node scripts/audit-data.mjs && pnpm vitest run tests/award-catalog.test.ts`

Expected: `Data audit passed`; Award failure count is 0; tests PASS.

- [ ] **Step 6: Commit the gate**

```bash
git add scripts/audit-data.mjs src/domain-v2/awards/catalog.ts tests/award-catalog.test.ts generated/data-quality-report.json generated/estimates/award-boundaries-v1.json
git commit -m "chore: audit award routes and boundaries"
```

### Task 4: Implement Official AQA and OCR Linear Calculations

**Files:**
- Create: `src/domain-v2/awards/official-engine.ts`
- Create: `tests/award-official-engine.test.ts`
- Modify: `src/domain-v2/awards/index.ts`

**Interfaces:**
- Consumes: `AwardCalculationInput`, `awardCatalog` and exact official boundary lookup.
- Produces: `calculateOfficialAward(input, catalog): AwardCalculationResult`; throws only `AwardCalculationError` with stable public codes.

- [ ] **Step 1: Write AQA/OCR golden and validation tests**

```ts
// tests/award-official-engine.test.ts
import { describe, expect, it } from "vitest";
import { awardCatalog } from "@/domain-v2/awards/catalog";
import { AwardCalculationError, calculateOfficialAward } from "@/domain-v2/awards/official-engine";

const score = (componentCode: string, rawScore: number, series = "2025-june") => ({ componentCode, rawScore, series });
const expectAwardError = (run: () => unknown, code: AwardCalculationError["code"]) => {
  try {
    run();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(AwardCalculationError);
    expect((error as AwardCalculationError).code).toBe(code);
  }
};

describe("Official linear awards", () => {
  it.each([[259, "A"], [260, "A*"], [261, "A*"]])("maps AQA 7357 total %i to %s", (total, grade) => {
    const result = calculateOfficialAward({
      routeId: "award:aqa:7357:linear", series: "2025-june", estimateConsent: false,
      scores: [score("7357/1", 100), score("7357/2", 100), score("7357/3", total - 200)],
    }, awardCatalog);
    expect(result).toMatchObject({ source: "official", total, grade });
  });

  it("uses OCR H240 Overall rather than adding component boundaries", () => {
    const result = calculateOfficialAward({
      routeId: "award:ocr:h240:linear", series: "2025-june", estimateConsent: false,
      scores: [score("H240/01", 82), score("H240/02", 80), score("H240/03", 80)],
    }, awardCatalog);
    expect(result).toMatchObject({ source: "official", total: 242, grade: "A*" });
  });

  it.each([
    { scores: [score("7357/1", 70), score("7357/2", 70)], code: "INCOMPLETE_ROUTE" },
    { scores: [score("7357/1", 70), score("7357/1", 70), score("7357/3", 70)], code: "DUPLICATE_COMPONENT" },
    { scores: [score("7357/1", 70), score("7357/2", 70, "2024-june"), score("7357/3", 70)], code: "CROSS_SERIES" },
    { scores: [score("7357/1", 101), score("7357/2", 70), score("7357/3", 70)], code: "SCORE_OUT_OF_RANGE" },
  ])("rejects $code", ({ scores, code }) => {
    expectAwardError(
      () => calculateOfficialAward({ routeId: "award:aqa:7357:linear", series: "2025-june", estimateConsent: false, scores }, awardCatalog),
      code as AwardCalculationError["code"],
    );
  });
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `pnpm vitest run tests/award-official-engine.test.ts`

Expected: FAIL because `official-engine.ts` does not exist.

- [ ] **Step 3: Implement validation, raw aggregation and threshold mapping**

```ts
// src/domain-v2/awards/official-engine.ts (public contract and linear core)
import type { AwardCalculationInput, AwardCalculationResult, OfficialAwardBoundary, OfficialAwardRoute } from "./schema";
import { AwardCalculationInputSchema } from "./schema";
import type { createAwardCatalog } from "./catalog";

export type AwardErrorCode = "UNKNOWN_ROUTE" | "INCOMPLETE_ROUTE" | "DUPLICATE_COMPONENT" | "CROSS_SERIES" |
  "SCORE_OUT_OF_RANGE" | "OPTION_MISMATCH" | "VARIANT_MISMATCH" | "MISSING_BOUNDARY" | "CARRY_FORWARD_REQUIRED";

export class AwardCalculationError extends Error {
  constructor(public readonly code: AwardErrorCode) { super(code); this.name = "AwardCalculationError"; }
}

const mapGrade = (total: number, boundary: OfficialAwardBoundary, gradeOrder: string[]) =>
  gradeOrder.find(grade => total >= boundary.thresholds[grade]) ?? "U";

function validateScores(input: AwardCalculationInput, route: OfficialAwardRoute) {
  const expected = new Map(route.components.map(component => [component.code, component]));
  const seen = new Set<string>();
  for (const score of input.scores) {
    if (score.series !== input.series) throw new AwardCalculationError("CROSS_SERIES");
    if (seen.has(score.componentCode)) throw new AwardCalculationError("DUPLICATE_COMPONENT");
    seen.add(score.componentCode);
    const component = expected.get(score.componentCode);
    if (!component || score.rawScore > component.maxRawMark) throw new AwardCalculationError("SCORE_OUT_OF_RANGE");
  }
  if (seen.size !== expected.size || [...expected.keys()].some(code => !seen.has(code))) throw new AwardCalculationError("INCOMPLETE_ROUTE");
}

export function calculateOfficialAward(inputValue: AwardCalculationInput, catalog: ReturnType<typeof createAwardCatalog>): AwardCalculationResult {
  const input = AwardCalculationInputSchema.parse(inputValue);
  const route = catalog.getAwardRoute(input.routeId);
  if (!route) throw new AwardCalculationError("UNKNOWN_ROUTE");
  validateScores(input, route);
  const variants = input.scores.map(score => score.variant ?? score.componentCode);
  const boundary = catalog.findOfficialBoundary({ routeId: route.id, series: input.series, optionCode: input.optionCode, componentVariants: variants });
  if (!boundary) throw new AwardCalculationError("MISSING_BOUNDARY");
  const total = input.scores.reduce((sum, score) => {
    const component = route.components.find(item => item.code === score.componentCode)!;
    return sum + score.rawScore * component.weightingFactor;
  }, 0);
  return {
    source: "official", routeId: route.id, series: input.series, optionCode: input.optionCode,
    total, maximumMarkAfterWeighting: route.maximumMarkAfterWeighting,
    grade: mapGrade(total, boundary, route.grades), sourceUrls: [route.sourceUrl, boundary.sourceUrl],
  };
}
```

Extend the test table to every published AQA and OCR grade, checking `threshold - 1`, the exact threshold and `threshold + 1`; the explicit `route.grades` order above must return `U` below E.

- [ ] **Step 4: Run all official linear tests**

Run: `pnpm vitest run tests/award-official-engine.test.ts tests/award-catalog.test.ts`

Expected: all AQA/OCR golden and rejection cases PASS.

- [ ] **Step 5: Commit the linear engine**

```bash
git add src/domain-v2/awards/official-engine.ts src/domain-v2/awards/index.ts tests/award-official-engine.test.ts
git commit -m "feat: calculate official AQA and OCR awards"
```

### Task 5: Implement Exact CAIE Option and Carry-Forward Rules

**Files:**
- Modify: `src/domain-v2/awards/official-engine.ts`
- Modify: `tests/award-official-engine.test.ts`

**Interfaces:**
- Consumes: CAIE option-specific routes and official boundary records from Task 2.
- Produces: the same `calculateOfficialAward` interface, with exact variant matching, official weighting/rounding and staged carry-forward validation.

- [ ] **Step 1: Add CAIE AS, same-series and staged golden tests**

Use the June 2025 threshold-table rows `AX` (same-series A-Level), `S1` (AS) and `DX` (staged A-Level) as golden fixtures. Page 2 prints AX as `11,31,41,51`, maximum 250 and thresholds `A* 224, A 198, B 171, C 133, D 95, E 57`; DX as `31,51,84`, maximum 250 and thresholds `A* 208, A 185, B 162, C 126, D 90, E 55`; S1 as `11,21`, maximum 125 and thresholds `a 97, b 82, c 63, d 45, e 27`. Add these exact constants and cases:

```ts
const validCaieRouteId = "award:caie:9709:2023-2025:al:same-series:AX";
const validOption = "AX";
const validCaieScores = [
  { componentCode: "9709/11", variant: "11", series: "2025-june", rawScore: 70, inputKind: "raw" as const },
  { componentCode: "9709/31", variant: "31", series: "2025-june", rawScore: 70, inputKind: "raw" as const },
  { componentCode: "9709/41", variant: "41", series: "2025-june", rawScore: 50, inputKind: "raw" as const },
  { componentCode: "9709/51", variant: "51", series: "2025-june", rawScore: 34, inputKind: "raw" as const },
];
const stagedRouteId = "award:caie:9709:2023-2025:al:staged:DX";
const stagedOption = "DX";
const stagedRawPaperInputs = [
  { componentCode: "9709/31", variant: "31", series: "2025-june", rawScore: 55, inputKind: "raw" as const },
  { componentCode: "9709/51", variant: "51", series: "2025-june", rawScore: 45, inputKind: "raw" as const },
  { componentCode: "9709/84", variant: "84", series: "2025-june", rawScore: 108, inputKind: "raw" as const },
];

it("maps exact CAIE AX overall threshold to A*", () => {
  expect(calculateOfficialAward({
    routeId: validCaieRouteId, series: "2025-june", optionCode: validOption,
    scores: validCaieScores, estimateConsent: false,
  }, awardCatalog)).toMatchObject({ source: "official", total: 224, maximumMarkAfterWeighting: 250, grade: "A*" });
});

it("maps exact CAIE S1 AS threshold without A*", () => {
  const result = calculateOfficialAward({
    routeId: "award:caie:9709:2023-2025:as:S1", series: "2025-june", optionCode: "S1", estimateConsent: false,
    scores: [
      { componentCode: "9709/11", variant: "11", series: "2025-june", rawScore: 59, inputKind: "raw" },
      { componentCode: "9709/21", variant: "21", series: "2025-june", rawScore: 38, inputKind: "raw" },
    ],
  }, awardCatalog);
  expect(result).toMatchObject({ total: 97, maximumMarkAfterWeighting: 125, grade: "a" });
});

it.each([
  { optionCode: "WRONG", code: "OPTION_MISMATCH" },
  { optionCode: validOption, variantOverride: "12", code: "VARIANT_MISMATCH" },
])("rejects CAIE $code", ({ optionCode, variantOverride, code }) => {
  const scores = validCaieScores.map((score, index) => index === 0 && variantOverride ? { ...score, variant: variantOverride } : score);
  expectAwardError(
    () => calculateOfficialAward({ routeId: validCaieRouteId, series: "2025-june", optionCode, scores, estimateConsent: false }, awardCatalog),
    code as AwardCalculationError["code"],
  );
});

it("rejects staged raw papers in place of a carried-forward mark", () => {
  expectAwardError(() => calculateOfficialAward({
    routeId: stagedRouteId, series: "2025-june", optionCode: stagedOption,
    scores: stagedRawPaperInputs, estimateConsent: false,
  }, awardCatalog), "CARRY_FORWARD_REQUIRED");
});

it("does not expose A* for an AS route", () => {
  const route = awardCatalog.getAwardRoute("award:caie:9709:2023-2025:as:S1")!;
  expect(route.grades).toEqual(["a", "b", "c", "d", "e"]);
});
```

- [ ] **Step 2: Run only CAIE tests and verify failures**

Run: `pnpm vitest run tests/award-official-engine.test.ts -t "CAIE|staged|AS route"`

Expected: FAIL until option, variant, weighting and carried-forward rules are enforced.

- [ ] **Step 3: Extend score input and engine for carried-forward marks**

Change `rawScore` to `z.number().finite().int().nonnegative()` and add `inputKind: z.enum(["raw", "carried-forward"]).default("raw")` to `AwardScoreInputSchema`. In `validateScores`, require exact agreement with the route component's `inputKind`. Before boundary lookup, enforce `input.optionCode === route.optionCode` when the route has an option, and compare every input `variant` with the suffix of its route component code; throw `OPTION_MISMATCH` or `VARIANT_MISMATCH` before a generic missing-boundary error. For `official-carry-forward`, accept only the official non-negative integer carried-forward mark supplied in result/entry data; do not accept previous Paper IDs. Apply each component's official factor, then:

```ts
const roundTotal = (value: number, rule: OfficialAwardRoute["roundingRule"]) => {
  if (rule === "none") return value;
  if (rule === "nearest-integer") return Math.round(value);
  if (rule === "official-carry-forward" && Number.isInteger(value)) return value;
  throw new AwardCalculationError("CARRY_FORWARD_REQUIRED");
};
```

The route JSON remains the source of whether `official-carry-forward` is permitted. The 2026–2027 syllabus pages 13, 16 and 57 prove the staged structure and require carry-forward under the relevant Cambridge Handbook; the June 2025 threshold table page 2 proves option DX uses carried-forward component `84`. Model `9709/84` as `inputKind: "carried-forward"`, max 125, factor 1, and accept only the official carried-forward mark shown in the candidate's result/entry data. If the applicable Handbook time limit and eligibility cannot be verified for the selected prior series, do not expose DX for that input; return `CARRY_FORWARD_REQUIRED` instead of applying a guessed conversion.

- [ ] **Step 4: Run all official engine tests and catalog audit**

Run: `pnpm vitest run tests/award-official-engine.test.ts && pnpm data:audit`

Expected: AS, same-series and every published staged golden case PASS; every wrong option/variant/carry-forward case is rejected; audit failure count is 0.

- [ ] **Step 5: Commit CAIE support**

```bash
git add src/domain-v2/awards/schema.ts src/domain-v2/awards/official-engine.ts src/data/official/awards/routes.json src/data/official/awards/caie-9709.json tests/award-official-engine.test.ts
git commit -m "feat: enforce CAIE 9709 award options"
```

### Task 6: Build Deterministic Non-Official Estimates

**Files:**
- Create: `src/domain-v2/awards/weighted-quantile.ts`
- Create: `src/domain-v2/awards/estimate-core.ts`
- Create: `src/domain-v2/awards/estimate-engine.ts`
- Create: `scripts/build-award-estimates.mjs`
- Create: `tests/award-estimate-engine.test.ts`
- Modify: `generated/estimates/award-boundaries-v1.json`
- Modify: `src/domain-v2/awards/index.ts`

**Interfaces:**
- Consumes: verified route, 3–5 comparable `OfficialAwardBoundary` records and a target series.
- Produces: shared Node/browser-safe `weightedQuantile(samples, q)`, `assertEstimateMonotonicity(bands, gradeOrder, maximumMark)` and `generateEstimatedBoundary(input)` from `estimate-core.ts`; runtime-only `calculateEstimatedAward(input, catalog)` from `estimate-engine.ts`; canonical generated JSON.

- [ ] **Step 1: Write exact algorithm tests**

```ts
// tests/award-estimate-engine.test.ts
import { describe, expect, it } from "vitest";
import { weightedQuantile } from "@/domain-v2/awards/weighted-quantile";
import { assertEstimateMonotonicity, generateEstimatedBoundary } from "@/domain-v2/awards/estimate-core";
import { awardCatalog } from "@/domain-v2/awards/catalog";

const aqaRoute = awardCatalog.getAwardRoute("award:aqa:7357:linear")!;
const aqaSamples = awardCatalog.officialBoundaries.filter(boundary => boundary.routeId === aqaRoute.id);
const bySeries = (series: string) => aqaSamples.find(boundary => boundary.series === series)!;
const aqa2021 = bySeries("2021-november");
const aqa2022 = bySeries("2022-june");
const aqa2023 = bySeries("2023-june");
const aqa2024 = bySeries("2024-june");
const aqa2025 = bySeries("2025-june");

describe("historical-weighted-median-v1", () => {
  it.each([[0.25, 0.70], [0.5, 0.72], [0.75, 0.74]])("uses first cumulative weight at q=%s", (q, expected) => {
    const samples = [
      { value: 0.70, weight: 2 }, { value: 0.72, weight: 2 }, { value: 0.74, weight: 2 },
    ];
    expect(weightedQuantile(samples, q)).toBe(expected);
  });

  it("normalizes samples and rounds centre/integer interval correctly", () => {
    const estimate = generateEstimatedBoundary({
      route: aqaRoute,
      targetSeries: "2026-june",
      samples: [aqa2021, aqa2022, aqa2023, aqa2024, aqa2025],
      dataAsOf: "2025-08-14",
    });
    expect(estimate.methodVersion).toBe("historical-weighted-median-v1");
    expect(estimate.sampleSeries).toEqual(["2025-june", "2024-june", "2023-june", "2022-june", "2021-november"]);
    expect(estimate.thresholds.A.lower).toBe(Math.floor(estimate.thresholds.A.lower));
    expect(estimate.thresholds.A.upper).toBe(Math.ceil(estimate.thresholds.A.upper));
  });

  it.each([
    { samples: [aqa2023, aqa2024], reason: "INSUFFICIENT_SAMPLES" },
    { samples: [aqa2023, { ...aqa2024, routeId: "other" }, aqa2025], reason: "INCOMPARABLE_SAMPLE" },
  ])("rejects $reason", ({ samples, reason }) => {
    expect(() => generateEstimatedBoundary({ route: aqaRoute, targetSeries: "2026-june", samples, dataAsOf: "2025-08-14" })).toThrow(reason);
  });

  it("rejects a non-monotonic generated band instead of smoothing it", () => {
    expect(() => assertEstimateMonotonicity(
      { "A*": { centre: 220, lower: 215, upper: 225 }, A: { centre: 230, lower: 220, upper: 235 } },
      ["A*", "A"], 300,
    )).toThrow("NON_MONOTONIC_ESTIMATE");
  });
});
```

- [ ] **Step 2: Run the estimate tests and verify the red state**

Run: `pnpm vitest run tests/award-estimate-engine.test.ts`

Expected: FAIL because weighted quantile and estimate modules do not exist.

- [ ] **Step 3: Implement deterministic weighted quantiles**

```ts
// src/domain-v2/awards/weighted-quantile.ts
export type WeightedSample = { value: number; weight: number };

export function weightedQuantile(samples: WeightedSample[], q: 0.25 | 0.5 | 0.75): number {
  if (samples.length === 0 || samples.some(sample => !Number.isFinite(sample.value) || sample.weight <= 0)) {
    throw new Error("INVALID_WEIGHTED_SAMPLES");
  }
  const ordered = [...samples].sort((a, b) => a.value - b.value || a.weight - b.weight);
  const target = ordered.reduce((sum, sample) => sum + sample.weight, 0) * q;
  let cumulative = 0;
  for (const sample of ordered) {
    cumulative += sample.weight;
    if (cumulative >= target) return sample.value;
  }
  return ordered.at(-1)!.value;
}
```

- [ ] **Step 4: Implement the shared estimate core and runtime mapper**

`estimate-core.ts` must use only relative imports and erasable TypeScript syntax so both Vinext and Node 22's type stripping can load the exact same implementation. `generateEstimatedBoundary` sorts official series by exam date descending, keeps at most five, assigns weights `n..1`, calculates each grade independently, uses `Math.round` for centre, `Math.floor` for lower and `Math.ceil` for upper, then rejects a non-monotonic centre/lower/upper sequence. Confidence is `high` only for five same-season samples with every normalized IQR ≤0.03; `medium` for at least three same-season samples with every IQR ≤0.06; otherwise `low`. `estimate-engine.ts` imports that generated type/core but only maps user totals against catalog-provided estimate bands. `calculateEstimatedAward` requires `estimateConsent === true` and returns the fixed warning:

```ts
export const ESTIMATE_WARNING = "此结果基于历史整体分数线的统计预估，不是考试局正式成绩或官方分数线。";
```

Determine `gradeRange` by mapping the same total once against every strict upper threshold and once against every lenient lower threshold; preserve the route's explicit grade order.

- [ ] **Step 5: Implement canonical build output**

`scripts/build-award-estimates.mjs` must import `generateEstimatedBoundary` from `../src/domain-v2/awards/estimate-core.ts`; it must not duplicate the weighted-quantile, sample-selection, rounding or confidence logic. It then:

1. Read and schema-validate official route/boundary JSON.
2. Enumerate only target series explicitly listed in a constant such as `TARGET_SERIES = ["2026-june"]`.
3. Skip any target with an exact official key.
4. Generate only when 3–5 comparable samples exist.
5. Canonicalize object keys recursively before SHA-256 hashing.
6. Write `schemaVersion`, sorted `boundaries`, `inputManifestHash`, `contentHash` and a trailing newline.
7. Generate twice in the test and assert byte-for-byte equality.

After the generator exists, update package scripts atomically to this ordering:

```json
{
  "build": "node scripts/build-course-catalog.mjs && node scripts/build-award-estimates.mjs && node scripts/clean-dist.mjs && vinext build && node scripts/clean-server-public.mjs",
  "data:build": "node scripts/build-course-catalog.mjs && node scripts/build-static-boundaries.mjs && node scripts/build-award-estimates.mjs",
  "data:audit": "node scripts/build-course-catalog.mjs && node scripts/build-static-boundaries.mjs && node scripts/build-award-estimates.mjs && node scripts/audit-data.mjs",
  "check": "node scripts/build-course-catalog.mjs && node scripts/build-static-boundaries.mjs && node scripts/build-award-estimates.mjs && node scripts/audit-data.mjs && tsc --noEmit && eslint app src tests --ignore-pattern dist --ignore-pattern .next && vitest run && node scripts/clean-dist.mjs && vinext build && node scripts/clean-server-public.mjs && node scripts/check-build-budgets.mjs"
}
```

- [ ] **Step 6: Run generator twice and all estimate tests**

Run: `pnpm data:build && cp generated/estimates/award-boundaries-v1.json /tmp/award-estimates.json && pnpm data:build && cmp generated/estimates/award-boundaries-v1.json /tmp/award-estimates.json && pnpm vitest run tests/award-estimate-engine.test.ts`

Expected: `cmp` exits 0; all estimate tests PASS; routes without three valid samples are absent rather than emitted with low confidence.

- [ ] **Step 7: Commit the estimate engine and generated artifact**

```bash
git add src/domain-v2/awards scripts/build-award-estimates.mjs tests/award-estimate-engine.test.ts generated/estimates/award-boundaries-v1.json package.json
git commit -m "feat: generate deterministic award estimates"
```

### Task 7: Integrate Course Capability Without Promoting Verification

**Files:**
- Modify: `src/course-context/types.ts`
- Modify: `src/course-context/catalog-source.ts`
- Modify: `src/course-context/catalog.ts`
- Modify: `src/course-context/audit.ts`
- Test: `tests/course-catalog.test.ts`

**Interfaces:**
- Consumes: `getGradeCalculationAvailability(qualificationCode)` from Award catalog.
- Produces: `CourseContextEntry.gradeCalculation`; existing `capabilities.calculator` remains the UI-compatible summary.

- [ ] **Step 1: Add failing course capability tests**

```ts
it("separates official and estimated grade calculation capability", () => {
  const aqa = COURSE_CATALOG.find(entry => entry.boardName === "AQA" && entry.subjectCode === "7357")!;
  expect(aqa.gradeCalculation.status).toBe("official");
  expect(aqa.capabilities.calculator).toMatchObject({ status: "available", verificationStatus: "verified" });
});

it("does not promote an estimated-only course to verified calculator coverage", () => {
  const availability = { status: "estimated", routeIds: ["award:test"], disclaimerRequired: true } as const;
  expect(toCalculatorFeature(availability)).toEqual({
    status: "partial", verificationStatus: "unverified", href: "/calculator",
    reason: "仅提供明确标注的非官方预估",
  });
});
```

- [ ] **Step 2: Run the course catalog test and verify failure**

Run: `pnpm vitest run tests/course-catalog.test.ts`

Expected: FAIL because `gradeCalculation` and `toCalculatorFeature` do not exist.

- [ ] **Step 3: Extend schemas and derive the compatibility capability**

Add `gradeCalculation: GradeCalculationAvailabilitySchema` to `CourseContextEntrySchema`. Export:

```ts
export function toCalculatorFeature(value: GradeCalculationAvailability): FeatureAvailability {
  if (value.status === "official") return { status: "available", verificationStatus: "verified", href: "/calculator" };
  if (value.status === "estimated") return {
    status: "partial", verificationStatus: "unverified", href: "/calculator",
    reason: "仅提供明确标注的非官方预估",
  };
  return { status: "unavailable", verificationStatus: "unverified", reason: value.reason };
}
```

In `catalog-source.ts`, call Award availability only for `7357`, `H240`, `9709`; preserve the current Edexcel WMA branch as official. Update compact catalog generation/parsing so `gradeCalculation` survives the generated artifact rather than being recomputed differently in the browser.

- [ ] **Step 4: Extend catalog audit**

Require every `official` route ID to exist in Award catalog, every `estimated` route ID to exist in generated estimates, and `capabilities.calculator.verificationStatus !== "verified"` whenever `gradeCalculation.status === "estimated"`.

- [ ] **Step 5: Rebuild and test catalog**

Run: `pnpm data:build && pnpm vitest run tests/course-catalog.test.ts tests/course-context.test.ts && pnpm data:audit`

Expected: tests PASS; the course center distinguishes official, estimated and unavailable; estimated-only entries do not increase verified calculator counts.

- [ ] **Step 6: Commit capability integration**

```bash
git add src/course-context scripts/build-course-catalog.mjs tests/course-catalog.test.ts generated/course-catalog.json
git commit -m "feat: expose award calculation capability"
```

### Task 8: Add the Official/Estimated Calculator Workflow

**Files:**
- Create: `src/pages/grade-calculator/AwardCalculatorPanel.tsx`
- Create: `src/pages/grade-calculator/AwardResultCard.tsx`
- Modify: `src/pages/GradeCalculator.tsx`
- Create: `tests/award-calculator-view.test.ts`

**Interfaces:**
- Consumes: Award catalog, official engine, estimate engine and course context.
- Produces: accessible route/series/option/component form and mutually exclusive official/estimated result card.

- [ ] **Step 1: Write component logic tests around a pure view model**

Keep DOM rendering thin by exporting `buildAwardCalculatorViewModel(entry, catalog, selectedSeries?)` from `AwardCalculatorPanel.tsx`. `requiresConsent` is true only when the currently selected series resolves to an estimated boundary; merely having another estimated series in the catalog must not affect an official selection. Test:

```ts
import { COURSE_CATALOG } from "@/course-context/catalog-source";
import { awardCatalog, createAwardCatalog } from "@/domain-v2/awards/catalog";
import { generateEstimatedBoundary } from "@/domain-v2/awards/estimate-engine";
import { buildAwardCalculatorViewModel } from "@/pages/grade-calculator/AwardCalculatorPanel";

const aqa7357Entry = COURSE_CATALOG.find(entry => entry.boardName === "AQA" && entry.subjectCode === "7357")!;
const unavailableEntry = COURSE_CATALOG.find(entry => entry.boardName === "WJEC/Eduqas")!;
const aqaRouteForView = awardCatalog.getAwardRoute("award:aqa:7357:linear")!;
const estimate2026 = generateEstimatedBoundary({
  route: aqaRouteForView,
  targetSeries: "2026-june",
  samples: awardCatalog.officialBoundaries
    .filter(boundary => boundary.routeId === aqaRouteForView.id)
    .sort((a, b) => b.series.localeCompare(a.series))
    .slice(0, 5),
  dataAsOf: "2025-08-14",
});
const catalogWith2026EstimateOnly = createAwardCatalog({
  routes: awardCatalog.routes,
  officialBoundaries: awardCatalog.officialBoundaries,
  estimatedBoundaries: [estimate2026],
});

it("shows official choices without consent for AQA 7357", () => {
  const model = buildAwardCalculatorViewModel(aqa7357Entry, awardCatalog, "2025-june");
  expect(model.mode).toBe("official");
  expect(model.requiresConsent).toBe(false);
  expect(model.routeOptions.map(option => option.id)).toContain("award:aqa:7357:linear");
});

it("requires explicit consent for an estimated target", () => {
  const model = buildAwardCalculatorViewModel(aqa7357Entry, catalogWith2026EstimateOnly, "2026-june");
  expect(model.seriesOptions.find(option => option.id === "2026-june")).toMatchObject({ source: "estimated" });
  expect(model.requiresConsent).toBe(true);
});

it("does not expose a calculator action when unavailable", () => {
  expect(buildAwardCalculatorViewModel(unavailableEntry, awardCatalog).mode).toBe("unavailable");
});
```

- [ ] **Step 2: Run the focused view tests and verify failure**

Run: `pnpm vitest run tests/award-calculator-view.test.ts`

Expected: FAIL because the panel and view model do not exist.

- [ ] **Step 3: Build the panel with exact interaction rules**

The form order is qualification → level/route → series → CAIE option → component scores. All controls use visible `<label htmlFor>` and stable catalog IDs as values. Estimated series renders an unchecked checkbox with exact label `我理解这是非官方预估`; the Calculate button remains disabled until checked. Catch `AwardCalculationError` and map codes to fixed Chinese copy in a `PUBLIC_AWARD_ERRORS` record; never render `error.message` directly.

In `GradeCalculator.tsx`:

```tsx
const awardQualification = entry && ["7357", "H240", "9709"].includes(entry.subjectCode) ? entry : null;

if (awardQualification) {
  return (
    <PageShell>
      <h1>等级预测</h1>
      <AwardCalculatorPanel course={awardQualification} />
    </PageShell>
  );
}
```

Keep the existing Edexcel `BOARD_GROUPS` and legacy calculation code reachable for WMA only; do not add AQA/OCR/CAIE to the legacy `calculatorIndex` path.

- [ ] **Step 4: Implement visually incompatible result states**

`AwardResultCard` must render:

- Official: green badge `官方整体边界 · 已核验`, route/option/components/total/thresholds and official source links.
- Estimated: amber badge `非官方预估等级`, centre grade, `合理范围 X–Y`, interval table, confidence, sample series, method version and exact `ESTIMATE_WARNING`.
- AQA/OCR component lines: optional text `单卷门槛仅供表现参考，不用于资格授予` without grade-award icon.

Give the result card `aria-live="polite"`, preserve focus to the result heading after calculation, and expose print styles that keep the badge and warning visible.

- [ ] **Step 5: Run component tests, typecheck and accessibility lint**

Run: `pnpm vitest run tests/award-calculator-view.test.ts tests/award-official-engine.test.ts tests/award-estimate-engine.test.ts && pnpm tsc --noEmit && pnpm lint`

Expected: all tests PASS; typecheck/lint exit 0.

- [ ] **Step 6: Commit the calculator UI**

```bash
git add src/pages/GradeCalculator.tsx src/pages/grade-calculator tests/award-calculator-view.test.ts
git commit -m "feat: add official and estimated award workflow"
```

### Task 9: Preserve Provenance in Share, Restore and Export

**Files:**
- Create: `src/domain-v2/awards/share-state.ts`
- Create: `src/pages/grade-calculator/exportAwardResult.ts`
- Create: `tests/award-share-export.test.ts`
- Modify: `src/pages/grade-calculator/AwardCalculatorPanel.tsx`
- Modify: `src/pages/grade-calculator/AwardResultCard.tsx`

**Interfaces:**
- Consumes: `AwardCalculationInput` and `AwardCalculationResult`.
- Produces: `encodeAwardShareState`, `decodeAwardShareState`, `resolveSharedAward`, `buildAwardExportRows`, `exportAwardCsv`, `exportAwardExcel`.

- [ ] **Step 1: Write share, override and export tests**

```ts
// tests/award-share-export.test.ts
import { describe, expect, it } from "vitest";
import { decodeAwardShareState, encodeAwardShareState, resolveSharedAward } from "@/domain-v2/awards/share-state";
import { awardCatalog } from "@/domain-v2/awards/catalog";
import type { AwardCalculationInput, AwardCalculationResult } from "@/domain-v2/awards/schema";
import { buildAwardExportRows } from "@/pages/grade-calculator/exportAwardResult";

const officialInput: AwardCalculationInput = {
  routeId: "award:aqa:7357:linear", series: "2025-june", estimateConsent: false,
  scores: [
    { componentCode: "7357/1", series: "2025-june", rawScore: 90 },
    { componentCode: "7357/2", series: "2025-june", rawScore: 85 },
    { componentCode: "7357/3", series: "2025-june", rawScore: 85 },
  ],
};
const sharedEstimateState = { version: 1 as const, input: { ...officialInput, estimateConsent: true }, displayedSource: "estimated" as const };
const catalogWithOfficialTarget = awardCatalog;
const estimatedResult: AwardCalculationResult = {
  source: "estimated", routeId: "award:aqa:7357:linear", series: "2026-june",
  total: 220, maximumMarkAfterWeighting: 300, grade: "A", gradeRange: ["A", "B"],
  confidence: "medium", sampleSeries: ["2025-june", "2024-june", "2023-june"],
  methodVersion: "historical-weighted-median-v1",
  warning: "此结果基于历史整体分数线的统计预估，不是考试局正式成绩或官方分数线。",
  sourceUrls: ["https://www.aqa.org.uk/exams-administration/results-days/grade-boundaries/archive"],
};

it("round-trips a versioned state under the size limit", () => {
  const encoded = encodeAwardShareState({ version: 1, input: officialInput, displayedSource: "official" });
  expect(encoded.length).toBeLessThanOrEqual(4096);
  expect(decodeAwardShareState(encoded)).toEqual({ version: 1, input: officialInput, displayedSource: "official" });
});

it("rejects oversized and malformed state", () => {
  expect(decodeAwardShareState("x".repeat(4097))).toBeNull();
  expect(decodeAwardShareState("not-valid-base64url")).toBeNull();
});

it("upgrades a shared estimate when official data now exists", () => {
  expect(resolveSharedAward(sharedEstimateState, catalogWithOfficialTarget)).toMatchObject({
    result: { source: "official" }, notice: "官方边界现已发布",
  });
});

it("keeps estimate provenance in every export row", () => {
  expect(buildAwardExportRows(estimatedResult)).toEqual(expect.arrayContaining([
    expect.objectContaining({ 结果类型: "非官方预估等级", 置信度: estimatedResult.confidence, 算法版本: "historical-weighted-median-v1" }),
  ]));
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `pnpm vitest run tests/award-share-export.test.ts`

Expected: FAIL because share and export modules do not exist.

- [ ] **Step 3: Implement versioned, bounded share state**

Use `TextEncoder`/`TextDecoder` plus base64url, not localStorage object revival. The schema is:

```ts
const AwardShareStateSchema = z.object({
  version: z.literal(1),
  input: AwardCalculationInputSchema,
  displayedSource: z.enum(["official", "estimated"]),
});
export const MAX_AWARD_SHARE_LENGTH = 4096;
```

`resolveSharedAward` first queries the official boundary using the shared stable IDs. If found, calculate official and return notice `官方边界现已发布`; otherwise calculate the estimate only when the stored state has explicit estimate consent. Never preserve a stale estimated threshold value in the URL.

- [ ] **Step 4: Implement one export row model for CSV and Excel**

`buildAwardExportRows` returns Chinese column names including result type, qualification, series, route, option, total, maximum, grade, reasonable range, confidence, sample series, algorithm version, warning and sources. `exportAwardCsv` uses `sanitizeCsvValue`; `exportAwardExcel` dynamically imports `write-excel-file` and uses `buildObjectSheet`, thereby retaining existing formula-injection protection.

- [ ] **Step 5: Wire share, refresh, history and print controls**

Store only the encoded versioned state in the hash query parameter `award=`. Listen to `hashchange` so browser back/forward restores the input. Store at most the most recent valid state under `exambridge:award-calculator:v1`; catch storage quota errors. Buttons are `复制分享链接`, `下载 CSV`, `下载 Excel`, `打印结果`; print calls `window.print()` after the result card is present.

- [ ] **Step 6: Run all share/export and security tests**

Run: `pnpm vitest run tests/award-share-export.test.ts tests/csvExport.test.ts tests/excel-export.test.ts && pnpm tsc --noEmit`

Expected: tests PASS; malformed/oversized states return null; estimate exports contain all mandatory labels.

- [ ] **Step 7: Commit share and export**

```bash
git add src/domain-v2/awards/share-state.ts src/pages/grade-calculator tests/award-share-export.test.ts
git commit -m "feat: preserve award provenance in sharing and exports"
```

### Task 10: Add End-to-End Release Gates and Documentation

**Files:**
- Modify: `e2e/routes.spec.ts`
- Modify: `vitest.config.ts`
- Modify: `README.md`
- Modify: `DATA_SOURCES.md`
- Modify: `DATA_RIGHTS.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: completed Award flow and existing CI/Sites deployment process.
- Produces: release evidence for official, estimated, unavailable, mobile, keyboard, exports, upgrade and SHA parity.

- [ ] **Step 1: Add E2E scenarios before changing the gate**

Add explicit Playwright tests for:

```ts
async function openEstimatedTarget(page: import("@playwright/test").Page) {
  await page.goto("/#/courses");
  await page.getByPlaceholder("搜索科目名称或代码").fill("7357");
  await page.getByRole("button", { name: /AQA.*7357.*Mathematics/i }).click();
  await page.getByRole("link", { name: /等级预测.*官方|等级预测.*预估/i }).click();
  await page.getByLabel("考季").selectOption("2026-june");
  await page.getByLabel("7357/1 分数").fill("75");
  await page.getByLabel("7357/2 分数").fill("75");
  await page.getByLabel("7357/3 分数").fill("75");
}

test("AQA 7357 calculates an official overall grade", async ({ page }) => {
  await page.goto("/#/courses");
  await page.getByPlaceholder("搜索科目名称或代码").fill("7357");
  await page.getByRole("button", { name: /AQA.*7357.*Mathematics/i }).click();
  await page.getByRole("link", { name: /等级预测.*官方/i }).click();
  await page.getByLabel("考季").selectOption("2025-june");
  await page.getByLabel("7357\/1 分数").fill("90");
  await page.getByLabel("7357\/2 分数").fill("85");
  await page.getByLabel("7357\/3 分数").fill("85");
  await page.getByRole("button", { name: "计算等级" }).click();
  await expect(page.getByText("官方整体边界 · 已核验")).toBeVisible();
  await expect(page.getByText("A*", { exact: true })).toBeVisible();
});

test("estimated calculation requires consent and survives sharing", async ({ page, context }) => {
  await openEstimatedTarget(page);
  await expect(page.getByRole("button", { name: "计算等级" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "我理解这是非官方预估" }).check();
  await page.getByRole("button", { name: "计算等级" }).click();
  await expect(page.getByText("非官方预估等级", { exact: true })).toBeVisible();
  await expect(page.getByText(/不是考试局正式成绩/)).toBeVisible();
  const shared = await page.getByLabel("分享链接").inputValue();
  const restored = await context.newPage();
  await restored.goto(shared);
  await expect(restored.getByText("非官方预估等级", { exact: true })).toBeVisible();
  const [csv] = await Promise.all([restored.waitForEvent("download"), restored.getByRole("button", { name: "下载 CSV" }).click()]);
  expect(csv.suggestedFilename()).toContain("非官方预估");
  const [excel] = await Promise.all([restored.waitForEvent("download"), restored.getByRole("button", { name: "下载 Excel" }).click()]);
  expect(excel.suggestedFilename()).toContain("非官方预估");
  await restored.evaluate(() => Object.defineProperty(window, "print", { value: () => { document.body.dataset.printCalled = "yes"; } }));
  await restored.getByRole("button", { name: "打印结果" }).click();
  await expect(restored.locator("body")).toHaveAttribute("data-print-called", "yes");
  await expect(restored.getByText(/置信度/)).toBeVisible();
  await expect(restored.getByText(/样本考季/)).toBeVisible();
  expect((await restored.screenshot()).byteLength).toBeGreaterThan(10_000);
});

test("OCR H240 uses the official Overall threshold", async ({ page }) => {
  await page.goto("/#/courses");
  await page.getByPlaceholder("搜索科目名称或代码").fill("H240");
  await page.getByRole("button", { name: /OCR.*H240.*Mathematics/i }).click();
  await page.getByRole("link", { name: /等级预测.*官方/i }).click();
  await page.getByLabel("考季").selectOption("2025-june");
  await page.getByLabel("H240/01 分数").fill("82");
  await page.getByLabel("H240/02 分数").fill("80");
  await page.getByLabel("H240/03 分数").fill("80");
  await page.getByRole("button", { name: "计算等级" }).click();
  await expect(page.getByText("H240 Overall")).toBeVisible();
  await expect(page.getByText("A*", { exact: true })).toBeVisible();
});

test("CAIE 9709 requires the exact AX option and variants", async ({ page }) => {
  await page.goto("/#/courses");
  await page.getByPlaceholder("搜索科目名称或代码").fill("9709");
  await page.getByRole("button", { name: /CAIE.*9709.*Mathematics/i }).click();
  await page.getByRole("link", { name: /等级预测.*官方/i }).click();
  await page.getByLabel("路线").selectOption("award:caie:9709:2023-2025:al:same-series:AX");
  await page.getByLabel("考季").selectOption("2025-june");
  await page.getByLabel("Option code").selectOption("AX");
  for (const [component, mark] of [["11", "70"], ["31", "70"], ["41", "50"], ["51", "34"]] as const) {
    await page.getByLabel(`9709/${component} 分数`).fill(mark);
  }
  await page.getByRole("button", { name: "计算等级" }).click();
  await expect(page.getByText(/AX.*11, 31, 41, 51/)).toBeVisible();
  await expect(page.getByText("224 / 250")).toBeVisible();
  await expect(page.getByText("A*", { exact: true })).toBeVisible();
});

test("an old estimated link upgrades to an official result", async ({ page }) => {
  const state = {
    version: 1,
    displayedSource: "estimated",
    input: { routeId: "award:aqa:7357:linear", series: "2025-june", estimateConsent: true, scores: [
      { componentCode: "7357/1", series: "2025-june", rawScore: 90 },
      { componentCode: "7357/2", series: "2025-june", rawScore: 85 },
      { componentCode: "7357/3", series: "2025-june", rawScore: 85 },
    ] },
  };
  const award = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  await page.goto(`/#/calculator?award=${award}`);
  await expect(page.getByText("官方边界现已发布")).toBeVisible();
  await expect(page.getByText("官方整体边界 · 已核验")).toBeVisible();
});

test("award URL state follows history, refresh, mobile keyboard and Axe", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openEstimatedTarget(page);
  await page.getByLabel("考季").selectOption("2025-june");
  await page.getByLabel("考季").selectOption("2026-june");
  await page.goBack();
  await expect(page.getByLabel("考季")).toHaveValue("2025-june");
  await page.goForward();
  await page.reload();
  await expect(page.getByLabel("考季")).toHaveValue("2026-june");
  await page.getByLabel("考季").focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).toMatch(/INPUT|BUTTON/);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter(item => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});
```

Extend the existing WJEC E2E assertion to require no calculator link. Wrong CAIE option/variant input is covered at the engine boundary and the UI only renders catalog-backed select values, so arbitrary option text never reaches the calculation call.

- [ ] **Step 2: Run E2E and confirm failures identify missing integration**

Run: `pnpm test:e2e -- e2e/routes.spec.ts`

Expected: new scenarios fail until all selectors, share restore and capability links from Tasks 7–9 are connected; existing route tests continue to pass.

- [ ] **Step 3: Enforce module coverage and CI ordering**

Add to `vitest.config.ts`:

```ts
"src/domain-v2/awards/**": { lines: 95, branches: 90 },
```

Ensure `.github/workflows/ci.yml` runs frozen install, `pnpm data:audit`, `pnpm test:coverage`, production dependency audit, production build/budget, then Playwright. It must upload `generated/data-quality-report.json`, coverage summary and Playwright report when a gate fails.

- [ ] **Step 4: Document product meaning and data rights**

In `README.md`, describe official versus estimated flows and the three supported qualifications. In `DATA_SOURCES.md`, list the exact AQA specification/boundary archive, OCR H240 specification/archive and CAIE 9709 syllabus/threshold-table URLs plus accessed dates and normalized file paths. In `DATA_RIGHTS.md`, state that MIT covers project code but not third-party examination data, marks, specifications or logos; users must follow each examination board's terms.

- [ ] **Step 5: Run the complete local release gate**

Run: `pnpm install --frozen-lockfile && pnpm audit --prod --audit-level=moderate && pnpm test:coverage && pnpm check && pnpm test:e2e`

Expected: production audit has no moderate-or-higher finding; all unit/component/E2E tests PASS; Award coverage ≥95% lines/≥90% branches; data audit has zero Award failures; no bundle budget or Axe blocker.

- [ ] **Step 6: Perform private Sites smoke verification**

Use the `sites:sites-building` and `sites:sites-hosting` skills. Deploy the exact tested commit as a private version, then manually verify AQA official, OCR official, CAIE official, one estimated target, export, old-link upgrade, offline reload and 375px keyboard flow. Record deployment version, URL, commit SHA and retained version-7 rollback reference in the PR body.

- [ ] **Step 7: Verify GitHub/Sites SHA parity and commit the gate**

```bash
git add e2e/routes.spec.ts vitest.config.ts README.md DATA_SOURCES.md DATA_RIGHTS.md .github/workflows/ci.yml
git commit -m "test: gate official and estimated award release"
git rev-parse HEAD
git status --short
```

Expected: `git status --short` is empty; the printed SHA matches the GitHub branch head, Sites deployment metadata and archived build artifact.

---

## Final Acceptance Checklist

- [ ] AQA 7357 uses three 100-mark papers and the same-series 300-mark Overall boundary.
- [ ] OCR H240 uses H240/01–03 and the H240 Overall boundary, never summed component boundaries.
- [ ] CAIE 9709 calculates only exact published option/component/variant combinations.
- [ ] CAIE staged calculation accepts only an official carried-forward mark or verified conversion route.
- [ ] AS never displays A*; A-Level uses only the published overall scale.
- [ ] Estimates use 3–5 comparable official overall samples and deterministic weighted quartiles.
- [ ] Official target data suppresses the matching estimate and upgrades old share links.
- [ ] Official and estimated records remain in separate files, schemas, indexes, badges and exports.
- [ ] Estimated-only capability remains partial/unverified and never inflates verified calculator coverage.
- [ ] Every official record has provenance, source row identity and content hash coverage.
- [ ] All unsafe input, malformed URL/localStorage, missing/duplicate/cross-series Paper and CAIE mismatch cases are rejected with stable public errors.
- [ ] Unit, component, E2E, Axe, coverage, audit, build and bundle gates pass.
- [ ] Private Sites deployment and GitHub branch reference the same tested commit SHA; version 7 remains available for rollback.
