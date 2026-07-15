# Data sources and verification policy

ExamBridge 区分官方修正版、历史导入记录和隔离冲突。页面可展示带“待核验”标记的历史数据，但等级预测只使用完整、可追溯且具有明确 award route 的数据。

## Source families

| 考试局 | 当前内容 | 核验策略 |
| --- | --- | --- |
| AQA | GCSE/A-Level 分数线与数学成绩统计 | 数学官方修正版来自 AQA grade boundaries 页面；其他历史记录待核验 |
| Cambridge International (CAIE) | IGCSE/AS & A-Level thresholds | 已发布的 March 2026 数学记录来自官方 threshold tables；未发布考季不补值 |
| OCR | 分数线与成绩统计 | 2025 官方 PDF 数据保留原始来源 URL；其他记录按状态展示 |
| Pearson Edexcel | GCSE/IGCSE/GCE/IAL 历史边界 | 计算器仅开放已定义完整 IAL Mathematics award route 的数据 |
| WJEC/Eduqas | 成绩统计 | 当前不提供分数线，界面不得暗示完整覆盖 |

## 已验证整体资格路线

以下来源只用于对应的精确路线、考季和 option/component 组合，访问日期均为 2026-07-13：

| 资格 | 路线或结构来源 | 整体边界来源 | 规范化文件 |
| --- | --- | --- | --- |
| AQA A-Level Mathematics 7357 | [AQA 7357 specification](https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-7357-SP-2017.PDF)，第 8–9 页 | [AQA grade boundaries archive](https://www.aqa.org.uk/exams-administration/results-days/grade-boundaries)，2019 June、2020/2021 November、2022–2025 June 的 7357 Overall 行 | `src/data/official/awards/routes.json`；`src/data/official/awards/aqa-7357.json` |
| OCR A-Level Mathematics A H240 | [OCR H240 specification](https://www.ocr.org.uk/Images/308723-specification-accredited-a-level-gce-mathematics-a-h240.pdf)，第 2 页资格结构 | [OCR June 2025 grade boundaries](https://www.ocr.org.uk/Images/739509-as-and-a-level-grade-boundaries-june-2025.pdf)，H240 Overall 行 | `src/data/official/awards/routes.json`；`src/data/official/awards/ocr-h240.json` |
| Cambridge International AS & A Level Mathematics 9709 | [2023–2025 syllabus](https://www.cambridgeinternational.org/Images/597421-2023-2025-syllabus.pdf)，第 10–13 页路线结构 | [June 2025 threshold table](https://www.cambridgeinternational.org/Images/740340-mathematics-9709-june-2025-grade-threshold-table.pdf)，第 2 页 S1、AX、DX 行 | `src/data/official/awards/routes.json`；`src/data/official/awards/caie-9709.json` |

非官方 2026 预估由 `scripts/build-award-estimates.mjs` 从上述已验证整体边界确定性生成到 `generated/estimates/award-boundaries-v1.json`。它不会把单卷 component boundary 当作整体资格边界，也不会跨路线、option、component variant 或考纲版本回退。

官方入口：

- AQA: https://www.aqa.org.uk/exams-administration/results-days/grade-boundaries
- Cambridge International: https://www.cambridgeinternational.org/programmes-and-qualifications/grade-threshold-tables/
- OCR: https://www.ocr.org.uk/administration/results/
- Pearson: https://qualifications.pearson.com/en/support/support-topics/results-certification/grade-boundaries.html
- Pearson IAL Mathematics specification and unit structure: https://qualifications.pearson.com/en/qualifications/edexcel-international-advanced-levels/mathematics-2018.html
- WJEC: https://www.wjec.co.uk/home/administration/results-grade-boundaries-and-prs/

## Validation

`pnpm data:audit` 生成 `generated/data-quality-report.json`，检查 JSON 可解析性、已核验记录主键、阈值范围和次序、成绩统计 entries，并列出历史冲突及所有内容 SHA-256。冲突若无法通过 tier、region、route、option code 或官方行标识区分，会被隔离且不能进入计算器。

Award 专项审计还检查路线 ID 唯一、考试局与资格代码匹配、组成 Paper 与权重、官方来源 URL/发布日期/访问日期/原始行标识/文档哈希、整体门槛单调性、CAIE option 与 supporting threshold 对应关系，以及生成预估的输入清单哈希和内容哈希。

同一命令也会重建 `src/course-context/courseCatalog.generated.json`。课程目录审计检查 ID 唯一、qualification/specification 兼容、功能声明完整、不可用原因存在、WJEC/Eduqas 限制，以及计算器能力必须为已核验状态。

等级不适用在统一 schema 中表示为 `null`。旧导入文件中的 `0` 仅作为迁移前原始值保留，不得解释为真实零分边界。取消、未举行和未发布必须显式标记，禁止推测。

## Rights

项目原创软件代码采用 MIT 许可证；考试数据、考试局名称与商标、官方文档摘录及其衍生结构化记录不包含在该许可证中，权利归相应考试机构或原权利人所有。完整范围与贡献要求见 [DATA_RIGHTS.md](DATA_RIGHTS.md)。
