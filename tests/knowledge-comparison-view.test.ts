import { describe, expect, it } from "vitest";
import {
  buildKnowledgeComparisonViewData,
  groupKnowledgeNodesByDomain,
  partitionKnowledgeNodes,
} from "@/data/knowledge-tree/comparison-view";
import type { KnowledgeTreeNode } from "@/data/knowledge-tree/types";
import type { OverlapResultV32 } from "@/data/knowledge-tree/types-v3.2";

function overlapResult(overrides: Partial<OverlapResultV32> = {}): OverlapResultV32 {
  return {
    subjectA: "CAIE-0580",
    subjectB: "Edexcel-4MA1",
    paperA: null,
    paperB: null,
    mode: "subject-vs-subject",
    unweighted: 97.3421926910299,
    weighted: 86.9,
    sharedNodes: [],
    aOnlyNodes: [],
    bOnlyNodes: [],
    sharedCount: 293,
    aTotal: 299,
    bTotal: 295,
    aName: "IGCSE Mathematics",
    bName: "International GCSE Mathematics A",
    ...overrides,
  };
}

describe("knowledge comparison view metrics", () => {
  it("keeps union overlap, emphasis similarity and directional coverage semantically separate", () => {
    const view = buildKnowledgeComparisonViewData(
      overlapResult(),
      "IGCSE Mathematics",
      "International GCSE Mathematics A",
    );

    expect(view.metrics.unionOverlap.overlap).toBe(293);
    expect(view.metrics.unionOverlap.total).toBe(301);
    expect(view.metrics.unionOverlap.percentage).toBeCloseTo((293 / 301) * 100);
    expect(view.metrics.emphasisSimilarity).toBe(86.9);
    expect(view.metrics.coverageA.percentage).toBeCloseTo((293 / 299) * 100);
    expect(view.metrics.coverageB.percentage).toBeCloseTo((293 / 295) * 100);
  });

  it("returns zero percentages for empty comparisons", () => {
    const view = buildKnowledgeComparisonViewData(
      overlapResult({ sharedCount: 0, aTotal: 0, bTotal: 0, weighted: 0, unweighted: 0 }),
      "A",
      "B",
    );

    expect(view.metrics.unionOverlap).toEqual({ overlap: 0, total: 0, percentage: 0 });
    expect(view.metrics.coverageA.percentage).toBe(0);
    expect(view.metrics.coverageB.percentage).toBe(0);
  });
});

describe("knowledge difference presentation", () => {
  const nodes: KnowledgeTreeNode[] = [
    {
      nodeId: "NUM",
      name: "Number",
      domain: "Number",
      path: ["Mathematics", "Number"],
      level: 1,
      description: "",
    },
    {
      nodeId: "NUM-FRAC",
      name: "Fractions",
      domain: "Number",
      parentNodeId: "NUM",
      path: ["Mathematics", "Number", "Fractions"],
      level: 2,
      description: "",
    },
    {
      nodeId: "ALG-EQN",
      name: "Equations",
      domain: "Algebra and Functions",
      path: ["Mathematics", "Algebra and Functions", "Equations"],
      level: 3,
      description: "",
    },
  ];

  it("puts end teaching points before taxonomy ancestors", () => {
    const result = partitionKnowledgeNodes(nodes, nodes);
    expect(result.teachingPoints.map((node) => node.nodeId)).toEqual(["NUM-FRAC", "ALG-EQN"]);
    expect(result.structuralNodes.map((node) => node.nodeId)).toEqual(["NUM"]);
  });

  it("groups teaching points by their top-level domain", () => {
    const groups = groupKnowledgeNodesByDomain(nodes.slice(1));
    expect(groups.map((group) => group.domain)).toEqual(["Algebra and Functions", "Number"]);
    expect(groups.find((group) => group.domain === "Number")?.items[0].nodeId).toBe("NUM-FRAC");
  });
});
