export type NavigationItem = {
  label: string;
  to: string;
  description?: string;
  preserveCourse?: boolean;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

/** Teacher-oriented task groups used by both desktop and mobile navigation. */
export const NAV_GROUPS: NavigationGroup[] = [
  {
    label: "课程与考试",
    items: [
      { label: "课程中心", to: "/courses", description: "选择资格、代码与考纲版本", preserveCourse: true },
      { label: "考试概览", to: "/exam-overview", description: "考季、Paper、计算器与材料", preserveCourse: true },
    ],
  },
  {
    label: "数据分析",
    items: [
      { label: "成绩与等级", to: "/results", description: "分数线与 A* 率入口", preserveCourse: true },
      { label: "成绩统计", to: "/statistics", description: "历年成绩分布与趋势", preserveCourse: true },
      { label: "等级预测", to: "/calculator", description: "仅使用已核验的 award route", preserveCourse: true },
    ],
  },
  {
    label: "试卷与考纲",
    items: [
      { label: "试卷中心", to: "/papers", description: "查找、查看与比较 Paper", preserveCourse: true },
      { label: "考纲对比", to: "/knowledge-tree", description: "知识树、差异与独有内容", preserveCourse: true },
    ],
  },
  {
    label: "教学工具",
    items: [
      { label: "工具总览", to: "/tools", description: "按当前课程查看可用工具", preserveCourse: true },
      { label: "刷题规划", to: "/planner", description: "按 Paper 安排练习", preserveCourse: true },
      { label: "函数画图", to: "/graph", description: "绘图、调参和导出", preserveCourse: true },
    ],
  },
];

export const MORE_NAV: NavigationItem[] = [
  { label: "人格测试", to: "/personality" },
  { label: "关于与数据来源", to: "/about" },
];

// Compatibility exports for pages and tests that still consume a flat list.
export const PRIMARY_NAV = NAV_GROUPS.flatMap((group) => group.items);
export const NAV_LINKS = PRIMARY_NAV;
