export interface Question {
  id: number;
  text: string;
  options: { label: string; text: string; scores: Record<string, number> }[];
}

export interface Personality {
  code: string;
  name: string;
  tagline: string;
  description: string;
  quote: string;
  powers: string[];
  weaknesses: string[];
  advice: string[];
  partners: string;
  emoji: string;
  color: string;
}

export const QUESTIONS: Question[] = [
  { id: 1, text: "当 CIE 大考还有 3 天，你的第一反应是？", options: [
    { label: "A", text: "立刻拉个复习群，召集战友们一起刷题", scores: { E: 1 } },
    { label: "B", text: "默默打开 past paper，一个人肝到天亮", scores: { I: 1 } },
    { label: "C", text: "先算一下扣几分还能拿 A*，战略性放弃", scores: { T: 1 } },
    { label: "D", text: "打开小红书看看别人的复习进度找安慰", scores: { F: 1 } },
  ]},
  { id: 2, text: "你的笔记风格最接近？", options: [
    { label: "A", text: "五彩斑斓的 mind map，贴满贴纸和便利贴", scores: { N: 1, F: 1 } },
    { label: "B", text: "工整的 Cornell Notes，分栏清晰如教科书", scores: { S: 1, J: 1 } },
    { label: "C", text: "草稿纸上狂乱的公式推导，只有我自己能看懂", scores: { T: 1, P: 1 } },
    { label: "D", text: "我没有笔记，知识都在我脑子里", scores: { I: 1, P: 1 } },
  ]},
  { id: 3, text: "老师在讲台上讲到一个超纲知识点，你会？", options: [
    { label: "A", text: "举手问：'老师，这个会考吗？'", scores: { S: 1, J: 1 } },
    { label: "B", text: "眼睛发亮，下课立刻去查 Wikipedia 深挖", scores: { N: 1, T: 1 } },
    { label: "C", text: "默默记下来，心想可能明年复读会用到", scores: { I: 1, F: 1 } },
    { label: "D", text: "转头跟同桌说：'这题我去年就会了'", scores: { E: 1, P: 1 } },
  ]},
  { id: 4, text: "UCAS 选校时，你的策略是？", options: [
    { label: "A", text: "Excel 表格 + 历年录取数据 + 预估分模型，科学决策", scores: { T: 1, J: 1 } },
    { label: "B", text: "看哪所学校的图书馆最美，食堂最好吃", scores: { F: 1, N: 1 } },
    { label: "C", text: "问问学长学姐，跟风选最火的", scores: { E: 1, S: 1 } },
    { label: "D", text: "闭眼填牛津剑桥帝国，生死有命富贵在天", scores: { I: 1, P: 1 } },
  ]},
  { id: 5, text: "收到 Con offer 要求 A*AA，你实际预估 AAA，你会？", options: [
    { label: "A", text: "立刻制定 60 天提分计划，精确到每小时", scores: { J: 1, T: 1 } },
    { label: "B", text: "给招生办写 love letter 求情", scores: { F: 1, E: 1 } },
    { label: "C", text: "Argue 预估分，让老师再爱我一次", scores: { E: 1, P: 1 } },
    { label: "D", text: "开始研究 Clearing 和 Gap year 攻略", scores: { I: 1, N: 1 } },
  ]},
  { id: 6, text: "小组作业中你最常见的角色是？", options: [
    { label: "A", text: "催DDL的组长，负责carry全组", scores: { E: 1, J: 1 } },
    { label: "B", text: "默默做最多工作的幕后英雄", scores: { I: 1, S: 1 } },
    { label: "C", text: "提出天马行空idea但从不执行", scores: { N: 1, P: 1 } },
    { label: "D", text: "负责做PPT美化，内容不关我事", scores: { F: 1, P: 1 } },
  ]},
  { id: 7, text: "一道题算了 3 遍答案都不一样，你会？", options: [
    { label: "A", text: "再算第 4 遍，我就不信了", scores: { S: 1, J: 1 } },
    { label: "B", text: "看看哪个答案最顺眼就选哪个", scores: { N: 1, F: 1 } },
    { label: "C", text: "换个方法算，用计算器验证", scores: { T: 1, P: 1 } },
    { label: "D", text: "放弃这道题，人生苦短", scores: { I: 1, P: 1 } },
  ]},
  { id: 8, text: "你的理想 A-Level 选课组合是？", options: [
    { label: "A", text: "Math + FM + Physics，硬核理科三件套", scores: { T: 1, S: 1 } },
    { label: "B", text: "English Lit + History + Art，文艺走到底", scores: { F: 1, N: 1 } },
    { label: "C", text: "Psychology + Sociology + Media，人文社科混申", scores: { E: 1, N: 1 } },
    { label: "D", text: "看哪个给分高选哪个，策略性选课", scores: { T: 1, P: 1 } },
  ]},
  { id: 9, text: "考完试对答案时，你的状态是？", options: [
    { label: "A", text: "第一时间找人对答案，不管考得好不好", scores: { E: 1 } },
    { label: "B", text: "拒绝一切对答案邀请，假装无事发生", scores: { I: 1 } },
    { label: "C", text: "自己偷偷算分，精确到每个 mark scheme", scores: { T: 1 } },
    { label: "D", text: "已经规划好下次重考了，这次无所谓", scores: { P: 1 } },
  ]},
  { id: 10, text: "老师说的哪句话最让你破防？", options: [
    { label: "A", text: "'这道题讲过多少遍了还有人错'", scores: { S: 1, J: 1 } },
    { label: "B", text: "'你的 essay 缺乏 critical thinking'", scores: { N: 1, F: 1 } },
    { label: "C", text: "'这次考试全班就你没及格'", scores: { E: 1, F: 1 } },
    { label: "D", text: "'你的预估分我没办法再提高了'", scores: { T: 1, I: 1 } },
  ]},
  { id: 11, text: "考前一周的自习室，你在？", options: [
    { label: "A", text: "霸占一个角落从早学到晚，自带干粮", scores: { I: 1, J: 1 } },
    { label: "B", text: "和朋友占一张大桌，学 20 分钟聊 40 分钟", scores: { E: 1, P: 1 } },
    { label: "C", text: "在图书馆巡逻，看看谁比自己更卷", scores: { E: 1, S: 1 } },
    { label: "D", text: "根本不去自习室，在家躺着学", scores: { I: 1, P: 1 } },
  ]},
  { id: 12, text: "看到 mark scheme 上写的 'Accept any reasonable answer'，你会？", options: [
    { label: "A", text: "松一口气，自己的离谱答案有救了", scores: { F: 1, P: 1 } },
    { label: "B", text: "愤怒：什么叫 reasonable？给个标准啊！", scores: { T: 1, J: 1 } },
    { label: "C", text: "心想：我的答案合理到连我自己都不信", scores: { N: 1, I: 1 } },
    { label: "D", text: "截图发群，@所有人来看这条救命稻草", scores: { E: 1, S: 1 } },
  ]},
  { id: 13, text: "你的手机壁纸最有可能是？", options: [
    { label: "A", text: "Gantt chart 截图或复习时间表", scores: { J: 1, S: 1 } },
    { label: "B", text: "梦校校门或励志语录", scores: { F: 1, N: 1 } },
    { label: "C", text: "备忘录里写满 todo list 的截图", scores: { E: 1, J: 1 } },
    { label: "D", text: "系统默认壁纸，懒得换", scores: { I: 1, P: 1 } },
  ]},
  { id: 14, text: "学习时最常听的 BGM 是？", options: [
    { label: "A", text: "白噪音 / 雨声 / 图书馆环境音", scores: { I: 1, S: 1 } },
    { label: "B", text: "K-pop / 欧美流行，越嗨越好", scores: { E: 1, P: 1 } },
    { label: "C", text: "古典音乐，据说能提高智商", scores: { N: 1, T: 1 } },
    { label: "D", text: "什么也不听，安安静静", scores: { I: 1, J: 1 } },
  ]},
  { id: 15, text: "看到朋友圈有人晒 4A* 预估，你会？", options: [
    { label: "A", text: "默默点赞，然后焦虑地打开自己的成绩单", scores: { F: 1, I: 1 } },
    { label: "B", text: "评论区发：'大佬带带我'", scores: { E: 1, S: 1 } },
    { label: "C", text: "截图发给朋友吐槽：'这人是外星人吧'", scores: { T: 1, E: 1 } },
    { label: "D", text: "毫无波澜，关我屁事", scores: { T: 1, P: 1 } },
  ]},
  { id: 16, text: "写 essay 时你的写作流程是？", options: [
    { label: "A", text: "先列 detailed outline，每段写 topic sentence", scores: { J: 1, S: 1 } },
    { label: "B", text: "直接开写，写到哪想到哪", scores: { P: 1, N: 1 } },
    { label: "C", text: "先读 10 篇文献，然后发现自己离题了", scores: { T: 1, N: 1 } },
    { label: "D", text: "打开 ChatGPT 找灵感，然后自己重写", scores: { E: 1, P: 1 } },
  ]},
  { id: 17, text: "你最喜欢的 past paper 做题方式是？", options: [
    { label: "A", text: "按 topic 分类刷，系统攻克每个知识点", scores: { S: 1, J: 1 } },
    { label: "B", text: "按年份整套刷，模拟真实考试", scores: { T: 1, J: 1 } },
    { label: "C", text: "随便抽一套，看命运让我做到哪题", scores: { N: 1, P: 1 } },
    { label: "D", text: "只看 mark scheme，题目是什么不重要", scores: { I: 1, P: 1 } },
  ]},
  { id: 18, text: "Physics 实验课你把试管打碎了，你会？", options: [
    { label: "A", text: "立刻打扫并报告老师，安全第一", scores: { S: 1, J: 1 } },
    { label: "B", text: "默默把碎片藏起来，假装什么都没发生", scores: { I: 1, P: 1 } },
    { label: "C", text: "思考：这个碎裂轨迹能用 projectile motion 解释吗", scores: { N: 1, T: 1 } },
    { label: "D", text: "先拍照发朋友圈：'今天也是实验室杀手呢'", scores: { E: 1, F: 1 } },
  ]},
  { id: 19, text: "你最喜欢的解压方式是？", options: [
    { label: "A", text: "疯狂刷题，用学习麻痹焦虑", scores: { J: 1, S: 1 } },
    { label: "B", text: "binge watch 一整季 Netflix", scores: { P: 1, F: 1 } },
    { label: "C", text: "深夜网抑云，听emo歌单写日记", scores: { I: 1, F: 1 } },
    { label: "D", text: "约朋友出去嗨，学习与快乐无关", scores: { E: 1, P: 1 } },
  ]},
  { id: 20, text: "如果用一句话总结你的 A-Level 生涯，你会说？", options: [
    { label: "A", text: "'刷过的题比走过的路还长'", scores: { S: 1, J: 1 } },
    { label: "B", text: "'在崩溃和自我修复之间反复横跳'", scores: { F: 1, N: 1 } },
    { label: "C", text: "'考前一周，创造奇迹'", scores: { P: 1, E: 1 } },
    { label: "D", text: "'这只不过是一段人生经历而已'", scores: { T: 1, I: 1 } },
  ]},
];

export const PERSONALITIES: Record<string, Personality> = {
  ISTJ: { code: "ISTJ", name: "Past Paper 永动机", tagline: "刷题，是一种信仰", description: "你是 A-Level 圈子里最可怕的存在——不是因为天赋，而是因为持之以恒的刷题量。你的文件夹里有按年份、按单元、按 topic 分类的 past paper，每一套都刷了三遍以上。", quote: "我刷过的 past paper，连起来可以绕地球三圈。", powers: ["Past paper 收藏量全校第一", "Mark scheme 能倒背如流", "永远提前一周完成复习计划", "Excel 成绩追踪表震惊全班"], weaknesses: ["遇到新题型直接宕机", "不懂变通一条路走到黑", "朋友觉得你无聊透顶", "偶尔会因为过度准备而焦虑发作"], advice: ["适当尝试新题型别只刷熟悉的", "给自己留点弹性时间", "偶尔放松一下刷题不是人生的全部"], partners: "ESTJ, ISFJ, INTJ", emoji: "📚", color: "#4A90D9" },
  ISFJ: { code: "ISFJ", name: "默默卷王", tagline: "我不说话，但我全都会", description: "你是班级里最安静的那个，永远坐在角落，笔记工整得像印刷体。你不张扬、不炫耀，但每一次考试都能稳如老狗地拿 A。", quote: "我不需要你知道我有多努力，我只需要成绩单知道。", powers: ["笔记被全班传阅复印", "从来不发朋友圈炫耀但成绩永远前几", "老师眼中最靠谱的学生", "小组作业中默默carry的幕后英雄"], weaknesses: ["太好说话总被 pushover", "不好意思拒绝别人的求助", "压力全自己扛不说出来", "偶尔会因为太低调而被忽视"], advice: ["学会说'不'你的时间也很宝贵", "适当展示自己的优秀 deserve 被看见", "找个信得过的朋友倾诉压力"], partners: "ISTJ, ESFJ, INFJ", emoji: "🤫", color: "#7B68EE" },
  INFJ: { code: "INFJ", name: "梦校预言家", tagline: "我预见了自己的 A*", description: "你从选校第一天就知道自己要去哪所大学，甚至已经想好了研究生和博士的方向。你的房间里贴满了梦校的海报，你的 personal statement 改了 27 遍。", quote: "我不是在申请大学，我是在执行一个五年战略规划。", powers: ["Personal statement 惊艳招生官", "对目标学校了如指掌如数家珍", "Long-term planning 令人叹为观止", "Motivation letter 写得让人想录取自己"], weaknesses: ["对任何偏离计划的事情极度焦虑", "梦校 reject 你时会怀疑人生", "朋友觉得你太 serious", "偶尔会活在未来而忽视当下"], advice: ["Plan B 也很重要给自己留条后路", "享受学习过程不只是为了结果", "偶尔活在当下未来会自己来的"], partners: "INFP, ENFJ, INTJ", emoji: "🔮", color: "#9B59B6" },
  INTJ: { code: "INTJ", name: "战略卷王", tagline: "我不是在学习，我在优化人生算法", description: "你是 A-Level 战场上的军事家。别人在刷题，你在分析历年 grade boundary 趋势；别人在背公式，你在推导公式背后的数学原理。", quote: "我的学习计划不是 to-do list，是算法优化问题。", powers: ["Grade boundary 趋势分析准确率 99%", "永远用最少的时间拿最高的分", "自制学习工具震惊全班", "Critical thinking 让老师都自叹不如"], weaknesses: ["对'低效学习'零容忍容易看不起别人", "社交活动=时间浪费", "偶尔想太多导致 paralysis by analysis", "被认为冷血机器人"], advice: ["偶尔允许自己'inefficient'一下", "和别人讨论能激发新思路", "不是所有事情都需要优化"], partners: "INTP, ENTJ, INFJ", emoji: "🧠", color: "#2C3E50" },
  ISTP: { code: "ISTP", name: "裸考天才", tagline: "天赋异禀，随性而为", description: "你是 A-Level 世界里的传奇——平时吊儿郎当，考试却总能神奇地拿 A。你不刷题、不做笔记、甚至有时不上课，但你的大脑似乎天生就是为考试而生的。", quote: "昨晚 8 点开始复习，今早起早拿了 A*。时间线完美。", powers: ["临时抱佛脚抱出 A*", "数学物理看一眼就会", "危机处理能力极强", "考场上越慌发挥越好"], weaknesses: ["老师觉得你态度有问题", "长期项目永远拖到最后一刻", "笔记和课本全新未拆封", "父母永远不知道你到底是会还是不会"], advice: ["稍微提前一点开始复习可以减少 90% 的焦虑", "做一点笔记将来你会感谢自己", "别把天赋当成不努力的理由"], partners: "ESTP, INTP, ISFP", emoji: "😎", color: "#E74C3C" },
  ISFP: { code: "ISFP", name: "画室隐士", tagline: "我在色彩和音符中找到了 A*", description: "你是 A-Level 世界里的一股清流。当所有人都在卷 Math 和 Physics 的时候，你在画室泡了八个小时只为调出一个完美的蓝色。", quote: "我的 sketchbook 比我的 personal statement 更能表达我是谁。", powers: ["Sketchbook 让 examiner 感动落泪", "Art portfolio 惊艳全场", "对美的感知力异于常人", "能在压力中找到创作的平静"], weaknesses: ["理科老师看见你的选课组合就叹气", "Essay deadline 永远记不住", "父母天天唠叨'学这个能找到工作吗'", "偶尔过于沉浸内心世界"], advice: ["用视觉化方法记笔记画图比写字有效", "给自己设定明确的 deadline", "别让别人定义你的价值"], partners: "INFP, ESFP, ISTP", emoji: "🎨", color: "#FF69B4" },
  INFP: { code: "INFP", name: "深夜哲学家", tagline: "在存在主义的深渊里拿 A*", description: "你是那个在凌晨三点一边写 Philosophy essay 一边思考人生意义的 A-Level 学生。你的 essay 从来不是堆砌论点，是一场灵魂探索。", quote: "我思考故我在，但思考太多就做不完作业了。", powers: ["Essay 写得像文学作品", "Critical thinking 深度惊人", "对人文社科有天然的敏感度", "Personal statement 真情实感打动人心"], weaknesses: ["容易陷入 existential crisis 影响学习", "Deadline 前夜才开始写 4000 字 essay", "理科是永远的痛", "情绪起伏比 stock market 还大"], advice: ["把大任务拆成小目标避免被 overwhelmed", "找个学习伙伴互相监督", "允许自己有 emo 时间但设个闹钟"], partners: "INFJ, ENFP, ISFP", emoji: "🌙", color: "#6C5CE7" },
  INTP: { code: "INTP", name: "理论强迫症", tagline: "不是我在学知识，是知识在学我", description: "你对 A-Level 的态度是：'这些知识点太浅了，让我来深入探究一下背后的原理。' 别人在学 how，你在学 why。", quote: "这道题老师讲过做法，但我发现了一种更优雅的证明方式...只花了三小时。", powers: ["能推导考纲外的公式并拿 method mark", "对抽象概念的理解力极强", "永远能问出让老师愣住的问题", "Independent research 能力超群"], weaknesses: ["考试经常写超时不写完", "在 simple question 上丢分因为想太多", "对'死记硬背'零容忍", "社交活动 participation 接近零"], advice: ["考试不是研讨会控制答题时间", "有时候 accept 结论比推导更重要", "偶尔和人说说话不收费"], partners: "INTJ, ENTP, ISTP", emoji: "🤓", color: "#00B894" },
  ESTP: { code: "ESTP", name: "DDL 极限运动家", tagline: "Deadline 是第一生产力", description: "你的人生哲学是：'为什么今天能做的事要拖到明天？因为明天才是 deadline 啊！' 你在 pressure 下的表现堪称艺术。", quote: "Deadline 前 6 小时的我，是量子计算级别的存在。", powers: ["12 小时 marathon 学习产出惊人", "压力下发挥超常", "能同时处理 multiple deadlines", "Emergency mode 下效率是平时的 10 倍"], weaknesses: ["没有 deadline 就瘫痪", "睡眠严重不足", "质量随时间呈指数下降", "经常提交前一分钟发现格式错误"], advice: ["给自己设定假的 deadline", "别每次都玩命心脏受不了", "稍微提前开始质量会好 10 倍"], partners: "ESFP, ISTP, ENTP", emoji: "⚡", color: "#F39C12" },
  ESFP: { code: "ESFP", name: "社团女王/王子", tagline: "学习只是选修，社交才是主课", description: "你是学校最耀眼的那颗星。你是 Student Council 主席、Drama Club 主角、慈善晚会组织者——同时还在考 A-Level。", quote: "我的 extracurriculars 比我的 personal statement 还长。", powers: ["Networking 能力碾压同龄人", "Leadership experience 写满 CV", "在任何场合都能游刃有余", "Multitasking 能力惊人"], weaknesses: ["学习时间被活动挤占", "偶尔因为 party 太多而睡过头错过考试", "Deep work 能力有待提高", "父母担心你'不务正业'"], advice: ["学会说'这个我就不参加了'", "找几个安静的专注时间段", "你的经历是优势但也别忘了刷题"], partners: "ESTP, ISFP, ENFP", emoji: "🌟", color: "#FF6B9D" },
  ENFP: { code: "ENFP", name: "点子永动机", tagline: "I have a plan! (我有 100 个)", description: "你的大脑是一个永不停歇的创意工厂。每一个新概念都能激发 10 个新想法，每一个想法都让你兴奋不已——问题是，你很少能把它们全部执行完。", quote: "我有 47 个复习计划，总有一个能成功的！", powers: ["Brainstorming 时无人能敌", "Personal statement 创意满满", "能把枯燥的知识点讲得有趣", "Adaptability 极强计划变了也不怕"], weaknesses: ["计划太多执行太少", "经常学到一半被新兴趣带跑", "笔记 scattered 在 20 个不同的地方", "Deadline 前同时推进 5 个计划"], advice: ["选一个计划就 ONE 执行到底", "用番茄钟保持 focus", "别在复习时开新坑"], partners: "ENTP, INFP, ENFJ", emoji: "💡", color: "#FFD93D" },
  ENTP: { code: "ENTP", name: "Plans 批发商", tagline: "我的计划是：不做计划", description: "你热衷于制定各种 elaborate 的学习计划——然后用同样的热情把它们全部推翻。你是 devil's advocate，喜欢挑战常规。", quote: "我制定计划的速度和执行计划的决心成完美的反比。", powers: ["Debate 和 argumentation 无人能敌", "Critical thinking 角度刁钻", "能用 unconventional method 解题", "老师又爱又恨的'问题学生'"], weaknesses: ["计划永远在变从未执行", "因为 argue 而浪费考试时间", "对传统学习方法不屑一顾", "父母和老师血压常年偏高"], advice: ["选定一个方法坚持至少一周", "考试中先答题再 challenge 题目", "你的质疑精神是优势但别用在 deadline 上"], partners: "ENFP, INTP, ESTP", emoji: "😈", color: "#A855F7" },
  ESTJ: { code: "ESTJ", name: "卷王之王", tagline: "卷是一种态度，更是一种生活方式", description: "你是 A-Level 食物链顶端的掠食者。你的日程表精确到 15 分钟，你的笔记是行业标杆，你的 past paper 刷题量让统计学家都惊叹。", quote: "我的 Excel 成绩追踪表有 12 个 sheet，每个都有 conditional formatting。", powers: ["班级复习群的创建者和管理员", "Shared resources 文件夹组织得比图书馆还好", "永远第一个完成复习计划", "Motivation 和执行力都是 MAX"], weaknesses: ["对别人不够卷感到愤怒", "偶尔因为 plan 被打乱而崩溃", "Relax 是一种陌生的概念", "朋友觉得和你玩压力太大"], advice: ["允许别人有自己的节奏", "偶尔 unplanned 一下 spontaneity 也有乐趣", "你不是机器休息不是罪恶"], partners: "ESTP, ISTJ, ENTJ", emoji: "👑", color: "#E74C3C" },
  ESFJ: { code: "ESFJ", name: "班级班长妈妈", tagline: "我来照顾你们，顺便拿个 A", description: "你是 A-Level 班级里的大家长。你记得每个人的生日、知道谁最近压力大、会在 exam season 给大家带自制 cookies。", quote: "我带了 cookies 来复习室，大家不要客气！还有...谁需要我讲讲这道题？", powers: ["班级凝聚力因你而增强", "Study group 的组织核心", "Emotional support 专业户", "老师最信赖的得力助手"], weaknesses: ["太在乎别人的看法", "容易因为帮助别人而耽误自己复习", "拒绝别人会产生强烈 guilt", "偶尔会因为太在意 harmony 而不表达真实想法"], advice: ["先照顾好自己才有能力照顾别人", "学会 delegate 不用什么事都亲力亲为", "你的善良很珍贵但也要有边界"], partners: "ISFJ, ENFJ, ESFP", emoji: "🍪", color: "#FF8A65" },
  ENFJ: { code: "ENFJ", name: "鸡汤大师", tagline: "不仅能拿 A*，还能带你一起拿", description: "你是天生的 leader 和 motivator。你不仅自己成绩好，还热衷于帮助身边的人一起进步。你的 Instagram story 全是励志语录和学习打卡。", quote: "一个人走得快，一群人走得远——但首先你自己要能走到终点。", powers: ["Public speaking 和 presentation 能力 MAX", "Peer teaching 让你自己理解更深", "Motivational 能量感染全班", "Personal statement 体现出 genuine leadership"], weaknesses: ["把太多精力花在帮助别人上", "自己的情绪容易被别人的情绪影响", "偶尔会因为太理想主义而失望", "burnout 风险极高"], advice: ["设定'帮助别人'的时间上限", "你的价值不取决于你帮了多少人", "也要允许自己被照顾"], partners: "ENFP, INFJ, ESFJ", emoji: "🦸", color: "#26C6DA" },
  ENTJ: { code: "ENTJ", name: "未来 CEO", tagline: "A-Level 只是我的 IPO 路演", description: "你对待 A-Level 就像对待一个商业项目——目标明确、策略清晰、执行 ruthlessly efficient。你是那个在 16 岁就已经有了 10 年人生规划的人。", quote: "我不是在参加 A-Level 考试，我在运行一个名为'我的人生'的 startup。", powers: ["Long-term vision 清晰得可怕", "Networking 和 self-promotion 天赋异禀", "Leadership 是天生的不是学的", "在任何竞争中都能脱颖而出"], weaknesses: ["对失败者 zero tolerance", "Work-life balance 是什么？", "容易因为过于 aggressive 而得罪人", "偶尔忘记了学习的乐趣"], advice: ["Success 不是唯一重要的东西", "偶尔停下来看看路边的风景", "Empathy 也是一种 strength"], partners: "ENTP, INTJ, ESTJ", emoji: "🚀", color: "#AB47BC" },
};

export function calculatePersonality(
  answers: number[],
  questions: Question[] = QUESTIONS
): { code: string; dimensions: Record<string, number> } {
  const scores: Record<string, number> = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };

  answers.forEach((answerIdx, qIdx) => {
    const q = questions[qIdx];
    if (!q || answerIdx < 0 || answerIdx >= q.options.length) return;
    const opt = q.options[answerIdx];
    Object.entries(opt.scores).forEach(([dim, val]) => {
      scores[dim] = (scores[dim] || 0) + val;
    });
  });

  const code = [
    scores.E >= scores.I ? "E" : "I",
    scores.S >= scores.N ? "S" : "N",
    scores.T >= scores.F ? "T" : "F",
    scores.J >= scores.P ? "J" : "P",
  ].join("");

  return { code, dimensions: scores };
}

export function getDimensionPercentages(dimensions: Record<string, number>) {
  const safePct = (a: number, b: number) => (a + b) === 0 ? 50 : (a / (a + b)) * 100;
  return {
    EI: { left: safePct(dimensions.E, dimensions.I), label: "E/I" },
    SN: { left: safePct(dimensions.S, dimensions.N), label: "S/N" },
    TF: { left: safePct(dimensions.T, dimensions.F), label: "T/F" },
    JP: { left: safePct(dimensions.J, dimensions.P), label: "J/P" },
  };
}
