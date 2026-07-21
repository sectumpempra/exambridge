import type { AIPaperFact } from "./context-builder";

export type PaperFactCorrection = {
  paperId: string;
  field: "marks" | "durationMinutes";
};

function repairFactBlock(block: string, fact: AIPaperFact, corrections: PaperFactCorrection[]): string {
  let result = block;
  if (fact.marks !== undefined) {
    const patterns = [
      /((?:满分|总分)\s*[:：]?\s*)\d+(\s*分)?/gi,
      /((?:maximum\s+marks?|total\s+marks?|marks?)\s*[:：]?\s*)\d+/gi,
    ];
    for (const pattern of patterns) {
      result = result.replace(pattern, (match, prefix: string, suffix = "") => {
        const replacement = `${prefix}${fact.marks}${suffix}`;
        if (replacement !== match) corrections.push({ paperId: fact.paperId, field: "marks" });
        return replacement;
      });
    }
  }
  if (fact.durationMinutes !== undefined) {
    const patterns = [
      /((?:时长|考试时间)\s*[:：]?\s*)\d+(\s*(?:分钟|分))/gi,
      /((?:duration)\s*[:：]?\s*)\d+(\s*(?:minutes?|mins?))/gi,
    ];
    for (const pattern of patterns) {
      result = result.replace(pattern, (match, prefix: string, suffix: string) => {
        const replacement = `${prefix}${fact.durationMinutes}${suffix}`;
        if (replacement !== match) corrections.push({ paperId: fact.paperId, field: "durationMinutes" });
        return replacement;
      });
    }
  }
  return result;
}

function factMatcher(fact: AIPaperFact): RegExp {
  const code = fact.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const name = fact.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:\\bPaper\\s*${code}\\b|${name})`, "i");
}

export function enforceDeterministicPaperFacts(
  answer: string,
  facts: AIPaperFact[],
): { answer: string; corrections: PaperFactCorrection[] } {
  const completeFacts = facts.filter((fact) => fact.marks !== undefined || fact.durationMinutes !== undefined);
  const corrections: PaperFactCorrection[] = [];
  if (completeFacts.length === 0) return { answer, corrections };
  if (completeFacts.length === 1) {
    return { answer: repairFactBlock(answer, completeFacts[0], corrections), corrections };
  }

  const anchors = completeFacts
    .map((fact) => ({ fact, index: answer.search(factMatcher(fact)) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  if (anchors.length === 0) return { answer, corrections };

  let result = "";
  let cursor = 0;
  anchors.forEach((anchor, index) => {
    const end = anchors[index + 1]?.index ?? answer.length;
    result += answer.slice(cursor, anchor.index);
    result += repairFactBlock(answer.slice(anchor.index, end), anchor.fact, corrections);
    cursor = end;
  });
  result += answer.slice(cursor);
  return { answer: result, corrections };
}
