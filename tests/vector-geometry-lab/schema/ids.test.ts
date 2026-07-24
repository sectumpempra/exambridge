import { describe, expect, it } from "vitest";
import { createId } from "@/features/vector-geometry-lab/schema";

describe("createId", () => {
  it("uses the given prefix", () => {
    expect(createId("point").startsWith("point_")).toBe(true);
  });

  it("defaults to the id prefix", () => {
    expect(createId().startsWith("id_")).toBe(true);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId("t")));
    expect(ids.size).toBe(200);
  });

  it("produces JSON-serializable plain strings", () => {
    const id = createId("scene");
    expect(JSON.parse(JSON.stringify(id))).toBe(id);
  });

  it("falls back to a local Math.random id when Web Crypto is unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const id = createId("fallback");
      expect(id.startsWith("fallback_")).toBe(true);
      expect(id).not.toBe(createId("fallback"));
    } finally {
      if (descriptor !== undefined) {
        Object.defineProperty(globalThis, "crypto", descriptor);
      }
    }
  });
});
