# Knowledge V5 概念核算修复审批包

批次：`knowledge-v5-concept-accounting-20260723`

来源 active 批次：`knowledge-v5-20260719`

状态：已获 owner approval，并已仅在本地激活；尚未推送或部署。

## 修复目标

本批次修复“考纲原文、notes 或 examples 已明确考查某概念，但 Knowledge V5 concept links 遗漏，导致知识树比较或 AI 回答错误”的系统性问题。硬性回归案例是 CAIE 0580 Extended 的 collinearity。

## 审查范围与结果

- 22/22 个资格映射全部重新核算。
- 5,519 条 statement、9,843 条候选 concept links 通过完整性审计。
- 新增 1,382 条 concept links，移除 601 条错误或范围过宽的 links。
- 新增 35 个必要的 ontology 叶节点；candidate ontology 共 1,140 个节点。
- 重复 link：0。
- 最终未决 statement：0。
- owner-approved 门禁额外发现并补齐 6 条可考核但零映射的 statement；active 零映射数量为 0。
- AQA 外部原文传输：0；4 门 AQA 共 591 条 assessable statements 全部本地处理。
- CAIE 0580 `E7.4-4` 已同时映射 vector application、parallel vectors、collinearity、ratios on line segments。

## 各资格修正量

| 资格版本 | 新增 links | 移除 links |
|---|---:|---:|
| AQA 7357 | 85 | 14 |
| AQA 7367 | 46 | 25 |
| AQA 8300 | 18 | 2 |
| AQA 8365 | 5 | 0 |
| CAIE 0580 | 105 | 41 |
| CAIE 0606 | 37 | 6 |
| CAIE 9231 | 26 | 5 |
| CAIE 9709 | 47 | 23 |
| Pearson 1MA1 | 77 | 32 |
| Pearson 4MA1 | 53 | 26 |
| Pearson 4PM1 | 11 | 2 |
| Pearson 8MA0 | 36 | 6 |
| Pearson 9FM0 | 71 | 24 |
| Pearson 9MA0 | 76 | 29 |
| Pearson IAL Mathematics | 87 | 16 |
| OCR 6993 | 13 | 6 |
| OCR H240 | 91 | 28 |
| OCR H245 | 61 | 25 |
| OCR H640 | 97 | 19 |
| OCR J560 | 73 | 39 |
| WJEC 3300 legacy | 143 | 131 |
| WJEC C00-4968-0 V5 | 112 | 102 |

## 机器协作与复核

- 第一轮：734/734 批完成，4,348 条 statement 被审查。
- 第二轮高风险独立复核：456/456 批完成，1,367 条 statement 被复核。
- 残余最高置信度线索复核：131/131 批完成，465 个候选中接受 47、拒绝 418、未决 0。
- 并发从低位逐步提升到 24；第二轮和残余复核均无失败。
- 第一轮 usage journal 保留 134 次早期本地网络错误及 20 次格式重试；这些失败没有形成候选数据，最终 734 个任务均取得已校验结果。
- 第二轮和残余复核返回模型均为 `deepseek-v4-pro`。
- DeepSeek 只生成 candidate 和复核建议；最终纳入、移除、ontology 新增及 52 条机器未决项均由 Codex 确定性审计或本地逐条裁决。

## 产品修复

- AI 在未选择 Paper 时也会按用户问题检索最多 16 条 owner-approved 官方 statement、notes 和 examples。
- 查询匹配会结合 ontology definition、aliases、object scopes 和 inclusions；collinearity、symmetry 等常见变体会归一化。
- 查询命中的官方 example 被视为其 tier、route 和 Paper 范围内的正面证据。
- 查询子集没有命中不再被当作“不考”的证据。
- AQA 官方原文仍不会进入外部模型上下文。
- 知识树加入明确颜色图例和读屏标签，灰色表示“节点存在，但当前两个资格均未覆盖”。

## 验收结果

- Candidate integrity audit：通过。
- 0580 collinearity 硬性回归：通过。
- 0580/4MA1 symmetry 等价回归：通过。
- 数据审计：通过。
- TypeScript、ESLint：通过。
- Vitest：74 个文件、1,134 项测试全部通过。
- AI build/audit：通过。
- 静态生产构建与 release audit：通过。
- Playwright 知识树桌面与 390px：4/4 通过。
- 密钥扫描：通过。
- tracked PDF：0。
- 生产依赖审计：0 个高危或严重漏洞，1 个低危漏洞。

## 激活结果

- Active 批次：`knowledge-v5-concept-accounting-20260723`。
- Active 数据：22 个资格、5,519 条 statement、9,855 条 concept links、1,140 个 ontology 节点。
- 所有 active mapping、statement 和 ontology node 均为 `owner-approved`。
- GitHub 推送、PR、合并和生产部署仍未授权，也未执行。

回滚点继续保留为 active 批次 `knowledge-v5-20260719`。
