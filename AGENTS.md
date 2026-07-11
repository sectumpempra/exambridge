# ExamBridge Agent 工作手册

> 本文件记录当前仓库的 agent 上下文、决策和约束。

## 仓库状态

- **仓库**: https://github.com/sectumpempra/exambridge
- **当前基准 SHA**: `6aa6303`
- **主提示词**: `/mnt/agents/upload/exambridge-v2-master-implementation-prompt.md`
- **重构目标**: 渐进式领域重构 —— 在保留现有产品外壳的前提下，建立可验证的考试数据模型和纯业务引擎，逐步替换旧实现。

## Phase 进展

### Phase 0 (进行中)
- Vitest 已安装
- 目录结构已创建 (`src/domain-v2/`, `src/adapters-v2/`, `tests/`, `scripts/`, `generated/`)
- Feature flag 系统已建立
- V2 facade 空壳已创建
- Characterization fixtures 已建立

### 后续 Phase 计划
- **Phase 1**: Catalog 基础 (schema, ETL, QA)
- **Phase 2**: Calculator v2 首个纵切片 (Pearson Edexcel IAL Mathematics YMA01)
- **Phase 3**: Planner v2
- **Phase 4**: Paper/Knowledge 数据访问迁移
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
