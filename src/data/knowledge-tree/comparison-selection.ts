export function isKnowledgeComparisonValid(
  codeA: string,
  codeB: string,
  paperA: string | null,
  paperB: string | null,
): boolean {
  if (!codeA || !codeB) return false;
  if (codeA !== codeB) return true;
  return Boolean(paperA && paperB && paperA !== paperB);
}

export function getKnowledgeComparisonPrompt(
  codeA: string,
  codeB: string,
  paperA: string | null,
  paperB: string | null,
): string {
  if (codeA === codeB && (!paperA || !paperB)) {
    return "同一课程比较时，请分别选择两张 Paper";
  }
  if (codeA === codeB && paperA === paperB) {
    return "请选择同一课程中的两张不同 Paper";
  }
  return "请选择两个课程，或同一课程中的两张不同 Paper";
}
