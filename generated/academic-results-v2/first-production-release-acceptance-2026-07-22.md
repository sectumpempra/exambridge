# ExamBridge Academic Results V2 首次生产发布验收

日期：2026-07-22

批准批次：`academic-results-v2-launch-20260722`

发布范围：考试业务事实核验、自由 AI 问答、13 个首批资格的版本化规则与安全计算能力

## 发布结论

本批次满足首次生产发布门槛，可以进入 GitHub PR、`production` 合并与生产监控。

- 13 个资格身份与事实卡均已激活。
- 40 条版本化合分规则覆盖 515/515 个预期规则单元，待补规则与阻断规则均为 0。
- P0 客观事实安全缺口为 0；active 数据冲突为 0。
- 129 条分数线、32 条 Grade Statistics、12 条常见误区记录已进入受审计 active manifest。
- Grade Statistics 是辅助证据，不阻断规则解释或已具备边界证据的计算器。
- 预测分数线、难度指数、个性化过渡和生产联网检索保持关闭。
- Git 跟踪 PDF 数量为 0；静态产物不包含考试材料 PDF。

## 13 个资格的上线能力

正式计算器已开放：

- CAIE 0580
- Pearson 8MA0
- AQA 7357、7367
- OCR H240、H245、H640、6993

规则解释已开放、正式计算器暂不开放：

- CAIE 9709、9231
- Pearson 4MA1
- Pearson IAL Mathematics、IAL Further Mathematics

这 5 个资格的 Paper/Unit 结构、有效组合、carry-forward、resit、cash-in、locking/unlocking 和 A* 等适用规则已经纳入规则矩阵；暂缓计算的原因是当前版本尚无达到发布成熟度的精确 overall boundary，而不是规则缺失。系统必须返回 explain-only 或数据不足，不得猜测最终等级。

## 数据与规则保护

- CAIE 0580 按 2019、2020–2022、2023–2024、2025–2027 四个资格版本选择 Paper 结构。
- CAIE 9709 June 2025 已录入 45 条官方 option 边界，route、option 与 component variants 必须精确匹配。
- CAIE 9709/9231 的 AS、同考季 A Level、staged route 与 carry-forward 分开建模，禁止平均 Paper PUM。
- Pearson 4MA1 严格隔离 Foundation/Higher。
- Pearson IAL Mathematics/Further Mathematics 保存 unit 组合、raw-to-UMS、cash-in、resit/best result、locking/unlocking 与数学 A* 规则。
- 当前 AQA/OCR 线性资格不使用旧模块化 UMS；OCR 6993 严格采用 A–E。
- AQA 原文和表格仅由本地流程处理，未发送外部模型；AI 对 AQA 使用本地确定性模板。

## 自动验收证据

- 数据审计：通过；148 个 JSON，147 组 legacy 冲突与 10 条异常 threshold 已归档，active 未解决冲突 0。
- Knowledge V5：通过；22 个映射、1105 个本体节点。
- 历年试卷目录：通过；10 个目录、1196 个资产，发布产物不含官方 PDF。
- TypeScript、ESLint、生产构建与 bundle budget：通过。
- 单元测试：1048/1048。
- 覆盖率：全局 branches 81.43%；`server/ai` branches 75.79%，均达到门禁。
- E2E：155/155；覆盖 Chromium、Firefox、WebKit、390px 主流程及 320/360/390/768/1024px 横向溢出。
- AI 产物审计：通过；无嵌入密钥或 AQA statement 原文。
- 依赖审计：0 个已知生产依赖漏洞。
- 密钥扫描：860 个跟踪文件通过。
- 部署副本：12/12 场景通过，包括原子切换、失败回滚、持久化 PDF 数量/字节熔断和禁止真实 `exam-materials` 路径覆盖。

## 已知且接受的上线后工作

- 5 个 explain-only 资格补齐精确当前 overall boundary 后，才能单独提升为 calculator-ready。
- 2019 年以来的部分历史分数线仍按 P2 缺口管理，不影响当前规则事实核验。
- 13 个资格仍存在 Grade Statistics P3 辅助缺口，不影响本次规则与 AI 上线。
- `legacy-combined-coverage` 仅保留为迁移快照；新门禁使用分数线、Statistics、规则三张稀疏矩阵。

## 回滚与生产观察

- GitHub Actions 必须使用同一次门禁生成的静态与 AI artifact。
- 静态站由 `production` 生成 `gh-pages`，阿里云同步脚本通过不可变 release 与原子 `current` 链接切换。
- `/var/www/exambridge/shared/exam-materials` 保持 release 目录之外；失败时回滚到上一已验证 release。
- 上线后核对 GitHub Actions、`gh-pages` SHA、线上静态 provenance、AI 健康检查、真实问答引用及持久化 PDF 数量。
