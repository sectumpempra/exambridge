# ExamBridge 教师扩科助手

> 面向国际学校教师的跨考试局扩科教研平台，覆盖 CAIE / Edexcel / AQA / OCR / WJEC-Eduqas 五大考试局。

**在线地址**：https://ms4j73ddeu7sa.ok.kimi.link

---

## 功能概览

| 功能 | 说明 |
|------|------|
| 分数线查询 | 五大考试局 A-Level / GCSE 分数线数据，支持按科目代码、年份、考试季筛选 |
| Grade Statistics 趋势图 | 历年 A*-E / 9-1 各等级占比趋势，支持动态切换评分制 |
| 等级预测模拟器 | 输入卷面分，自动计算 UMS 与预测等级 |
| 刷题规划器 | 按强度（轻松/标准/密集）自动生成刷题日历，支持休息日设置与分享链接 |
| 函数图像绘制器 | 支持直角坐标与极坐标、参数滑块、角度制/弧度制切换、渐近线标注 |
| 考纲扩科对比 | 基于 812 节点统一知识树，支持整科/Paper 级别对比，独有知识点以考纲原文展示 |
| 学习人格测试 | 通过答题分析你的学习风格，给出备考建议 |

---

## 数据覆盖

- **10,000+** 条分数线数据
- **560+** 个科目
- **1,146+** 份试卷
- **21** 个数学类科目考纲映射
- **812** 节点统一知识树
- **5** 大考试局

### 支持考试局

| 考试局 | A-Level | GCSE / IGCSE |
|--------|---------|-------------|
| CAIE | ✅ | ✅ |
| Edexcel | ✅ | ✅ |
| AQA | ✅ | ✅ |
| OCR | ✅ | ✅ |
| WJEC / Eduqas | ✅ | ✅ |

---

## 技术栈

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui**
- **Recharts**（趋势图）
- **mathjs**（函数图像求值）
- **Canvas API**（函数图像绘制）
- **date-fns**（日期处理）
- **LZString**（分享链接压缩）
- **Vite PWA**（离线支持）

---

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/sectumpempra/exambridge.git
cd exambridge

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 类型检查
npx tsc --noEmit

# 代码检查
npm run lint
```

---

## 项目结构

```
src/
  App.tsx                          # 路由配置（HashRouter）
  data/
    resultStatistics.ts            # Grade Statistics 数据
    knowledge-tree/                # 知识树与考纲映射
      knowledge-tree.json          # 812 节点统一知识树
      types-v3.2.ts                # 类型定义
      loader-v3.2.ts               # 数据加载层
    exams.json / papers.json       # 考试与试卷数据
    plannerData.json               # 刷题规划科目数据
    examDates.ts                   # 考试日期
    calculatorIndex.ts             # 计算器科目索引
    personalityData.ts             # 人格测试题目
  pages/
    Home.tsx                       # 首页
    ResultStatisticsPage.tsx       # 成绩统计趋势图
    GradeCalculator.tsx            # 等级预测模拟器
    Planner.tsx                    # 刷题规划器
    PaperSearchPage.tsx            # Paper 查询
    KnowledgeTreeComparePage.tsx   # 考纲扩科对比
    graph/                         # 函数图像绘制器
      GraphPage.tsx
      components/GraphCanvas.tsx
      lib/graphRenderer.ts
    alevel/                        # A-Level 分数线页面
    gcse/                          # GCSE 分数线页面
    papers/                        # Paper 详情与对比
  hooks/
    usePlanner.ts                  # 刷题规划核心逻辑
  utils/
    gradeCalculation.ts            # UMS / 等级计算
    shareCode.ts                   # 分享链接生成与解析
  components/
    ui/                            # shadcn/ui 组件
    BoardPage.tsx                  # 分数线页面模板
    DataTable.tsx                  # 数据表格
    Header.tsx / Footer.tsx
    PWAInstallPrompt.tsx           # PWA 安装提示
public/
  data/v3.2-new/                 # 考纲映射数据（21 个科目）
  icons/                           # PWA 图标
```

---

## 构建与部署

```bash
cd exambridge
npm run build
# 输出目录：dist/
# 将 dist/ 文件夹部署到任意静态网站托管服务即可
```

---

## 数据更新

考纲映射数据位于 `public/data/v3.2-new/`，包含：

- `knowledge-tree.json` — 812 节点统一知识树
- `mapping-{BOARD}-{CODE}.json` — 21 个科目映射文件

更新数据时直接替换对应 JSON 文件即可，前端代码无需改动。

---

## 版权声明

分数线数据来源于各考试局官方（CAIE、Pearson Edexcel、AQA、OCR、WJEC），仅供学习参考。版权归 respective owners 所有。

Created by Leo Liu.
