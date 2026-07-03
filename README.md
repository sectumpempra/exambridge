# GradeMaster 备考管家

> 你的私人 A-Level / IGCSE / GCSE 备考管家，覆盖 CAIE / Edexcel / AQA / OCR / WJEC-Eduqas 五大考试局。

**在线地址**：https://uhxiohmpvszfm.ok.kimi.link

---

## 功能概览

| 功能 | 说明 |
|------|------|
| 分数线查询 | 五大考试局 A-Level / GCSE 分数线数据，支持按科目代码、年份、考试季筛选 |
| Grade Statistics 趋势图 | 历年 A*-E / 9-1 各等级占比趋势，支持动态切换评分制 |
| 等级预测模拟器 | 输入卷面分，自动计算 UMS 与预测等级 |
| 刷题规划器 | 按强度（轻松/标准/密集）自动生成刷题日历，支持休息日设置与分享链接 |
| 函数图像绘制器 | 支持直角坐标与极坐标、参数滑块、角度制/弧度制切换、渐近线标注 |
| 学习人格测试 | 通过答题分析你的学习风格，给出备考建议 |

---

## 数据覆盖

- **10,000+** 条分数线数据
- **560+** 个科目
- **1,146+** 份试卷
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

---

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/sectumpempra/grademaster.git
cd grademaster

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 类型检查
npx tsc --noEmit

# 代码检查（当前有 7 个 shadcn/ui Fast Refresh lint 警告，不影响功能）
npm run lint
```

---

## 项目结构

```
src/
  App.tsx                    # 路由配置
  data/
    resultStatistics.ts      # Grade Statistics 数据（~3500 行）
    edexcel.json / edexcel_al.json   # Edexcel 分数线
    aqa.json / aqa_al.json           # AQA 分数线
    caie.json / caie_al.json         # CAIE 分数线
    ocr.json / ocr_al.json           # OCR 分数线
    plannerData.json         # 刷题规划科目数据
    examDates.ts             # 考试日期
    examData.ts              # 强度配置
    calculatorIndex.ts       # 计算器科目索引
    personalityData.ts       # 人格测试题目
  pages/
    ResultStatisticsPage.tsx # 成绩统计趋势图
    GradeCalculator.tsx      # 等级预测模拟器
    Planner.tsx              # 刷题规划器
    graph/                   # 函数图像绘制器
      GraphPage.tsx
      components/GraphCanvas.tsx
      lib/graphRenderer.ts
    alevel/                  # A-Level 分数线页面
      Home.tsx / EdexcelPage.tsx / CaiePage.tsx / AqaPage.tsx / OcrPage.tsx / WjecPage.tsx
    gcse/                    # GCSE 分数线页面
      Home.tsx / EdexcelPage.tsx / CaiePage.tsx / AqaPage.tsx / OcrPage.tsx
  hooks/
    usePlanner.ts            # 刷题规划核心调度逻辑
  utils/
    gradeCalculation.ts      # UMS / 等级计算
    shareCode.ts             # 分享链接生成与解析
  components/
    ui/                      # shadcn/ui 组件
    BoardPage.tsx            # GCSE 分数线页面模板
    ALevelBoardPage.tsx      # A-Level 分数线页面模板
    DataTable.tsx            # 数据表格（筛选、排序、分页）
    GradeChart.tsx           # 分数线趋势图
    Header.tsx / Footer.tsx
```

---

## 构建与部署

```bash
cd grademaster
npm run build
# 输出目录：dist/
# 将 dist/ 文件夹部署到任意静态网站托管服务即可
```

---

## 已知问题

- 7 个 shadcn/ui 组件 Fast Refresh lint 警告（`badge`, `button-group`, `button`, `form`, `navigation-menu`, `sidebar`, `toggle`），不影响功能，后续计划修复
- Edexcel IGCSE 目前只有 Grade Statistics 数据，Grade Boundaries 数据待补充

---

## 版权声明

分数线数据来源于各考试局官方（CAIE、Pearson Edexcel、AQA、OCR、WJEC），仅供学习参考。版权归 respective owners 所有。

Created by Leo Liu.
