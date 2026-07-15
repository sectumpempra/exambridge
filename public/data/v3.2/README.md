# ExamBridge v3.2 交付说明

## 交付文件清单

```
/Users/yuzhou/WorkBuddy/2026-07-06-14-39-16/
├── knowledge-tree-v3.2.json          # 统一知识树（522 节点）
├── syllabi/
│   └── syllabus-v3.2-{code}.json     # 34 个结构化考纲
├── mappings/
│   └── mapping-v3.2-{code}.json      # 34 个考纲→知识树映射
├── validation-report.json            # 验证报告
├── validate_v3.2.py                  # 可复现的验证脚本
├── convert_v2_mappings.py            # v2 → v3.2 转换脚本
├── add_caie9709_p5p6_v2.py          # CAIE-9709 P5/P6 生成脚本
├── generate_ial_v2.py               # IAL unit 生成脚本
├── regenerate_combinations.py        # IAL 组合映射生成脚本
└── README.md                         # 本文件
```

## 34 个科目代码

- **GCSE / IGCSE（8）**: CAIE-0580, CAIE-0606, Edexcel-1MA1, Edexcel-4MA1, Edexcel-4PM1, AQA-8300, AQA-8365, OCR-J560
- **A-Level Math（6）**: CAIE-9709, Edexcel-9MA0, Edexcel-8MA0, AQA-7357, OCR-H240, OCR-H640
- **A-Level Further Math（4）**: CAIE-9231, Edexcel-9FM0, AQA-7367, OCR-H245
- **IAL Units（14）**: IAL-P1~P4, IAL-FP1~FP3, IAL-M1~M3, IAL-S1~S3, IAL-D1
- **IAL 组合（2）**: IAL-Math, IAL-FM

## 构建流程

1. **提示词修正**：按官方 syllabus 修正 paper 结构（Edexcel-9MA0 3 Papers、Edexcel-8MA0 P1/P2、AQA-7357 P1/P2/P3、OCR-H245 4 Papers、Edexcel-9FM0 4 Papers 等），删除 WJEC-3300。
2. **知识树扩展**：在 v2（395 节点）基础上新增 127 个节点，覆盖 Further Pure / Further Mechanics / Further Statistics / Decision-Discrete / IAL 特有内容，共 522 节点。
3. **考纲结构化**：从 PDF 提取文本，生成 34 个 syllabus JSON。
4. **映射生成**：v2 mapping 转换 + CAIE-9709 P5/P6 手工补全 + IAL unit 类比/推导生成。
5. **验证**：运行 `validate_v3.2.py` 输出 `validation-report.json`。

## 验证结果摘要

当前 **5 / 18** 组检查通过：

### 通过的整科对比
- CAIE-0580 vs Edexcel-4MA1
- CAIE-9231 vs Edexcel-9FM0

### 通过的 Paper 对比
- CAIE-9709-P4 vs CAIE-9709-P5
- CAIE-9709-P5 vs CAIE-9709-P6
- CAIE-9709-P1 vs Edexcel-9MA0-P1

### 主要未通过项
- CAIE-9709 vs Edexcel-9MA0（weighted 54.07，期望 ≥55）
- CAIE-0580 vs AQA-8300（weighted 51.79，期望 ≥60）
- CAIE-9231 vs CAIE-9709（weighted 30.78，期望 ≥35）
- IAL-P1/P2/P3/M1 vs CAIE-9709 对应 Paper（均低于下限）
- CAIE-9709-P4/P5 vs Edexcel-9MA0-P3（部分高于上限）

完整数据见 `validation-report.json`。

## 已知问题与后续建议

1. **v2 映射粒度不足**：v2 的 CAIE-9709 映射只覆盖到 P1-P4，P5/P6 为本次手工补全；IAL 单元依赖类比匹配，精度有限。
2. **验证区间敏感**：多个检查只差 1-5 个百分点，需要逐科逐 paper 微调 mappedNodes 与 paperReference。
3. **建议后续动作**：
   - 对 CAIE-9709 P5/P6 使用官方 syllabus 文本逐条映射，替换当前手工主题。
   - 对 IAL 单元建立与 CAIE-9709  paper 的显式 topic 对应表，避免纯文本类比误差。
   - 运行自动化调优脚本，在固定 expected ranges 下迭代调整节点权重。

## 复现方式

```bash
cd /Users/yuzhou/WorkBuddy/2026-07-06-14-39-16
/Users/yuzhou/.workbuddy/binaries/python/versions/3.13.12/bin/python3 validate_v3.2.py
```

验证脚本会自动检查：
- 所有 mapping 文件是否为有效 JSON
- 所有 mappedNodeId 是否存在于 `knowledge-tree-v3.2.json`
- 18 组固定 expected ranges 的 unweighted/weighted Jaccard
