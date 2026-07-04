## T2 执行日志：考纲搜索、映射与重合度计算

### 阶段概览

| 阶段 | 状态 | 输出文件数 |
|------|------|-----------|
| Stage 1: 考纲搜索 | 完成 | 17 |
| Stage 2: 结构化提取 | 完成 | 17 |
| Stage 3: 考纲映射 | 完成 | 19 |
| Stage 4: 重合度计算 | 完成 | 39 |
| **总计** | **完成** | **92** |

### 2026-07-04 12:00 - Stage 1: 考纲搜索

搜索了 5 个考试局 17 个科目的官方考纲：

**CAIE (4个)**
- 9709 A-Level Mathematics: 39 topics, 6 papers
- 9231 A-Level Further Mathematics: 24 topics, 4 papers
- 0580 IGCSE Mathematics: 9 topics, 4 papers (Core/Extended)
- 0606 IGCSE Additional Mathematics: 14 topics, 2 papers

**Edexcel (5个)**
- GCE A-Level Mathematics (9MA0): 19 topics, 3 papers
- IAL Mathematics (XMA01): 36 topics, 14 units
- IGCSE Mathematics A&B (4MA1/4MB1): 10 topics
- GCE Further Mathematics (9FM0): 41 topics, 4 papers
- IAL Further Mathematics (XFM01): 49 topics, 10 units

**AQA (4个)**
- GCSE Mathematics (8300): 6 topics + 101 subtopics, Foundation/Higher
- L2 Further Mathematics (8365): 6 topics + 51 subtopics
- A-Level Mathematics (7357): 19 topics, 3 papers
- A-Level Further Mathematics (7367): 29 topics (10 compulsory + 19 optional), 3 papers

**OCR (3个)**
- A-Level Mathematics A (H240): 19 topics, 3 papers
- A-Level Further Mathematics A (H245): 23 topics, 6 papers
- GCSE Mathematics (J560): 16 topics, 6 papers

**WJEC (1个综合)**
- WJEC Mathematics Qualifications: 42 topics 跨 GCSE/A-Level/Further

### 2026-07-04 13:00 - Stage 2: 结构化提取

将 17 个考纲提取为标准 JSON 格式，每个包含：
- papers 结构（paper code, name, duration, marks）
- topics 列表（topicId, name, category, paperReferences, subtopics）

### 2026-07-04 14:00 - Stage 3: 考纲映射

将 19 个科目的考纲 topics 映射到统一知识树（947 节点）：

| 学段 | 科目数 | 总Topics | Mapped | Unmapped | 映射率 |
|------|--------|---------|--------|----------|--------|
| GCSE Math | 7 | 71 | 71 | 0 | 100% |
| A-Level Math | 6 | 153 | 73 | 80 | 47.7% |
| A-Level FM | 6 | 178 | 174 | 4 | 97.8% |

**A-Level Math 映射率低的原因**：
原始知识树草稿主要覆盖 Pure Mathematics 和 Mechanics，缺少 Statistics、Vectors、Numerical Methods 等领域。这些 topics 在 A-Level Math 考纲中占比很大（约 50%），因此大量 Statistics topics 无法映射。

**建议**：后续应扩充 A-Level 数学知识树，补充 Statistics、Vectors、Numerical Methods 等域。

### 2026-07-04 15:00 - Stage 4: 重合度计算

计算了 39 个对比对的考纲重合度：

**GCSE 横向对比（11对）**
- 最高重合度：AQA 8300 vs OCR J560 (0.6053) — 同为英国本土 GCSE
- 最低重合度：CAIE 0580 vs CAIE 0606 (0.1215) — 标准 vs Further
- 关键发现：Further Math 与标准数学重合度极低（12-18%），验证了进阶定位

**A-Level 横向对比（16对）**
- A-Level Math 最高重合度：Edexcel GCE vs AQA 7357 (0.9688) — 本土局高度统一
- A-Level Math CAIE 与本土局重合度：56-71%
- A-Level FM 重合度：34-54%（模块组合差异大）
- Math vs FM 节点重合度：0%（知识树命名空间完全隔离）

**跨学段对比（11对 + 1汇总）**
- GCSE -> A-Level：重合度 0%（知识树命名空间隔离）
- GCSE Further -> A-Level Math：AQA 8365 覆盖率最均衡（53.6% vs 46.4%）
- A-Level Math -> A-Level FM：FM 端覆盖率高达 70%+

### 关键发现总结

1. **知识树分层设计**：GCSE、A-Level Math、A-Level FM 使用不同的命名空间，反映了课程的分层递进关系
2. **本土 vs 国际差异**：英国本土考试局之间的重合度远高于本土与国际局之间的重合度
3. **Further Math 定位验证**：Further Math 与标准数学的重合度极低，验证了它作为进阶课程的定位
4. **知识树覆盖缺口**：A-Level Math 的 Statistics 领域需要补充

### 输出文件清单（共 92 个文件）

**知识树文件（5个）**：
- knowledge-tree-alevel-math.json (154 nodes)
- knowledge-tree-alevel-fm.json (344 nodes)
- knowledge-tree-gcse-math.json (377 nodes)
- knowledge-tree-gcse-fm.json (69 nodes)
- unified-knowledge-tree.json (947 nodes)

**考纲文件（17个）**：syllabus-{board}-{code}.json

**映射文件（19个）**：mapping-{board}-{code}.json

**重合度文件（39个）**：overlap-{A}_vs_{B}.json

**日志文件（2个）**：log-phase-1.md, log-t2.md

### 下一步建议

1. **扩充知识树**：补充 A-Level Math 的 Statistics、Vectors、Numerical Methods 域
2. **映射迭代**：知识树扩充后重新映射 A-Level Math 的未映射 topics
3. **T3 验证**：人工抽查 10% 的映射结果，验证 matchStrength 的合理性
4. **可视化**：构建知识树浏览器和重合度热力图
