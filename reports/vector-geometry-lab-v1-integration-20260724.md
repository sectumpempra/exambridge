# ExamBridge Vector Geometry Lab V1 集成验收报告

日期：2026-07-24

集成分支：`agent/vector-geometry-lab-v1-20260724`

ExamBridge 基线：`541e4f82555e224ebe5bab551e3fc6f7938dd079`

上游实验室仓库：`/Users/yuzhou/Documents/Codex/2026-07-16/exambridge-vector-geometry-lab`

上游交付 HEAD：`e825c5f6d78ed8ef5622f50b8c05b1849a7bea94`

上游 verified code commit：`dba1c66c5f7b470d251b369545e97a6f39efa92f`

## 集成结果

Vector Geometry Lab V1 已作为 ExamBridge 的独立懒加载教学工具接入：

- 新增路由 `/#/vector-geometry-lab`。
- 加入教学工具中心和全站导航。
- 保留精确有理数、根式和容差双路径计算。
- 支持距离、夹角、线面/面面关系、交点/交线和向量方程。
- 支持 16 个内置场景、Three.js 三维视图、WebGL 降级、文字等价结果。
- 支持版本化本地存储、JSON 导入导出、高清 PNG、HTML 讲义、复制和打印。
- Three.js 独立懒加载，不进入主站初始包。

## 集成期修订

- 将页面外壳、状态提示和主要操作补充为中文或中英双语。
- 删除解释区中误混入的教学脚手架文字。
- 调整三维原点标签位置，降低标签簇重叠。
- 为两个平面使用可区分的配色。
- 将 BigInt 编译目标升级到 ES2020，并让发布门禁禁用旧增量缓存。
- 增加 Vector Geometry 专用单元测试、覆盖率和五组 Playwright 项目。
- 增加路线级 gzip 预算；Three.js 大包仅允许存在于懒加载 chunk。
- 将 DOMPurify 覆盖至 3.4.12，消除 npm 审计发现的低危传递依赖漏洞。

## 自动验收

### 数据与工程门禁

- 课程目录：721 条。
- 历年试卷目录：10 个目录、1196 个资产。
- Knowledge V5：22 个映射、1140 个本体节点。
- Academic Results V2：129 条分数线、120 条成绩统计、40 条规则、0 个 active 冲突。
- University Admissions V1：20 条 active 要求。
- 数据审计：148 个 JSON，0 个未解决 active 冲突。
- TypeScript：通过（ES2020、无增量缓存）。
- ESLint：0 error；测试文件有 3 条不影响发布的未使用变量 warning。
- AI 服务构建审计：通过，无凭证和 AQA 原文泄漏。
- 仓库密钥扫描：1058 个 tracked files，0 发现。
- tracked PDF：0。
- 生产依赖审计：0 个已知漏洞。

### 测试

- ExamBridge 主测试：92 个文件，1383/1383 通过。
- Mechanics Lab：18 个文件，249/249 通过；statements 98.70%，branches 91.02%。
- Vector Geometry Lab：41 个文件，835/835 通过；statements 96.63%，branches 88.81%。
- Playwright 全站本地矩阵：293 通过，5 个仅在显式启用生产 AI 环境时运行的用例按设计跳过。
- CI 环境兼容补丁后的 Lab 定向矩阵：104/104 通过，覆盖三浏览器及无 WebGL 降级。
- 覆盖 Chromium、Firefox、WebKit、320/360/390/768/1024px、WebGL 禁用和截图状态。

### 构建与性能

- vinext 生产构建：通过。
- 静态生产构建：通过。
- 主站初始 JavaScript：178.1 KiB gzip。
- Vector Geometry 路由：135.03 KiB raw / 38.52 KiB gzip。
- Vector Geometry 样式：10.57 KiB raw / 2.65 KiB gzip。
- Three.js 懒加载 chunk：539.25 KiB raw / 136.33 KiB gzip。
- Service Worker precache：238 个文件。
- Knowledge V5-only 发布审计：通过。

## 本地视觉验收

检查了空白编辑器、向量夹角、点面距离、异面直线最短距离、线面交点、面面交线、平面夹角、退化输入、WebGL 降级、390px、768px 和宽屏共 12 个状态。未发现整页横向溢出、关键控件截断或错误状态伪装为有效答案。

## V1 已知边界

- 第一版只支持内置分析器能识别的 16 类场景；自由增删任意实体留到后续版本。
- JSON 导入会拒绝无法安全匹配现有分析器的结构。
- 教学内容仍以英文数学术语为主，页面操作与关键状态已完成中文化。
- 三维标签在极端视角下仍可能密集，但不会影响确定性数值和文字答案。
- 提供 1×/2×/3× PNG，不单独提供 SVG 导出。

## 外部 AI 交付评价

综合评分：**92/100**。

| 维度 | 得分 |
|---|---:|
| 数学正确性与确定性 | 97 |
| 工程质量与测试 | 96 |
| 架构与可集成性 | 93 |
| UI 与产品完成度 | 82 |
| 交付严谨度 | 89 |

主要优点是数学核心、gold cases、拒绝态和跨浏览器验证非常扎实；扣分主要来自上游独立仓库 README 陈旧、UI 英文化、解释脚手架残留、标签与配色观感问题。上述高风险或明显观感问题已在本次 ExamBridge 集成中修订。

## 回滚

回滚时可移除 `vector-geometry-lab` 路由、导航入口、页面与 feature 目录，并删除 Three.js 相关依赖；其余 ExamBridge 数据和功能不受影响。官方 PDF 和服务器持久化材料目录未被读取、提交或修改。
