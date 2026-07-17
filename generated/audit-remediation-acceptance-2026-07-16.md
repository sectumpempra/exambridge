# ExamBridge 审计整改验收报告

日期：2026-07-16

分支：`repair/audit-p0-p1-20260716`

基线：`github/production` `ea00d53`

## 交付结论

审计计划中的 P0–P3 整改已在独立 worktree 完成，并通过本地发布门禁。未推送 GitHub、未生成或更新 `gh-pages`、未触发生产部署，也未读取、复制、删除或提交服务器持久化 PDF。

## 主要整改

- 发布流程改为 `verify → verified artifact → deploy`，数据审计、类型检查、Lint、覆盖率、生产依赖审计、静态构建、bundle budget、核心 E2E 或密钥扫描任一失败都会阻止发布。
- CAIE 0580 Paper 2/4 更新为 2025–2027 结构；Paper 元数据增加生效区间、官方来源和核验状态，并在构建期与 0580/9709 官方快照及 2026 分数线满分交叉检查。
- 812 节点与 21 个映射统一进入 canonical manifest；所有未复核 Paper 映射保持 candidate，Paper 引用覆盖不完整时禁止计算百分比。
- 知识树“展开全部”改为受控状态，可恢复点击前展开集合，并提供原生键盘按钮语义。
- 规划器升级到 V2：每个 Paper 独立周配额、优先级、模式、练习/复盘时间、考季与 variant；无已核验 Question Paper 时不生成虚拟任务；分享 URL 与 localStorage 均执行 schema、范围、数量和体积校验。
- OCR FSMQ 6993 使用独立资格路由与 A*–E 表；等级计算能力在无完整官方路线时保持 unavailable。
- 10 条非单调 CAIE legacy 分数线进入 quarantine；active 表格增加来源、核验日期和发布状态。成绩统计保留原始值、规范化值与原因，并形成复核 candidate 列表。
- 课程别名展示采用代表记录与 capability union；课程目录中不再存在只显示代码的科目名称。
- 历年试卷目录使用 `catalogued / metadata-ready / past-paper-ready / verified` 成熟度；Question Paper 与 Mark Scheme 继续遵守 link-only，零资产目录不会标成可下载就绪。
- PWA 使用构建内容 hash 生成 precache，缓存主 JS/CSS 与静态数据；路由保持懒加载，增加静态 bundle budget 与全局 `prefers-reduced-motion`。
- 计算器无课程上下文时先显示资格路线；函数图提供函数、交点和错误文本摘要；人格测试按版本保存进度；About 统计由课程目录生成；移动导航统一中文无障碍名称。

## 验收结果

| 门禁 | 结果 |
|---|---:|
| 数据审计 | 207 个 JSON；0 个 verified failure；10 条 threshold anomaly 已 quarantine |
| Paper 元数据审计 | 16 条记录；8 个 0580/9709 官方快照通过 |
| 真题目录审计 | 10 个目录；54 个资产；通过 |
| canonical 知识 manifest | 812 节点；21 个 candidate 映射；0 failure |
| TypeScript | 通过 |
| ESLint | 通过 |
| Vitest | 41 个文件，682 项通过 |
| 全局覆盖率 | lines 97.17%，branches 89.91% |
| past-papers 覆盖率 | lines 91.17%，branches 84.09% |
| 静态构建 | 通过；87 个 JavaScript chunks |
| Playwright | desktop + mobile 共 86 项通过 |
| PWA 断网刷新 | 通过 |
| 320/360/390/768px 横向溢出 | 通过 |
| 生产依赖审计 | 0 个已知漏洞 |
| 仓库密钥扫描 | 573 个受跟踪文件；通过 |
| 受跟踪 PDF | 0 |

## 保留约束

- 知识映射当前仍为 candidate，因此 Paper 级相似度按安全策略禁用；这不是验收缺陷。
- 阿里云自动更新脚本和服务器持久化目录未纳入本轮，也没有被操作。
- 未调用 Kimi 将任何候选数据写入 active；后续 Kimi 输出仍须只进入 candidate 并由人工批准。
- 发布需要用户另行明确授权；本报告不构成推送或部署授权。
