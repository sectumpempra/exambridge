import { describe, expect, it } from "vitest";
import type { AIChatRequest } from "@/domain-v2/ai-assistant";
import { buildUniversityAdmissionsToolContext } from "../server/ai/university-admissions-tools";
import { groundUniversityAdmissionsAnswer } from "../server/ai/university-admissions-grounding";

const request = (content: string): AIChatRequest => ({
  version: 2,
  mode: "exam_assistant",
  scopes: [],
  qualificationIds: [],
  syllabusVersions: [],
  pageContext: {
    pageType: "assistant-home",
    route: "/ai",
    selectedPaperIds: [],
    comparisonIds: [],
  },
  messages: [{ role: "user", content }],
  locale: "zh-CN",
});

describe("university admissions answer grounding", () => {
  const comparison = buildUniversityAdmissionsToolContext(
    request("比较剑桥和牛津 2027 数学本科录取要求的区别"),
  );

  it("rewrites an unsupported negative assessment claim", () => {
    const result = groundUniversityAdmissionsAnswer(
      "剑桥要求 TMUA 和 STEP；牛津仅要求 TMUA，不要求 STEP。",
      comparison,
      "zh-CN",
    );
    expect(result.answer).toContain("牛津：当前 active 记录列出的入学考试为 TMUA");
    expect(result.answer).toContain("不能据此断定“不要求”");
    expect(result.answer).not.toContain("牛津仅要求");
    expect(result.corrections).toEqual([
      expect.stringContaining("unsupported-negative-assessment-claim:STEP"),
    ]);
  });

  it("rewrites an unsupported college inference when campus and college are null", () => {
    const oxford = buildUniversityAdmissionsToolContext(
      request("牛津大学 2027 数学本科的录取要求是什么？"),
    );
    const result = groundUniversityAdmissionsAnswer(
      "牛津实行统一招生，具体学院不作限制。",
      oxford,
      "zh-CN",
    );
    expect(result.answer).toContain("当前 active 记录未说明具体校区或学院");
    expect(result.answer).not.toContain("不作限制");
    expect(result.corrections).toEqual([
      expect.stringContaining("unsupported-college-inference"),
    ]);
    expect(groundUniversityAdmissionsAnswer(
      "牛津大学：2027 年入学，未限定具体学院。",
      oxford,
      "zh-CN",
    ).answer).toContain("当前 active 记录未说明具体校区或学院");
  });

  it("does not alter a supported positive assessment statement", () => {
    const answer = "剑桥当前记录列出 TMUA 和 STEP，牛津当前记录列出 TMUA。";
    expect(groundUniversityAdmissionsAnswer(answer, comparison, "zh-CN")).toEqual({
      answer,
      corrections: [],
    });
  });

  it("rewrites universal and exclusive claims that overstate assessment scope", () => {
    const result = groundUniversityAdmissionsAnswer(
      "因此，剑桥申请人几乎确定需同时准备 TMUA 和 STEP，牛津申请人则仅需 TMUA。",
      comparison,
      "zh-CN",
    );
    expect(result.answer).toContain("剑桥：当前 active 记录列出 STEP（仅对部分申请人或特定条件适用）、TMUA（当前记录明确为所有申请人必须参加）");
    expect(result.answer).toContain("牛津：当前 active 记录列出 TMUA（当前记录明确为所有申请人必须参加）");
    expect(result.answer).toContain("不能因其他考试未列出就断定“仅需”");
    expect(result.answer).not.toContain("几乎确定");
    expect(result.answer).not.toContain("仅需 TMUA");
    expect(result.corrections).toEqual(expect.arrayContaining([
      expect.stringContaining("overstated-assessment-scope"),
      expect.stringContaining("unsupported-exclusive-assessment-claim"),
    ]));
  });
});
