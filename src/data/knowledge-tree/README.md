# ExamBridge 统一知识树成果包

> 生成日期：2026-07-04
> 版本：v3.0

---

## 成果概览

| 指标 | 数值 |
|------|------|
| 知识树总节点 | **1,670** |
| A-Level 数学节点 | 597 |
| A-Level 高数节点 | 622 |
| GCSE 数学节点 | 377 |
| GCSE 高数节点 | 69 |
| 考纲科目数 | **19**（5 考试局） |
| Mapping 文件数 | **21** |
| Overlap 文件数 | **29** |

---

## 目录结构

```
exambridge-output/
├── knowledge-trees/          # 统一知识树（4棵独立 + 1棵合并）
│   ├── knowledge-tree-phase1-alevel-math.json    # A-Level 数学 (597节点)
│   ├── knowledge-tree-phase2-alevel-fm.json      # A-Level 高数 (622节点)
│   ├── knowledge-tree-phase3-gcse-math.json      # GCSE 数学 (377节点)
│   ├── knowledge-tree-phase3-gcse-fm.json        # GCSE 高数 (69节点)
│   └── unified-knowledge-tree.json               # 统一合并版 (1670节点)
│
├── syllabi/                  # 结构化考纲 (19个科目)
│   ├── syllabus-CAIE-9709.json       # CAIE A-Level Math
│   ├── syllabus-CAIE-9231.json       # CAIE A-Level Further Math
│   ├── syllabus-CAIE-0580.json       # CAIE IGCSE Math
│   ├── syllabus-CAIE-0606.json       # CAIE IGCSE Additional Math
│   ├── syllabus-Edexcel-9MA0.json    # Edexcel GCE A-Level Math
│   ├── syllabus-Edexcel-8MA0.json    # Edexcel AS Math
│   ├── syllabus-Edexcel-YMA01.json   # Edexcel IAL Math
│   ├── syllabus-Edexcel-9FM0.json    # Edexcel GCE Further Math
│   ├── syllabus-Edexcel-YFM01.json   # Edexcel IAL Further Math
│   ├── syllabus-Edexcel-1MA1.json    # Edexcel GCSE Math
│   ├── syllabus-Edexcel-4MA1.json    # Edexcel IGCSE Math
│   ├── syllabus-AQA-7357.json        # AQA A-Level Math
│   ├── syllabus-AQA-7367.json        # AQA A-Level Further Math
│   ├── syllabus-AQA-8300.json        # AQA GCSE Math
│   ├── syllabus-AQA-8365.json        # AQA L2 Further Math
│   ├── syllabus-OCR-H240.json        # OCR A-Level Math
│   ├── syllabus-OCR-H245.json        # OCR A-Level Further Math
│   ├── syllabus-OCR-J560.json        # OCR GCSE Math
│   └── syllabus-WJEC-3300.json       # WJEC Math
│
├── mappings/                 # 考纲 -> 知识树映射
│   ├── alevel-math/          # A-Level 数学 (7个科目)
│   ├── alevel-fm/            # A-Level 高数 (6个科目)
│   └── gcse/                 # GCSE (8个科目)
│
├── overlaps/                 # 跨考试局重合度
│   ├── alevel-math/          # A-Level 数学横向对比
│   ├── alevel-fm/            # A-Level 高数横向对比
│   └── cross-stage/          # 跨学段对比 (GCSE vs A-Level)
│
└── logs/                     # 执行日志
    ├── log-phase-1.md        # Phase 1 执行日志
    ├── log-phase-2-3.md      # Phase 2-3 执行日志
    └── fm-assessment.md      # FM 知识树评估报告
```

---

## 知识树结构

### 四级层次

| 层级 | 名称 | 说明 |
|------|------|------|
| L1 | Domain | 大领域 (Algebra, Statistics, Mechanics...) |
| L2 | Area | 子领域 (Quadratics, Hypothesis Testing...) |
| L3 | Topic | 知识点 (Completing the Square, t-Test...) |
| L4 | Skill | 细分技能 |

### 命名规范

| 学段 | Domain 前缀 | 示例 |
|------|------------|------|
| GCSE 数学 | `NUM-`, `ALG-`, `TRIG-`, `PROB-`, `STAT-`... | `ALG-EQN-QUAD` |
| GCSE 高数 | `GFM-*` | `GFM-CALC-DIFF` |
| A-Level 数学 | `PURE-`, `STAT-`, `MECH-` | `PURE-ALG-QUAD` |
| A-Level 高数 | `FPURE-`, `FSTAT-`, `FMECH-`, `DEC-` | `FPURE-CN-DEMOIVRE` |

---

## Mapping 格式

每个 mapping 文件包含：

```json
{
  "topicId": "CAIE-9709-P1-1",
  "topicName": "Quadratics",
  "topicCategory": "Pure Mathematics 1",
  "paperReference": "P1",
  "mappedNodes": [
    {
      "nodeId": "PURE-ALG-QUAD",
      "matchStrength": "strong",
      "matchReason": "考纲 topic 覆盖 quadratic solving methods"
    }
  ]
}
```

matchStrength: `exact` (1.0) / `strong` (0.7) / `partial` (0.3)

---

## Overlap 格式

每个 overlap 文件包含：

```json
{
  "pairId": "CAIE-9709_vs_EDX-9MA0",
  "treeCoverage": { "totalNodes": 597, "aCovered": X, "bCovered": Y },
  "overlapScores": {
    "unweighted": 0.85,
    "weighted": 0.78
  },
  "aOnly": [...],
  "bOnly": [...],
  "partialOverlap": [...]
}
```

---

## Edexcel 代码说明

| 代码 | 全称 | 类型 |
|------|------|------|
| **9MA0** | GCE A-Level Mathematics | 英国本土版 (Linear) |
| **8MA0** | GCE AS Level Mathematics | 英国本土版 AS |
| **YMA01** | IAL A-Level Mathematics | 国际版 (Modular) |
| **9FM0** | GCE A-Level Further Mathematics | 英国本土版 |
| **YFM01** | IAL A-Level Further Mathematics | 国际版 |
| **1MA1** | GCSE Mathematics (9-1) | 英国本土 GCSE |
| **4MA1** | IGCSE Mathematics A / 4MB1 B | 国际版 GCSE |

---

## 映射率汇总

| 学段 | 科目数 | 映射率 |
|------|--------|--------|
| A-Level 数学 | 7 | **96-100%** |
| A-Level 高数 | 6 | **100%** |
| GCSE | 8 | **100%** |

---

*为 ExamBridge (https://github.com/sectumpempra/grademaster) 设计*
