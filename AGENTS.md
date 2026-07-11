# ExamBridge Agent 工作手册

> 本文件记录当前仓库的 agent 上下文、决策和约束。

## 仓库状态

- **仓库**: https://github.com/sectumpempra/exambridge
- **当前基准 SHA**: `6aa6303`
- **主提示词**: `/mnt/agents/upload/exambridge-v2-master-implementation-prompt.md`
- **重构目标**: 渐进式领域重构 —— 在保留现有产品外壳的前提下，建立可验证的考试数据模型和纯业务引擎，逐步替换旧实现。

## Phase 进展

### Phase 0 ✅
- Vitest 已安装
- 目录结构已创建 (`src/domain-v2/`, `src/adapters-v2/`, `tests/`, `scripts/`, `generated/`)
- Feature flag 系统已建立
- V2 facade 空壳已创建
- Characterization fixtures 已建立

### Phase 1 ✅
- Zod schemas: 14 entity types (Board, Qualification, Specification, Unit, Paper, PaperVariant, Sitting, BoundarySet, AwardRoute, GradingScale, AggregationPolicy, GradePolicy, AStarPolicy, CalculationPolicy)
- Stable ID generator: deterministic, readable, case-fixed
- YMA01 ETL adapter: parseRaw → normalize → link → validate
- Catalog query interface: get/list/resolve + boundary lookup
- ETL pipeline with 6 invariants (all passing)
- Generated: `catalog.json`, `manifest.json`, `qa-report.json`
- 59 tests passing (6 test files)

### Phase 2 ✅
- Calculator Core v2 引擎: `calculateQualification()` 主协调器
- Pearson UMS 策略: 分段线性插值，E boundary 以下 = 0 UMS
- Route 验证器: 7 种 SelectionRule 原语 (REQUIRE_ALL, EXACTLY_N_FROM, AT_LEAST_N_FROM, ONE_OF_GROUPS, MUTUALLY_EXCLUSIVE, TOTAL_UNIT_COUNT, NO_DUPLICATES)
- Grade Mapper: 从高到低评估阈值，nextGrade 指向紧邻更高等级
- A* Checker: 独立于 grade mapping，评估 AStarPolicy 的所有条件
- Calculator Facade: v2/shadow/legacy 三模式，singleton Catalog
- 102 tests passing (9 test files)

### Phase 3 ✅
- Planner Core v2 引擎: `planSchedule()` 纯函数，无 React/随机数
- 确定性 9 步排程算法:
  1. Sort sittings by examDate → qualificationId → paperId
  2. Generate weekly intensity targets (low=1, normal=2, high=3)
  3. Enumerate valid days (before exam, after start, not rest day)
  4. Pick sitting with earliest exam + lowest completion ratio
  5. Assign to lowest-load valid day
  6. Round-robin across papers within same qualification
  7. No PastPaperRef reuse
  8. Optimize uniform distribution
  9. Report unscheduled with reasons
- 7 种未排原因: NO_AVAILABLE_DAY, DAILY_CAPACITY_EXHAUSTED, NO_PAST_PAPER_AVAILABLE, EXAM_ALREADY_PASSED, MISSING_EXAM_DATE, AMBIGUOUS_SITTING, INVALID_CONFIGURATION
- 本地日历语义: 字符串日期比较，避免 UTC 歧义
- qualificationId 分组（非三字符前缀）
- maxTasksPerDay 硬上限
- Facade: legacy/v2 双模式，legacy-to-v2 ExamEvent adapter
- 123 tests passing (10 test files)

### Phase 4 ✅
- Knowledge Tree Loader v2:
  - Zod schemas: KnowledgeTree, MappingFile, KnowledgeManifest, SubjectInfo, OverlapResult
  - Manifest builder script: scans mapping dir, generates manifest.json (34 mappings, 522 nodes)
  - Runtime loader: loadKnowledgeManifest, loadKnowledgeTree, loadMapping, listKnowledgeSubjects
  - Cache: in-flight Promise dedup, clearKnowledgeCache() for testing
  - Tree validator: nodeId uniqueness, parent existence, cycle detection, path consistency
  - Mapping validator: nodeId existence in tree, topic count checks
  - Overlap calculator: pure function, Jaccard (weighted/unweighted), coverage, stable sorted output
- Paper Catalog Adapter v2:
  - searchPapers: by board, qualification, subjectCode, text search, paperType
  - getPaperDetail: paper + variants + qualification name
  - listPaperBoundaries: with series filter
  - listExamSittings: with date range filter
  - comparePapers: same qualification, same unit
- 150 tests passing (12 test files)

### 后续 Phase 计划
- **Phase 5**: 逐 board 扩展及清理

## 约束

1. **必须保留**: `src/App.tsx` 路由、现有页面布局、Header/Footer/PWA、Function Graph、Personality Test、原始 JSON 数据
2. **禁止**: 全仓重写、在 React 组件中解析考试代码/计算成绩、正则猜测业务规则、默认 valid/true/100UMS、一次性删除 legacy 文件
3. **依赖方向**: `raw files -> ETL adapters -> canonical catalog -> pure domain engines -> UI adapters -> existing pages`
4. `domain-v2` 不得 import React、页面组件或旧 `calculatorIndex.ts`

## Feature Flags

通过环境变量控制，默认均为 `legacy`：

```
VITE_CALCULATOR_ENGINE=legacy|v2|shadow
VITE_PLANNER_ENGINE=legacy|v2
VITE_CATALOG_SOURCE=legacy|v2
```

## 新增目录结构

```
src/domain-v2/          # 纯业务引擎 (无 React 依赖)
  catalog/              # Canonical Exam Catalog
  calculator/           # Grade Calculator Core v2
  planner/              # Planner Core v2
  knowledge-tree/       # Knowledge Tree Loader v2
  papers/               # Paper Catalog Adapter v2
  shared/               # SourceRef, types, utils
src/adapters-v2/        # 适配层
  legacy-data/          # 旧数据适配器
  ui/                   # UI facade
tests/                  # 测试
  fixtures/             # Characterization fixtures
scripts/catalog/        # ETL 脚本
generated/catalog-v2/   # 生成产物
```
