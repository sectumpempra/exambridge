# ExamBridge 开发交接文档

> 生成时间：2026-07-10
> 最新提交：`77419fa` (main 分支)
> 仓库：https://github.com/sectumpempra/exambridge

---

## 1. 项目概述

**ExamBridge**（原 GradeMaster）是面向国际学校教师的跨考试局扩科教研平台。

**技术栈**：React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + HashRouter + PWA

**核心功能**：
- 跨考试局考纲对比（整科/Paper级别，基于812节点知识树）
- 独有知识点识别与考纲原文展示
- 独有知识点 Excel 导出（4个sheet）
- 等级预测模拟器（Grade Calculator，支持CAIE/Edexcel/AQA/OCR）
- 刷题规划器（Planner）
- 成绩趋势图

---

## 2. 当前状态

### 构建状态
- `npm run lint` ✅ 全绿
- `npm run build` ✅ 通过
- `tsc -b` ✅ 通过

### 最新提交历史
```
77419fa fix(round5-review): A* pipeline, exact route validation, correctness fixes
b5ca527 fix(round4-review): qualification validation, route gating, data fixes
9dfe6b7 fix(round3-review): qualification rules, data model, planner semantics
ebe3a13 fix(727a173-eval): variant selector UI, OCR 6993 sum, maxMark variantIndex
727a173 fix(e09e175-eval): wire variants into calculator UI, fix OCR 6993, AS/A2, lint
e09e175 fix(postfix-eval): P0/P1/P2 bug fixes from evaluation
15ed2f6 feat: 独有知识点 Excel 导出
600cd83 fix(postfix-review): P0/P1 bug fixes for IAL award rules, component matching
```

---

## 3. 已完成的修复（经5轮评审验证）

### Grade Calculator 核心
- ✅ YMA01 从 4单元/400UMS 改为 6单元/600UMS，A=480
- ✅ 资格验证在 mapGrade 之前执行，不完整 route 不输出 A*-E
- ✅ A* 只能由 checkAStar() 晋升，mapGrade 基础 scale 不含 A*
- ✅ 新规格 YMA01：必须恰好 P1+P2+P3+P4 + 合法 applied pair（M1+M2, S1+S2, M1+S1, M1+D1, S1+D1）
- ✅ 旧规格 C12/C34：恰好 4 组件（C12+C34+2applied），不被 6-unit gate 拦截
- ✅ 新旧规格混选被双向拒绝
- ✅ Variant 选择 UI：多 boundary row 时显示 select + boundary label
- ✅ 无身份 variant 阻断计算（validateInputs 返回错误）
- ✅ Exact duplicate 去重使用 fieldMap 读取实际字段
- ✅ OCR 6993 从 calculator 入口和 subject dropdown 隐藏
- ✅ nextGradeGap 取最近更高等级（不是最高）

### Planner
- ✅ 休息日语义改为全局休息（rest day 不分配任何刷题任务）
- ✅ 每周配额从 per-paperName 改为 per-subjectCode
- ✅ 同科 round-robin 分配

### 数据层
- ✅ Duplicate handling：索引保留 Record[]，getRecordAt 按 variantIndex 选择
- ✅ Edexcel GCSE component aliases（1MA1/1EN0/1ET0 等短 ID 映射）
- ✅ IAL award rule WMA→YMA01 前缀映射
- ✅ AS/A2 分类用显式 label 模式（覆盖 P1-P4, M1-M3, S1-S3, F1-F3, D1, C12/C34）

---

## 4. 仍需修复的问题（按优先级）

### P0：阻断级（影响等级预测正确性）

| # | 问题 | 影响 | 修复方向 |
|---|------|------|----------|
| P0-4 | C12/C34 仍按 100 UMS 计算（实际各 200 UMS） | 旧规格总分、A 阈值、A* 条件全错 | 新建 `UnitRule.maxUMS`，PaperInput 添加 maxUMS，calculateUMS 显式接收 |
| P0-6 | Edexcel 科学科 per-unit UMS 未实现（Physics 120/120/60/120/120/60） | 总等级和 IA2 A* 合计错误 | 同上，需要 qualification-rules.ts |

### P1：重要（影响用户体验或特定场景）

| # | 问题 | 影响 | 修复方向 |
|---|------|------|----------|
| P1-1 | validateQualificationRoute 只验证 WMA，其它科目默认 valid | CAIE 9709 选 1 个 paper 仍输出等级 | 扩展 qualification gating 到所有科目；无规则时降级为 component estimate |
| P1-2 | Planner Edexcel IAL 仍按 unit code 分组 | 6 个 Math units 形成 6 个"科目"，12 套/周 | ExamEvent 增加 qualificationId，配额按 qualificationId |
| P1-3 | Planner 无 daily cap | 多科目时一天 8+ 套卷 | 增加 maxTasksPerDay + 跨日负载均衡 |
| P1-6 | GCSE 完整组件配置未补齐 | AQA/Edexcel GCSE 多数科目只有 1 个 component | 补全 route config 或降级为 component estimate |

### P2：清理

| # | 问题 | 修复方向 |
|---|------|----------|
| P2 | 6993 错误数据仍留在 ocr.json 和 DATA_INDEX | ETL/source 层修正或清除 |

---

## 5. 关键架构决策

### 资格验证流程（Grade Calculator）
```
validateInputs() → [blocked? return error]
validateQualificationRoute() → [invalid? predictedGrade=null, skip mapGrade+checkAStar]
mapGrade() → [only A/B/C/D/E/U, no A*]
checkAStar() → [eligible? promote to A*]
```

### Variant 处理流程
```
getRecordAll() → [exact dedupe via fieldMap]
  → variantCount===1: use variant 0
  → variantCount>1 + has identity: show selector
  → variantCount>1 + no identity: block in validateInputs
```

### IAL Mathematics Route Validator
```
Detect spec family first (hasAnyOld/hasAnyNew)
  → Old: C12+C34+2applied (exactly 4)
  → New: P1+P2+P3+P4+allowedPair (exactly 6)
  → Mixed: reject
```

---

## 6. 关键文件清单

| 文件 | 用途 |
|------|------|
| `src/utils/gradeCalculation.ts` | 计算引擎（PUM/UMS/GNS/A*）+ validateQualificationRoute |
| `src/data/award-rules.ts` | IAL award rule 配置（YMA01） |
| `src/data/calculatorIndex.ts` | 数据索引 + component aliases + getRecordAll/At |
| `src/pages/GradeCalculator.tsx` | Calculator UI + variant selector |
| `src/hooks/usePlanner.ts` | Planner 调度引擎 |
| `src/pages/knowledge-tree/` | 知识树对比页面 |
| `src/utils/exportExclusiveTopics.ts` | Excel 导出工具 |

---

## 7. 如何在新对话中继续

1. **克隆仓库**：`git clone https://github.com/sectumpempra/exambridge.git`
2. **安装依赖**：`npm install`
3. **验证构建**：`npm run lint && npm run build`
4. **查看本文件**：`cat HANDOFF.md`
5. **优先处理**：P0-4（per-unit UMS）是最大 correctness gap

### 推荐的下一步修复顺序
1. P0-4/P0-6：建立 `qualification-rules.ts` + `UnitRule.maxUMS`
2. P1-1：扩展 qualification gating 到所有科目
3. P1-2/P1-3：Planner qualificationId + daily cap
4. P1-6：补全 GCSE component config
5. P2：清理 6993 source 数据
