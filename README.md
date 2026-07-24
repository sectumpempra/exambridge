# ExamBridge

面向国际课程教师的可审计考试数据与教研工具。

ExamBridge 将分散在不同考试局、资格和考季中的公开考试信息整理为具有来源、核验状态和发布边界的统一课程目录，帮助教师查询分数线与成绩统计、检索试卷、比较考纲、规划刷题，并在官方路线完整时进行保守的等级预测。

> ExamBridge is an open-source, TypeScript-based teaching and exam-data platform for international curricula. It prioritizes source provenance, explicit verification status, reproducible audits, and conservative grade calculations.

## 当前能力

| 模块 | 作用 | 发布边界 |
| --- | --- | --- |
| 课程中心 | 按阶段、考试局、资格、科目和学科类别检索课程 | 版本化目录当前包含 720 门课程 |
| 分数线 | 查询不同考试局与考季的等级门槛 | 已核验和待核验记录明确区分 |
| 成绩统计 | 查看等级分布和群体表现 | WJEC/Eduqas 当前仅开放此类数据 |
| Paper 中心 | 检索试卷、连接课程与考纲，并进入已核验历年材料 | 10 门数学课程已接入试点；4MA1、YMA01 暂为官方入口，其余 8 门已有逐份记录；默认跳转考试局官方文件 |
| 考纲对比 | 比较知识树、课程与相关 Paper | 不根据相似名称猜测课程映射 |
| 等级预测 | 按正式 award route 计算或明确标注地预估等级 | 官方模式支持 AQA 7357、OCR H240、CAIE 9709 及原有 Edexcel IAL Mathematics；预估模式只用于已验证路线且官方目标考季尚未发布时 |
| 教学工具 | 刷题规划、函数画图、二维力学和空间向量实验室 | 实验室计算使用确定性求解器；本地场景只保存在浏览器中 |

待核验记录不会进入等级预测。尚未发布、未举行或取消的考季保持缺失，不生成推测值；无法唯一识别的冲突记录进入隔离报告。

## 官方结果与非官方预估

等级预测严格区分两种结果，二者使用不同的数据记录、标识和导出文案：

- **官方整体边界 · 已核验**：使用考试局发布的整体资格路线与对应考季 overall threshold。AQA 7357 按三张 100 分试卷合计，OCR H240 按 H240/01–03 合计，CAIE 9709 只接受官方 option code 与 component variant 的精确组合；CAIE staged 路线只接受正式 carried-forward mark。
- **非官方预估等级**：仅在同一已验证路线拥有 3–5 个可比官方整体边界、但目标考季尚无官方边界时提供。用户必须主动确认；结果显示合理范围、置信度、样本考季、算法版本和固定警告，不代表考试局正式成绩。

分享链接只保存通过 schema 校验的路线、考季、Paper 分数、同意状态和显示来源，不保存分数线或计算结果。打开链接时系统会用当前数据重新计算；如果官方边界后来发布，旧预估链接会自动升级为官方结果并明确提示。

## 产品与数据架构

- React 19、TypeScript、HashRouter
- Vite 静态生产构建；保留 Next/vinext 兼容构建
- Zod schema、版本化课程目录和构建期数据审计
- Vitest 单元/组件测试与 Playwright 浏览器回归测试
- PWA、本地课程上下文、CSV/Excel 安全导出
- 无 D1、R2、用户账号或第三方遥测；浏览器存储仅保存本地偏好

核心目录：

- `src/pages`：正式路由页面
- `src/course-context`：课程目录、能力声明、上下文恢复与紧凑索引
- `src/domain-v2/awards`：官方整体资格路线、非官方预估、分享恢复与来源证明
- `src/domain-v2/past-papers`：历年材料 schema、课程映射、配套文件关联与安全链接解析
- `src/features/vector-geometry-lab`：空间向量 schema、精确求解器、解释模型与懒加载三维渲染层
- `src/pages/vector-geometry-lab`：16 个教学场景、坐标编辑、场景存储和导出界面
- `src/domain-v2` 其他目录：计算领域模型与资格策略
- `src/adapters-v2`：旧数据转换与统一适配
- `src/data/official`：已核验官方修正版
- `src/data/canonical`：统一数据 schema
- `scripts/build-course-catalog.mjs`：生成版本化课程目录
- `scripts/audit-data.mjs`：审计来源、唯一性、阈值、冲突与内容哈希
- `scripts/audit-past-papers.mjs`：审计真题目录、权利状态、官方域名、托管许可与唯一 ID
- `generated/data-quality-report.json`：可复现的数据质量清单

历年材料按课程拆分在 `public/data/past-papers`。自动采集只能写入
`data/candidates/past-papers` 并生成差异报告；候选记录不能自动发布。只有
`distributionStatus: hosting-permitted` 且具备明确许可依据的文件才允许使用
服务器持久化 `/exam-materials/` 路径，其他公开材料只链接考试局官网。

全局课程上下文只保存资格和考纲版本，通过 `course`、`spec` URL 参数分享。考季、tier、region、Paper 和 award route 仍由各功能页面单独管理。无效或不兼容的课程 ID 会被安全忽略，不会回退到名称相似的资格。

## 本地开发

需要 Node.js 22.13 或更高版本，并使用仓库中的 pnpm 锁文件。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

完整发布检查：

```bash
pnpm audit --prod --audit-level moderate
pnpm check
pnpm test:coverage
pnpm test:e2e
```

`pnpm check` 包含课程目录生成、数据审计、TypeScript、ESLint、单元测试、生产构建和产物预算检查。CI 还会执行浏览器测试与凭据扫描。
Vector Geometry Lab 另有 `pnpm test:vector-geometry:coverage` 门禁，覆盖 88 个独立 Gold Cases、四层模块和教学界面。

## 数据治理

ExamBridge 记录数据来源 URL、访问日期、核验状态和可重建的质量报告。无法通过 tier、region、route、option code 或官方行标识消除的歧义不会进入计算器。

- 来源、覆盖与核验规则：[DATA_SOURCES.md](DATA_SOURCES.md)
- 第三方数据权利边界：[DATA_RIGHTS.md](DATA_RIGHTS.md)
- 安全报告与凭据规范：[SECURITY.md](SECURITY.md)
- 贡献流程：[CONTRIBUTING.md](CONTRIBUTING.md)

## 发布策略

1. 在功能分支或本地完成变更，并通过数据审计、类型、测试和生产构建门禁。
2. 获得明确发布确认后推送 `production`；GitHub Actions 构建静态站并生成 `gh-pages`。
3. 生产服务器定时拉取新的 `gh-pages` 提交，创建不可变 release 并切换 `current` 链接。
4. `/var/www/exambridge/shared/exam-materials` 是独立持久化目录，每次切换 release 时重新链接；发布不得删除或覆盖它，也不得将其中 PDF 重新提交到 GitHub。

## 许可证

本项目原创软件代码采用 [MIT License](LICENSE)。MIT 许可证不覆盖仓库中的第三方考试数据、考试局名称与商标、课程和试卷元数据、官方文档摘录或其衍生结构化记录；这些内容的权利仍归相应考试机构或原权利人所有，详见 [DATA_RIGHTS.md](DATA_RIGHTS.md)。

ExamBridge 与 AQA、Cambridge International、OCR、Pearson Edexcel、WJEC/Eduqas 不存在隶属或官方认可关系。
