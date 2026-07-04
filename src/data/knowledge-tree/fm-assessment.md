# A-Level Further Math 知识树 v2 评估报告

## 基本信息
- **总节点数**：622 | **叶子节点**：468 | **顶层模块**：102
- **对比 v1**：344 → 622 节点（+278，+81%）

## 领域覆盖评估

| Domain | Areas 数 | 评估 | 备注 |
|--------|----------|------|------|
| 纯数 Further Pure | 13 + 1 Legacy | ✅ 全面 | Algebra~Complex Number + Numerical solution |
| 统计 Further Statistics | 16 + 1 Legacy | ✅ 非常详细 | 从基础分布到高级推断 |
| 力学 Further Mechanics | 7 + 1 Legacy | ✅ 完整 | 弹性碰撞、圆周运动、质心、动力学 |
| Decision Math | 7 | ✅ 完整 | 算法、图论、路径优化、线性规划 |
| EDX-IAL Units | 43 (M2,M3,S2,S3,FP1-3) | ⚠️ 需处理 | 多为空节点（0子模块）|
| EDX-GCE Topics | 61 (CP,FP,FM,FS,DM) | ⚠️ 需处理 | 多为空节点 |

## 发现的问题

### 1. 编号严重混乱（P0 - 必须修复）
- 顶层索引中 [1],[2],[3],[4],[5],[6],[7] 等编号大量重复
- 统计部分有两套编号：[1]-[5] 和 [6]-[17]
- **修复方案**：每个 Domain 内部独立编号，nodeId 通过 Domain 前缀区分

### 2. EDX-IAL/GCE 空节点（P1 - 需要补充）
- M2 Projectile 等 43 个节点只有名称没有子节点
- EDX-GCE CP Complex numbers 等 61 个节点只有名称
- **修复方案**：作为 L3 Topic 节点保留，补充 description 从上下文推断

### 3. 力学/统计双重组织（P1 - 需要合并）
- 力学：既有按主题（Elastic strings 等）又有按 IAL Unit（M2,M3）
- 统计：既有按主题（Hypothesis testing 等）又有按 IAL Unit（S2,S3）
- **修复方案**：保留按主题的精细结构，IAL Unit 节点作为 cross-reference 或合并

### 4. 旧版知识点（P2 - 标记即可）
- 纯数 Matching(D1), Matrix linear space, Integration-centroid
- 统计 Further work on distributions
- 力学 Rotation of rigid body, SHM(cie)
- **修复方案**：标记为 Legacy domain，正常纳入知识树

## 结论

**结构合理、内容全面，可以进行解析和映射。** 主要工作是编号规范化和空节点处理。

## 执行计划

### Stage 1: 解析 v2 A-Level FM 知识树（622节点）
- 编号规范化（Domain 前缀区分）
- 空节点补充 description
- Legacy 标记

### Stage 2: 重新映射 A-Level FM 科目
- 受影响：CAIE 9231, Edexcel GCE FM, Edexcel IAL FM, AQA 7367, OCR H245, WJEC FM
- 预期映射率从 v1 的 49-82% 提升至 90%+

### Stage 3: 统一合并 v3
- 合并 GCSE(446) + A-Level Math(597) + A-Level FM(622) = ~1665 节点

### Stage 4: 重合度重算
