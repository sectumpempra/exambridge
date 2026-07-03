/**
 * Paper 考纲知识点数据
 * 由 agent 集群生成，包含 10 份 Paper 的结构化考纲
 * JSON 文件通过动态导入加载，避免打包进主 bundle
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

// Dynamic import map — each JSON becomes its own chunk
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SYLLABUS_IMPORTS: Record<string, () => Promise<any>> = {
  "CAIE-9709-P1": () => import("./syllabus/caie-9709-p1-syllabus.json"),
  "CAIE-9709-P2": () => import("./syllabus/caie-9709-p2-syllabus.json"),
  "CAIE-9709-P3": () => import("./syllabus/caie-9709-p3-syllabus.json"),
  "CAIE-9709-P4": () => import("./syllabus/caie-9709-p4-syllabus.json"),
  "CAIE-9709-P5": () => import("./syllabus/caie-9709-p5-syllabus.json"),
  "CAIE-9709-P6": () => import("./syllabus/caie-9709-p6-syllabus.json"),
  "CAIE-0580-P2": () => import("./syllabus/caie-0580-p2-syllabus.json"),
  "CAIE-0580-P4": () => import("./syllabus/caie-0580-p4-syllabus.json"),
  "EDX-4MA1-P1H": () => import("./syllabus/edx-4ma1-p1h-syllabus.json"),
  "EDX-4MA1-P2H": () => import("./syllabus/edx-4ma1-p2h-syllabus.json"),
};

// Cache for loaded syllabus data
const syllabusCache = new Map<string, PaperSyllabus>();

export async function loadSyllabus(paperId: string): Promise<PaperSyllabus | undefined> {
  // Check cache
  if (syllabusCache.has(paperId)) {
    return syllabusCache.get(paperId)!;
  }

  const loader = SYLLABUS_IMPORTS[paperId];
  if (!loader) return undefined;

  try {
    const module = await loader();
    const data = module.default;
    syllabusCache.set(paperId, data);
    return data;
  } catch {
    return undefined;
  }
}

export async function loadAllSyllabus(): Promise<Record<string, PaperSyllabus>> {
  const entries = await Promise.all(
    Object.keys(SYLLABUS_IMPORTS).map(async (paperId) => {
      const data = await loadSyllabus(paperId);
      return [paperId, data] as const;
    })
  );
  const result: Record<string, PaperSyllabus> = {};
  for (const [id, data] of entries) {
    if (data) result[id] = data;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
// 跨 Paper 考纲对比算法（支持粒度不一致的 topicId）
// ═══════════════════════════════════════════════════════════

/** TopicId aliases: map variant names to canonical prefixes.
 *  Handles naming differences across exam boards (e.g. "trigonometry" vs "trig.*")
 */
const TOPIC_ALIASES: Record<string, string> = {
  // CAIE 0580 uses full names, Edexcel 4MA1 uses abbreviations
  "trigonometry": "trig",
  // CAIE 0580 puts mensuration at top level, 4MA1 nests under geometry
  "mensuration": "geometry.mensuration",
  // CAIE 0580 puts vectors under transformations, 4MA1 under algebra
  "transformations.vectors": "algebra.vectors",
};

/** Resolve a topicId through aliases, returning the canonical form. */
function resolveAlias(id: string): string {
  return TOPIC_ALIASES[id] || id;
}

/** Check if two topicIds match with hierarchical prefix logic.
 *  "number" matches "number.decimals.recurring" (prefix)
 *  "algebra.quadratics" does NOT match "algebra.functions" (different branches)
 *  Aliases are resolved before matching.
 */
function topicIdsMatch(idA: string, idB: string): boolean {
  const canonicalA = resolveAlias(idA);
  const canonicalB = resolveAlias(idB);
  if (canonicalA === canonicalB) return true;
  if (canonicalB.startsWith(canonicalA + ".")) return true;
  if (canonicalA.startsWith(canonicalB + ".")) return true;
  // Also check if resolved A matches original B (and vice versa)
  if (canonicalA.startsWith(idB + ".") || idB.startsWith(canonicalA + ".")) return true;
  if (canonicalB.startsWith(idA + ".") || idA.startsWith(canonicalB + ".")) return true;
  return false;
}

/** Find all matching topic pairs between two syllabus sets.
 *  Returns matched pairs + unmatched topics from each side.
 */
function findTopicMatches(topicsA: SyllabusTopic[], topicsB: SyllabusTopic[]) {
  const matchedA = new Set<number>(); // indices in topicsA
  const matchedB = new Set<number>(); // indices in topicsB
  const pairs: Array<{ idxA: number; idxB: number }> = [];

  for (let i = 0; i < topicsA.length; i++) {
    for (let j = 0; j < topicsB.length; j++) {
      if (matchedB.has(j)) continue;
      if (topicIdsMatch(topicsA[i].topicId, topicsB[j].topicId)) {
        matchedA.add(i);
        matchedB.add(j);
        pairs.push({ idxA: i, idxB: j });
        break;
      }
    }
  }

  return {
    pairs,
    unmatchedA: topicsA.filter((_, i) => !matchedA.has(i)),
    unmatchedB: topicsB.filter((_, j) => !matchedB.has(j)),
  };
}

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
  fullOverlap: number;
  partialOverlap: number;
  onlyInA: number;
  onlyInB: number;
  overlapRate: number;
  topics: TopicComparison[];
  categoryStats: Record<string, { full: number; partial: number; onlyA: number; onlyB: number; total: number }>;
}

export async function comparePapers(paperIdA: string, paperIdB: string): Promise<ComparisonResult | null> {
  const [sA, sB] = await Promise.all([loadSyllabus(paperIdA), loadSyllabus(paperIdB)]);
  if (!sA || !sB) return null;

  // Find hierarchical matches
  const { pairs, unmatchedA, unmatchedB } = findTopicMatches(sA.topics, sB.topics);

  const topics: TopicComparison[] = [];
  let fullOverlap = 0;
  let partialOverlap = 0;
  let onlyInA = 0;
  let onlyInB = 0;

  const categoryStats: ComparisonResult["categoryStats"] = {};

  // Process matched pairs
  for (const { idxA, idxB } of pairs) {
    const tA = sA.topics[idxA];
    const tB = sB.topics[idxB];

    const subA = new Set(tA.subtopics.map((s) => s.toLowerCase().trim()));
    const subB = new Set(tB.subtopics.map((s) => s.toLowerCase().trim()));

    const commonSubtopics: string[] = [];
    const onlyInASub: string[] = [];
    const onlyInBSub: string[] = [];

    const allSubs = new Set([...subA, ...subB]);
    for (const s of allSubs) {
      const inA = subA.has(s);
      const inB = subB.has(s);
      const original =
        tA.subtopics.find((x) => x.toLowerCase().trim() === s) ||
        tB.subtopics.find((x) => x.toLowerCase().trim() === s) ||
        s;
      if (inA && inB) commonSubtopics.push(original);
      else if (inA) onlyInASub.push(original);
      else onlyInBSub.push(original);
    }

    // Determine overlap type
    let overlapType: TopicComparison["overlapType"];
    const exactIdMatch = tA.topicId === tB.topicId;

    if (exactIdMatch && onlyInASub.length === 0 && onlyInBSub.length === 0) {
      overlapType = "full";
      fullOverlap++;
    } else {
      // Hierarchical match (different granularity) or subtopic differences
      overlapType = "partial";
      partialOverlap++;
    }

    // Use the shorter topicId as canonical (e.g. "number" not "number.decimals.recurring")
    const canonicalId = tA.topicId.length <= tB.topicId.length ? tA.topicId : tB.topicId;
    const name = tA.topicName.length <= tB.topicName.length ? tA.topicName : tB.topicName;
    const category = tA.topicCategory || tB.topicCategory || "Other";

    topics.push({
      topicId: canonicalId,
      topicName: name,
      category,
      inA: true,
      inB: true,
      overlapType,
      commonSubtopics,
      onlyInA: onlyInASub,
      onlyInB: onlyInBSub,
      difficultyA: tA.difficulty,
      difficultyB: tB.difficulty,
    });

    // Category stats
    if (!categoryStats[category]) {
      categoryStats[category] = { full: 0, partial: 0, onlyA: 0, onlyB: 0, total: 0 };
    }
    categoryStats[category].total++;
    categoryStats[category][overlapType === "full" ? "full" : "partial"]++;
  }

  // Process unmatched A topics
  for (const t of unmatchedA) {
    topics.push({
      topicId: t.topicId,
      topicName: t.topicName,
      category: t.topicCategory,
      inA: true,
      inB: false,
      overlapType: "only-a",
      commonSubtopics: [],
      onlyInA: t.subtopics,
      onlyInB: [],
      difficultyA: t.difficulty,
    });
    onlyInA++;

    const cat = t.topicCategory;
    if (!categoryStats[cat]) {
      categoryStats[cat] = { full: 0, partial: 0, onlyA: 0, onlyB: 0, total: 0 };
    }
    categoryStats[cat].total++;
    categoryStats[cat].onlyA++;
  }

  // Process unmatched B topics
  for (const t of unmatchedB) {
    topics.push({
      topicId: t.topicId,
      topicName: t.topicName,
      category: t.topicCategory,
      inA: false,
      inB: true,
      overlapType: "only-b",
      commonSubtopics: [],
      onlyInA: [],
      onlyInB: t.subtopics,
      difficultyB: t.difficulty,
    });
    onlyInB++;

    const cat = t.topicCategory;
    if (!categoryStats[cat]) {
      categoryStats[cat] = { full: 0, partial: 0, onlyA: 0, onlyB: 0, total: 0 };
    }
    categoryStats[cat].total++;
    categoryStats[cat].onlyB++;
  }

  // Sort: only-a → only-b → partial → full
  topics.sort((a, b) => {
    const order = { "only-a": 0, "only-b": 1, partial: 2, full: 3 };
    return order[a.overlapType] - order[b.overlapType];
  });

  const total = pairs.length + unmatchedA.length + unmatchedB.length;
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
