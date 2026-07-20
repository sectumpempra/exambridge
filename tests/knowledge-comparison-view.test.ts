import { describe, expect, it } from "vitest";
import {
  buildKnowledgeComparisonV5ViewData,
  groupKnowledgeNodesByDomain,
  partitionKnowledgeNodes,
} from "@/data/knowledge-tree/comparison-view";
import type { KnowledgeTreeNode } from "@/data/knowledge-tree/types";

describe("knowledge comparison view metrics", () => {
  it("keeps exact overlap and directional coverage separate without a legacy emphasis metric", () => {
    const view = buildKnowledgeComparisonV5ViewData({
      subjectA: "CAIE-0580:2025-2027",
      subjectB: "Edexcel-4MA1:Issue 2",
      paperA: null,
      paperB: null,
      exact: {
        sharedNodeIds: ["LINE"],
        aOnlyNodeIds: ["AXIS-3D"],
        bOnlyNodeIds: [],
        unionCount: 2,
        jaccard: 50,
        coverageA: 50,
        coverageB: 100,
      },
      aStatements: [],
      bStatements: [],
      counts: { shared: 2, partial: 1, exclusive: 1, unresolved: 3, "non-comparable": 2 },
    }, "0580", "4MA1");
    expect(view.version).toBe("5.0");
    expect(view.metrics.unionOverlap.percentage).toBe(50);
    expect(view.metrics.partialStatementCount).toBe(1);
    expect(view.metrics.unresolvedStatementCount).toBe(3);
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
