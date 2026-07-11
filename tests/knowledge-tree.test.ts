import { describe, it, expect } from "vitest";
import {
  validateTree,
  validateMapping,
  calculateOverlap,
} from "@/domain-v2/knowledge-tree/loader";
import type {
  KnowledgeTree,
  MappingFile,
} from "@/domain-v2/knowledge-tree/schema";

// ── Fixtures ──

function makeTree(nodes: KnowledgeTree["nodes"]): KnowledgeTree {
  return {
    version: "1.0",
    nodes,
  };
}

function makeMapping(overrides: Partial<MappingFile> = {}): MappingFile {
  return {
    board: "TEST",
    subjectCode: "0000",
    subjectName: "Test Subject",
    level: "A-Level",
    version: "1.0",
    totalTopics: 1,
    mappedTopics: 1,
    mappings: [],
    ...overrides,
  };
}

// ── Tree Validator ──

describe("Knowledge Tree Validator", () => {
  it("validates a correct tree", () => {
    const tree = makeTree([
      { nodeId: "root", name: "Root", level: 0, path: [] },
      { nodeId: "child1", name: "Child 1", level: 1, parentNodeId: "root", path: ["Root"] },
      { nodeId: "child2", name: "Child 2", level: 1, parentNodeId: "root", path: ["Root"] },
    ]);
    const result = validateTree(tree);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("detects duplicate nodeIds", () => {
    const tree = makeTree([
      { nodeId: "node1", name: "A", level: 0, path: [] },
      { nodeId: "node1", name: "B", level: 0, path: [] },
    ]);
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("DUPLICATE_NODE_ID");
  });

  it("detects missing parent", () => {
    const tree = makeTree([
      { nodeId: "child", name: "Child", level: 1, parentNodeId: "missing", path: ["Missing"] },
    ]);
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("MISSING_PARENT");
  });

  it("detects cycles", () => {
    const tree = makeTree([
      { nodeId: "a", name: "A", level: 0, parentNodeId: "b", path: [] },
      { nodeId: "b", name: "B", level: 1, parentNodeId: "a", path: ["A"] },
    ]);
    const result = validateTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "CYCLE_DETECTED")).toBe(true);
  });

  it("warns about empty path with level > 0", () => {
    const tree = makeTree([
      { nodeId: "root", name: "Root", level: 0, path: [] },
      { nodeId: "child", name: "Child", level: 1, parentNodeId: "root", path: [] },
    ]);
    const result = validateTree(tree);
    expect(result.warnings.some((w) => w.code === "EMPTY_PATH")).toBe(true);
  });
});

// ── Mapping Validator ──

describe("Mapping Validator", () => {
  const tree = makeTree([
    { nodeId: "n1", name: "Node 1", level: 0, path: [] },
    { nodeId: "n2", name: "Node 2", level: 0, path: [] },
  ]);

  it("validates a correct mapping", () => {
    const mapping = makeMapping({
      mappings: [{
        topicId: "t1",
        topicName: "Topic 1",
        paperReference: null,
        subtopicMappings: [{
          subtopicId: "s1",
          subtopicName: "Sub 1",
          paperReference: null,
          mappedNodes: [{ nodeId: "n1", matchStrength: "exact", matchReason: "test" }],
        }],
      }],
    });
    const result = validateMapping(mapping, tree);
    expect(result.valid).toBe(true);
  });

  it("detects unknown nodeId in mapping", () => {
    const mapping = makeMapping({
      mappings: [{
        topicId: "t1",
        topicName: "Topic 1",
        paperReference: null,
        subtopicMappings: [{
          subtopicId: "s1",
          subtopicName: "Sub 1",
          paperReference: null,
          mappedNodes: [{ nodeId: "n999", matchStrength: "exact", matchReason: "test" }],
        }],
      }],
    });
    const result = validateMapping(mapping, tree);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("UNKNOWN_NODE_ID");
  });

  it("warns about topic count mismatch", () => {
    const mapping = makeMapping({
      totalTopics: 5,
      mappings: [{
        topicId: "t1",
        topicName: "Topic 1",
        paperReference: null,
        subtopicMappings: [],
      }],
    });
    const result = validateMapping(mapping, tree);
    expect(result.warnings.some((w) => w.code === "TOPIC_COUNT_MISMATCH")).toBe(true);
  });
});

// ── Overlap Calculator ──

describe("Overlap Calculator", () => {
  const tree = makeTree([
    { nodeId: "n1", name: "Algebra", level: 0, path: [] },
    { nodeId: "n2", name: "Calculus", level: 0, path: [] },
    { nodeId: "n3", name: "Geometry", level: 0, path: [] },
    { nodeId: "n4", name: "Stats", level: 0, path: [] },
  ]);

  function makeSimpleMapping(subject: string, nodeIds: string[]): MappingFile {
    return makeMapping({
      subjectCode: subject,
      subjectName: `Subject ${subject}`,
      totalTopics: 1,
      mappedTopics: 1,
      mappings: [{
        topicId: `t-${subject}`,
        topicName: `Topic ${subject}`,
        paperReference: null,
        subtopicMappings: nodeIds.map((nid) => ({
          subtopicId: `s-${nid}`,
          subtopicName: `Sub ${nid}`,
          paperReference: null,
          mappedNodes: [{
            nodeId: nid,
            matchStrength: "exact" as const,
            matchReason: "test",
          }],
        })),
      }],
    });
  }

  it("calculates perfect overlap (same nodes)", () => {
    const mappingA = makeSimpleMapping("A", ["n1", "n2"]);
    const mappingB = makeSimpleMapping("B", ["n1", "n2"]);
    const result = calculateOverlap(
      { subjectA: "A", subjectB: "B" },
      mappingA, mappingB, tree
    );
    expect(result.sharedNodes.length).toBe(2);
    expect(result.aOnlyNodes.length).toBe(0);
    expect(result.bOnlyNodes.length).toBe(0);
    expect(result.jaccardUnweighted).toBe(1);
    expect(result.coverageA).toBe(1);
    expect(result.coverageB).toBe(1);
  });

  it("calculates no overlap", () => {
    const mappingA = makeSimpleMapping("A", ["n1", "n2"]);
    const mappingB = makeSimpleMapping("B", ["n3", "n4"]);
    const result = calculateOverlap(
      { subjectA: "A", subjectB: "B" },
      mappingA, mappingB, tree
    );
    expect(result.sharedNodes.length).toBe(0);
    expect(result.aOnlyNodes.length).toBe(2);
    expect(result.bOnlyNodes.length).toBe(2);
    expect(result.jaccardUnweighted).toBe(0);
    expect(result.coverageA).toBe(0);
    expect(result.coverageB).toBe(0);
  });

  it("calculates partial overlap", () => {
    const mappingA = makeSimpleMapping("A", ["n1", "n2", "n3"]);
    const mappingB = makeSimpleMapping("B", ["n2", "n3", "n4"]);
    const result = calculateOverlap(
      { subjectA: "A", subjectB: "B" },
      mappingA, mappingB, tree
    );
    expect(result.sharedNodes.length).toBe(2); // n2, n3
    expect(result.aOnlyNodes.length).toBe(1);  // n1
    expect(result.bOnlyNodes.length).toBe(1);  // n4
    expect(result.jaccardUnweighted).toBe(0.5); // 2/4
  });

  it("includes node names in results", () => {
    const mappingA = makeSimpleMapping("A", ["n1"]);
    const mappingB = makeSimpleMapping("B", ["n1"]);
    const result = calculateOverlap(
      { subjectA: "A", subjectB: "B" },
      mappingA, mappingB, tree
    );
    expect(result.sharedNodes[0].nodeName).toBe("Algebra");
  });

  it("produces stable sorted output", () => {
    const mappingA = makeSimpleMapping("A", ["n2", "n1"]);
    const mappingB = makeSimpleMapping("B", ["n2", "n1"]);
    const result1 = calculateOverlap(
      { subjectA: "A", subjectB: "B" },
      mappingA, mappingB, tree
    );
    const result2 = calculateOverlap(
      { subjectA: "A", subjectB: "B" },
      mappingA, mappingB, tree
    );
    expect(result1).toEqual(result2);
    // Check sorted order
    const ids = result1.sharedNodes.map((n) => n.nodeId);
    expect(ids).toEqual([...ids].sort());
  });

  it("is deterministic (same input = same output)", () => {
    const mappingA = makeSimpleMapping("A", ["n1", "n2", "n3"]);
    const mappingB = makeSimpleMapping("B", ["n2", "n3", "n4"]);
    const r1 = calculateOverlap({ subjectA: "A", subjectB: "B" }, mappingA, mappingB, tree);
    const r2 = calculateOverlap({ subjectA: "A", subjectB: "B" }, mappingA, mappingB, tree);
    expect(r1).toEqual(r2);
  });

  it("handles empty mappings", () => {
    const mappingA = makeSimpleMapping("A", []);
    const mappingB = makeSimpleMapping("B", []);
    const result = calculateOverlap(
      { subjectA: "A", subjectB: "B" },
      mappingA, mappingB, tree
    );
    expect(result.sharedNodes.length).toBe(0);
    expect(result.jaccardUnweighted).toBe(0);
    expect(isNaN(result.jaccardWeighted)).toBe(false);
  });
});
