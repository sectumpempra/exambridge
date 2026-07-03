/**
 * Paper 考纲知识点数据
 * 由 agent 集群生成，包含 10 份 Paper 的结构化考纲
 */

export interface SyllabusTopic {
  topicId: string;
  topicName: string;
  topicCategory: string;
  subtopics: string[];
  description: string;
  difficulty: "Foundation" | "Standard" | "Advanced";
}

export interface PaperSyllabus {
  paperId: string;
  board: string;
  qualification: string;
  subjectCode: string;
  paperNumber: string;
  syllabusVersion: string;
  totalTopics: number;
  topics: SyllabusTopic[];
}

// ═══════════════════════════════════════════════════════════
// CAIE 9709 — A-Level Mathematics
// ═══════════════════════════════════════════════════════════
import caie9709p1 from "./syllabus/caie-9709-p1-syllabus.json";
import caie9709p2 from "./syllabus/caie-9709-p2-syllabus.json";
import caie9709p3 from "./syllabus/caie-9709-p3-syllabus.json";
import caie9709p4 from "./syllabus/caie-9709-p4-syllabus.json";
import caie9709p5 from "./syllabus/caie-9709-p5-syllabus.json";
import caie9709p6 from "./syllabus/caie-9709-p6-syllabus.json";

// ═══════════════════════════════════════════════════════════
// CAIE 0580 — IGCSE Mathematics (Extended)
// ═══════════════════════════════════════════════════════════
import caie0580p2 from "./syllabus/caie-0580-p2-syllabus.json";
import caie0580p4 from "./syllabus/caie-0580-p4-syllabus.json";

// ═══════════════════════════════════════════════════════════
// Edexcel 4MA1 — IGCSE Mathematics A (Higher)
// ═══════════════════════════════════════════════════════════
import edx4ma1p1h from "./syllabus/edx-4ma1-p1h-syllabus.json";
import edx4ma1p2h from "./syllabus/edx-4ma1-p2h-syllabus.json";

const ALL_SYLLABUS_RAW = [
  caie9709p1, caie9709p2, caie9709p3, caie9709p4, caie9709p5, caie9709p6,
  caie0580p2, caie0580p4,
  edx4ma1p1h, edx4ma1p2h,
];

export const ALL_SYLLABUS: PaperSyllabus[] = ALL_SYLLABUS_RAW as PaperSyllabus[];

export const PAPER_SYLLABUS_MAP: Record<string, PaperSyllabus> = (() => {
  const map: Record<string, PaperSyllabus> = {};
  for (const s of ALL_SYLLABUS) {
    map[s.paperId] = s;
  }
  return map;
})();

export function getSyllabusForPaper(paperId: string): PaperSyllabus | undefined {
  return PAPER_SYLLABUS_MAP[paperId];
}

// ═══════════════════════════════════════════════════════════
// 跨 Paper 考纲对比算法
// ═══════════════════════════════════════════════════════════

export interface TopicComparison {
  topicId: string;
  topicName: string;
  category: string;
  inA: boolean;
  inB: boolean;
  overlapType: "full" | "partial" | "only-a" | "only-b";
  /** 共同子知识点 */
  commonSubtopics: string[];
  /** Paper A 独有子知识点 */
  onlyInA: string[];
  /** Paper B 独有子知识点 */
  onlyInB: string[];
  /** Paper A 的 difficulty */
  difficultyA?: string;
  /** Paper B 的 difficulty */
  difficultyB?: string;
}

export interface ComparisonResult {
  paperA: { paperId: string; name: string };
  paperB: { paperId: string; name: string };
  totalUniqueTopics: number;
  fullOverlap: number;   // 完全重合（topic + 子知识点都相同）
  partialOverlap: number; // 部分重合（topic 相同，子知识点不同）
  onlyInA: number;
  onlyInB: number;
  overlapRate: number;
  topics: TopicComparison[];
  /** 按 category 分组统计 */
  categoryStats: Record<string, { full: number; partial: number; onlyA: number; onlyB: number; total: number }>;
}

export function comparePapers(paperIdA: string, paperIdB: string): ComparisonResult | null {
  const sA = PAPER_SYLLABUS_MAP[paperIdA];
  const sB = PAPER_SYLLABUS_MAP[paperIdB];
  if (!sA || !sB) return null;

  const topicsA = new Map(sA.topics.map((t) => [t.topicId, t]));
  const topicsB = new Map(sB.topics.map((t) => [t.topicId, t]));

  const allTopicIds = new Set([...topicsA.keys(), ...topicsB.keys()]);
  const topics: TopicComparison[] = [];
  let fullOverlap = 0;
  let partialOverlap = 0;
  let onlyInA = 0;
  let onlyInB = 0;

  const categoryStats: ComparisonResult["categoryStats"] = {};

  for (const tid of allTopicIds) {
    const tA = topicsA.get(tid);
    const tB = topicsB.get(tid);

    const subA = new Set(tA?.subtopics.map((s) => s.toLowerCase().trim()) || []);
    const subB = new Set(tB?.subtopics.map((s) => s.toLowerCase().trim()) || []);

    const commonSubtopics: string[] = [];
    const onlyInASub: string[] = [];
    const onlyInBSub: string[] = [];

    if (tA && tB) {
      // Both have this topic — check subtopic overlap
      const allSubs = new Set([...subA, ...subB]);
      for (const s of allSubs) {
        const inA = subA.has(s);
        const inB = subB.has(s);
        // Find original casing from tA or tB
        const original =
          tA.subtopics.find((x) => x.toLowerCase().trim() === s) ||
          tB.subtopics.find((x) => x.toLowerCase().trim() === s) ||
          s;
        if (inA && inB) commonSubtopics.push(original);
        else if (inA) onlyInASub.push(original);
        else onlyInBSub.push(original);
      }
    }

    let overlapType: TopicComparison["overlapType"];
    if (tA && tB) {
      if (onlyInASub.length === 0 && onlyInBSub.length === 0) {
        overlapType = "full";
        fullOverlap++;
      } else {
        overlapType = "partial";
        partialOverlap++;
      }
    } else if (tA) {
      overlapType = "only-a";
      onlyInA++;
      onlyInASub.push(...(tA?.subtopics || []));
    } else {
      overlapType = "only-b";
      onlyInB++;
      onlyInBSub.push(...(tB?.subtopics || []));
    }

    const name = tA?.topicName || tB?.topicName || tid;
    const category = tA?.topicCategory || tB?.topicCategory || "Other";

    topics.push({
      topicId: tid,
      topicName: name,
      category,
      inA: !!tA,
      inB: !!tB,
      overlapType,
      commonSubtopics,
      onlyInA: onlyInASub,
      onlyInB: onlyInBSub,
      difficultyA: tA?.difficulty,
      difficultyB: tB?.difficulty,
    });

    // Category stats
    if (!categoryStats[category]) {
      categoryStats[category] = { full: 0, partial: 0, onlyA: 0, onlyB: 0, total: 0 };
    }
    categoryStats[category].total++;
    if (overlapType === "full") categoryStats[category].full++;
    else if (overlapType === "partial") categoryStats[category].partial++;
    else if (overlapType === "only-a") categoryStats[category].onlyA++;
    else if (overlapType === "only-b") categoryStats[category].onlyB++;
  }

  // Sort: only-a → only-b → partial → full
  topics.sort((a, b) => {
    const order = { "only-a": 0, "only-b": 1, partial: 2, full: 3 };
    return order[a.overlapType] - order[b.overlapType];
  });

  const total = allTopicIds.size;
  const overlapRate = total > 0 ? Math.round(((fullOverlap + partialOverlap) / total) * 100) : 0;

  return {
    paperA: { paperId: paperIdA, name: `${sA.board} ${sA.subjectCode} Paper ${sA.paperNumber}` },
    paperB: { paperId: paperIdB, name: `${sB.board} ${sB.subjectCode} Paper ${sB.paperNumber}` },
    totalUniqueTopics: total,
    fullOverlap,
    partialOverlap,
    onlyInA,
    onlyInB,
    overlapRate,
    topics,
    categoryStats,
  };
}
