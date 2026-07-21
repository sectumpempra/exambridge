const EXPLICIT_CODE = /\b(?:0580|9709|9231|4ma1|8ma0|yma01|xfm01|yfm01|xma01|7357|7367|h240|h245|h640|6993)\b/i;

export type QualificationAmbiguity = {
  ambiguityClass: "generic-a-level-mathematics" | "generic-igcse-mathematics" | "pearson-route";
  clarification: string;
};

export function detectQualificationAmbiguity(message: string, locale: "zh-CN" | "en-GB" = "zh-CN"): QualificationAmbiguity | undefined {
  if (EXPLICIT_CODE.test(message)) return undefined;
  const normalized = message.toLowerCase();
  const hasBoard = /cambridge|caie|剑桥|pearson|edexcel|培生|爱德思|aqa|ocr/.test(normalized);
  const asksMath = /math|数学/.test(normalized);
  if (asksMath && /(?:igcse|i\s*g\b|ig数学|国际gcse)/i.test(message) && !hasBoard) {
    return {
      ambiguityClass: "generic-igcse-mathematics",
      clarification: locale === "en-GB"
        ? "Do you mean Cambridge IGCSE Mathematics 0580 or Pearson Edexcel International GCSE Mathematics A 4MA1?"
        : "你指的是 Cambridge IGCSE Mathematics 0580，还是 Pearson Edexcel International GCSE Mathematics A 4MA1？",
    };
  }
  if (asksMath && /(?:a[ -]?level|\bal\b|alevel|a级|a水准)/i.test(message) && !hasBoard) {
    return {
      ambiguityClass: "generic-a-level-mathematics",
      clarification: locale === "en-GB"
        ? "Which board and route do you mean—for example CAIE 9709, AQA 7357, OCR H240/H640, or Pearson International A Level Mathematics YMA01?"
        : "你指的是哪个考试局和路线，例如 CAIE 9709、AQA 7357、OCR H240/H640，还是 Pearson International A Level Mathematics YMA01？",
    };
  }
  if (asksMath && /pearson|edexcel|培生|爱德思/.test(normalized)
    && !/international|ial|igcse|国际|uk|英国|as\b|a[ -]?level/.test(normalized)) {
    return {
      ambiguityClass: "pearson-route",
      clarification: locale === "en-GB"
        ? "Do you mean a Pearson UK qualification or Pearson International Mathematics? Please provide the code if possible."
        : "你指的是 Pearson UK 数学资格，还是 Pearson International 数学？如可以，请提供课程代码。",
    };
  }
  return undefined;
}
