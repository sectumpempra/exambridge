# ExamBridge 官方资格路线与非官方预估等级设计

日期：2026-07-12

## 1. 目标

为 ExamBridge 增加 AQA、OCR 与 CAIE 数学资格的整体等级计算，同时严格区分两种结果：

1. **官方等级计算**：资格结构、组件组合、权重和该考季整体分数线均可由考试局资料完整重建。
2. **非官方预估等级**：资格结构已经官方确认，但目标考季的整体分数线尚未发布；系统仅根据可比较的历史整体分数线给出统计区间。

官方与预估数据必须使用不同类型、目录、能力状态和视觉标识。预估记录不得进入官方数据覆盖率、官方计算结果或官方能力声明。

## 2. 首批范围

首批只实现以下 A-Level 数学资格：

- AQA A-Level Mathematics 7357
- OCR A-Level Mathematics A H240
- Cambridge International AS & A-Level Mathematics 9709

第二批候选为 AQA GCSE Mathematics 8300、OCR GCSE Mathematics J560、CAIE IGCSE Mathematics 0580 和 CAIE International Mathematics 0607。本设计不实现第二批，也不扩展物理、化学或其他科目。

## 3. 非目标

- 不预测尚未举行考试的真实官方分数线。
- 不使用大语言模型生成边界或等级。
- 不用单卷的 notional/component boundary 代替线性资格整体边界。
- 不平均 Paper 等级、PUM 或百分比来生成 CAIE syllabus grade。
- 不在缺少 route、option、component、variant、满分或至少三个可比历史考季时提供预估。
- 不改变 Edexcel IAL Mathematics 现有已验证 UMS 路线。

## 4. 官方来源

### AQA 7357

- Specification：https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-7357-SP-2017.PDF
- Grade boundaries：https://www.aqa.org.uk/exams-administration/results-days/grade-boundaries
- 历史边界：https://www.aqa.org.uk/exams-administration/results-days/grade-boundaries/archive

AQA 7357 包含 Paper 1、Paper 2、Paper 3，每卷 100 分、scaling factor 为 1，总分 300。最终等级由三卷原始分总和与考季的 qualification-level boundary 比较。单卷 notional boundaries 只用于解释表现，不是单卷正式等级。

### OCR H240

- Specification：https://www.ocr.org.uk/Images/308723-specification-accredited-a-level-gce-mathematics-a-h240.pdf
- Grade boundaries archive：https://www.ocr.org.uk/administration/grade-boundaries/grade-boundaries-archive/grade-boundaries-archive.aspx

OCR H240 要求 H240/01、H240/02、H240/03 全部参加；每卷 100 分、各占三分之一，总分 300。最终等级使用对应考季 `H240 Overall` 边界。

### CAIE 9709

- 2026–2027 syllabus：https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf
- Grade threshold tables：https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/grade-threshold-tables/
- June 2025 9709 threshold table：https://www.cambridgeinternational.org/Images/740340-mathematics-9709-june-2025-grade-threshold-table.pdf

CAIE 9709 必须按照 syllabus 中的 AS-only、staged A-Level 或同考季 A-Level 路线选择组件，并使用考季 threshold table 中与 option code 和 component variants 完全对应的组合边界。系统使用 `maximum mark after weighting` 和官方整体组合 thresholds，不从单个 component threshold 推导整体等级。

## 5. 领域模型

```ts
type AwardBoundarySource = "official" | "estimated";

type OfficialAwardRoute = {
  id: string;
  board: "AQA" | "OCR" | "CAIE";
  qualificationCode: "7357" | "H240" | "9709";
  level: "A-Level" | "AS-Level";
  specificationVersion: string;
  routeType: "linear" | "same-series" | "staged";
  routeKey: string;
  optionCode?: string;
  components: Array<{
    code: string;
    inputKind: "raw" | "carried-forward";
    maxRawMark: number;
    weightingFactor: number;
  }>;
  maximumMarkAfterWeighting: number;
  roundingRule: "none" | "nearest-integer" | "official-carry-forward";
  grades: string[];
  sourceUrl: string;
  publishedAt?: string;
  accessedAt: string;
  verificationStatus: "verified";
};

type OfficialAwardBoundary = {
  source: "official";
  routeId: string;
  series: string;
  optionCode?: string;
  componentVariants: string[];
  maximumMarkAfterWeighting: number;
  thresholds: Record<string, number>;
  sourceUrl: string;
  sourceRowId: string;
  publishedAt: string;
  accessedAt: string;
  verificationStatus: "verified";
};

type EstimatedAwardBoundary = {
  source: "estimated";
  methodVersion: "historical-weighted-median-v1";
  routeId: string;
  targetSeries: string;
  optionCode?: string;
  componentVariants: string[];
  maximumMarkAfterWeighting: number;
  sampleSeries: string[];
  sampleSize: number;
  thresholds: Record<string, {
    centre: number;
    lower: number;
    upper: number;
  }>;
  confidence: "high" | "medium" | "low";
  dataAsOf: string;
  inputManifestHash: string;
  isOfficial: false;
};
```

`OfficialAwardBoundary` 保存在官方数据目录；`EstimatedAwardBoundary` 由构建脚本生成到独立的 `generated/estimates` 目录。页面不能通过联合数组或默认回退把预估记录当作官方记录。

## 6. 官方计算策略

### 6.1 AQA 7357

1. 要求同一考季的 Paper 1、2、3。
2. 每卷分数必须为 0–100，禁止缺卷、重复卷或跨考季。
3. `totalRaw = paper1 + paper2 + paper3`。
4. 使用相同考季、资格代码 7357、总分 300 的官方整体边界。
5. 如果只有单卷 notional boundary 而没有整体边界，官方计算不可用。

### 6.2 OCR H240

1. 要求同一考季 H240/01、H240/02、H240/03。
2. 每卷分数必须为 0–100。
3. `totalRaw = component01 + component02 + component03`。
4. 使用相同考季 `H240 Overall`、总分 300 的官方边界。
5. 不累加三个 component boundaries 生成整体边界。

### 6.3 CAIE 9709

1. 用户先选择 AS/A-Level、same-series/staged 和官方 option code。
2. 组件及 variants 必须与目标考季官方组合完全一致。
3. 每个 component raw mark 先乘官方 weighting factor。
4. 按路线记录中有官方来源的 `roundingRule` 形成 weighted total；找不到舍入或 carry-forward 规则时拒绝计算，不采用默认猜测。
5. weighted total 与该 option 的官方整体 thresholds 比较。
6. staged route 必须验证 carry-forward 状态、允许的考季跨度和 syllabus 兼容性。用户必须输入官方结果材料中的 carried-forward mark，或者系统必须具备可核验的官方换算记录；不得把上一考季各 Paper 原始分直接当作 carried-forward mark。缺少这些信息时拒绝计算。
7. A* 只在 A-Level 整体组合边界中使用；AS Level 只允许 a–e。

## 7. 非官方预估算法

### 7.1 启用条件

只有在以下条件全部满足时生成预估：

- `OfficialAwardRoute` 已核验；
- 目标考季尚无对应官方整体边界；
- 历史样本与 board、qualification code、level、specification version、route key 和 grading scale 相同；
- CAIE 样本的 option code、组件类型和 variant 组合可证明一致；
- 历史整体边界样本不少于 3 个、不多于最近 5 个；
- 所有样本都有 `maximum mark after weighting` 和官方来源。

目标考季已存在官方整体边界时，不生成也不展示预估。

### 7.2 标准化

对每个历史考季和等级计算：

```text
boundaryPercentage = officialThreshold / maximumMarkAfterWeighting
```

禁止使用 component boundary、单卷 notional boundary、Paper grade 或 PUM 作为历史样本。

### 7.3 中心值与区间

- 使用最近最多 5 个可比考季。
- 最近到最早的权重依次为 `n, n-1, ..., 1`。
- 考季按官方考试日期排序；日期相同则按稳定 series ID 排序，确保生成结果可复现。
- 每个等级的中心百分比使用加权中位数。
- 下界与上界使用历史百分比的加权 25% 和 75% 分位数。加权分位数定义为：按百分比升序排列，选择累计权重首次达到总权重 `q` 的样本；`q` 分别取 0.25、0.5 和 0.75。
- 百分比乘目标路线的 `maximumMarkAfterWeighting` 后，中心值四舍五入到整数；区间向外取整。
- 各等级中心值和区间必须保持从高等级到低等级单调递减；违反时整组预估作废，不做自动平滑或猜测修正。

### 7.4 置信度

置信度取所有已发布等级中最弱的一档：

- `high`：5 个同 specification、同 route 的样本，所有等级的四分位宽度不超过 3 个百分点。
- `medium`：至少 3 个同 specification、同 route 的样本，所有等级的四分位宽度不超过 6 个百分点。
- `low`：至少 3 个合法样本，但任一等级的四分位宽度超过 6 个百分点，或需要跨季节比较。

少于 3 个样本、跨 specification、跨 route 或 CAIE option 不兼容时，不输出预估。

### 7.5 预估结果

- 中心等级：使用中心 thresholds 判定。
- 不确定等级范围：分别使用区间的宽松和严格边界判定。
- 如果用户分数处于边界区间内，界面显示例如“中心预估 A，合理范围 A–B”，不得只显示单一确定等级。

## 8. 页面与交互

### 官方结果

- 绿色“官方整体边界 · 已核验”标识。
- 显示资格、考季、route、option、组件、总分、整体边界和官方来源。
- AQA/OCR 单卷 notional boundary 可作为说明信息，但必须标记“仅供单卷表现参考”。

### 预估结果

- 琥珀色“非官方预估等级”标识，不能使用“官方”“已核验”图标。
- 固定显示中心等级、合理等级范围、预计边界区间、置信度、样本考季和算法版本。
- 固定警告：`此结果基于历史整体分数线的统计预估，不是考试局正式成绩或官方分数线。`
- 用户必须主动勾选“我理解这是非官方预估”后才能计算。
- 分享 URL、截图、CSV、Excel 和打印结果必须保留“非官方预估”、置信度与样本信息。

### 自动替换

官方数据发布并通过审计后：

1. 相同 route/series/option 的预估入口自动隐藏。
2. 旧分享链接打开时改用官方结果，并显示“官方边界现已发布”。
3. 旧预估记录仅用于可复现审计，不再用于页面计算。

## 9. 能力状态

课程能力增加等级计算模式：

```ts
type GradeCalculationAvailability =
  | { status: "official"; routeIds: string[] }
  | { status: "estimated"; routeIds: string[]; disclaimerRequired: true }
  | { status: "unavailable"; reason: string };
```

`estimated` 不得提升现有 `verificationStatus`，也不得使课程在“已验证计算器”统计中变为可用。课程中心分别展示“官方等级计算”“非官方预估”和“不可用”。

## 10. 失败与安全策略

- 输入使用 Zod 校验；拒绝负分、超分、NaN、Infinity、缺卷和重复卷。
- route、option、variant、series 和 specification 必须使用目录中的稳定 ID，不能接受任意文本回退。
- 本地存储与分享状态设置长度限制和 schema 版本。
- 生产错误只显示统一错误代码，不暴露底层路径或解析异常。
- 官方数据解析失败、来源缺失或哈希变化时，构建失败。
- 预估生成失败只禁用相应预估，不影响官方计算器和其他课程。
- 预估算法必须是确定性的：相同输入、数据清单和版本产生相同输出与内容哈希。

## 11. 数据审计

官方路线和边界新增审计：

- route ID、series/option 主键唯一；
- 组件组合与 specification 一致；
- component mark、weighting 和整体满分一致；
- 整体边界单调、非负且不超过满分；
- AQA/OCR 必须使用 qualification-level/Overall 行；
- CAIE 必须存在 option code、组合 components 和 maximum mark after weighting；
- 来源 URL、发布日期、访问日期和原始行标识完整。

预估审计：

- 不少于 3 个唯一官方历史样本；
- 不引用 estimated 样本进行二次预测；
- 比较键完全一致；
- 中心值与区间单调且在满分范围内；
- 方法版本、样本列表、确定性的 `dataAsOf`、输入清单哈希和内容哈希完整；
- 相同目标存在官方边界时预估不得发布到页面索引。

## 12. 测试与验收

### 单元测试

- AQA 7357 和 OCR H240 三卷合分及每个等级边界的 `-1 / exact / +1`。
- CAIE AS、same-series A-Level 和 staged A-Level 的合法组合。
- CAIE 错误 option、variant、carry-forward 和 syllabus 组合拒绝。
- 缺卷、重复卷、跨考季、负分、超分和非数字输入拒绝。
- 预估加权中位数、加权分位数、向外取整和置信度。
- 少于 3 个样本、跨 specification/route 和非单调预估拒绝。
- 官方边界出现后停用同目标预估。

### Golden tests

- AQA specification 与官方整体 boundary 样例。
- OCR H240 specification 与官方 `Overall` 样例。
- CAIE 9709 syllabus 路线与官方 option threshold 样例。
- Golden fixture 必须保存来源 URL、文档版本和原始页/行标识。

### 组件与 E2E

- 官方结果、预估结果和不可用三种状态。
- 预估免责声明确认流程。
- 分享链接、前进/后退、刷新和localStorage恢复。
- 导出、打印和截图保留非官方标识。
- 官方数据发布后旧预估链接升级为官方结果。
- 桌面、平板、375px手机和键盘操作。
- Axe 不得出现 serious/critical 问题。

### 发布门禁

- 继续满足现有安全审计、数据审计、覆盖率、E2E和bundle预算。
- 新增路线与预估核心模块行覆盖率至少 95%、分支覆盖率至少 90%。
- 首批只部署私有灰度；人工回归三种考试局后再决定是否公开。

## 13. 迁移与发布

1. 在独立功能分支实现，不直接修改 `main`。
2. 先引入类型、官方路线和审计，不立即开放入口。
3. 导入并逐行核验 AQA 7357、OCR H240、CAIE 9709 官方整体边界。
4. 通过 golden tests 后开放官方计算。
5. 再加入独立预估生成器和免责声明交互。
6. 私有 Sites 灰度验证官方、预估、数据升级和分享链接。
7. GitHub、Sites归档和部署继续绑定同一提交 SHA。

## 14. 成功标准

- 三个首批资格均能从官方结构和整体边界重建最终等级。
- AQA/OCR 不再使用单卷边界累加或假UMS逻辑。
- CAIE 不再使用Paper PUM平均或未验证组件组合。
- 尚未发布的考季只有在满足严格样本条件时才显示非官方预估。
- 用户在页面、分享和导出中无法把预估误认为官方结果。
- 官方数据一经发布，系统确定性地替换相同目标的预估结果。
