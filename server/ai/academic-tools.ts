import {
  AcademicResultsManifestV2Schema,
  BOUNDARY_PREDICTION_DISCLAIMER_VERSION,
  BoundaryPredictionErrorV1,
  calculateQualificationAwardV2,
  predictGradeBoundaryV1,
  type AcademicResultsManifestV2,
} from "@/domain-v2/academic-results";
import type { AIChatRequest } from "@/domain-v2/ai-assistant";

export type AcademicToolName =
  | "lookup_grade_boundary"
  | "lookup_grade_statistics"
  | "calculate_qualification_award"
  | "explain_qualification_rule"
  | "compare_qualification_rules"
  | "compare_subjects"
  | "calculate_transition_difficulty"
  | "evaluate_student_readiness"
  | "explain_boundary_prediction";

export type AcademicToolCall = {
  name: AcademicToolName;
  status: "ok" | "data-unavailable" | "consent-required" | "input-required" | "invalid-input";
  result: unknown;
  sourceIds: string[];
};

export type AcademicToolContext = {
  activeBatch: string | null;
  dataPolicy: string;
  calls: AcademicToolCall[];
};

const latestUserMessage = (request: AIChatRequest) =>
  [...request.messages].reverse().find(message => message.role === "user")?.content ?? "";

const has = (message: string, pattern: RegExp) => pattern.test(message.toLowerCase());

export function detectAcademicToolIntents(request: AIChatRequest): Set<AcademicToolName> {
  const message = latestUserMessage(request);
  const intents = new Set<AcademicToolName>();
  if (has(message, /分数线|等级线|grade\s*boundar|threshold/)) intents.add("lookup_grade_boundary");
  if (has(message, /grade\s*statistic|成绩统计|等级比例|报考人数|获得率|通过率/)) intents.add("lookup_grade_statistics");
  if (request.academicQuery?.type === "award-calculation" || has(message, /合分|总分怎么|cash[ -]?in|ums|算(?:最终)?等级|award mark/)) {
    intents.add(request.academicQuery?.type === "award-calculation" ? "calculate_qualification_award" : "explain_qualification_rule");
  }
  if (has(message, /考试规则|合分规则|重考|carry[ -]?forward|locking|组合规则/)) intents.add("explain_qualification_rule");
  if (has(message, /(?:两个|两门|不同).*(?:考试局|规则)|考试局.*(?:区别|对比)|compare.*rule/)) intents.add("compare_qualification_rules");
  if (has(message, /(?:科目|课程).*(?:区别|对比)|(?:区别|对比).*(?:科目|课程)/)) intents.add("compare_subjects");
  if (has(message, /难度|difficulty|升读.*(?:差异|跨度)|过渡.*难/)) intents.add("calculate_transition_difficulty");
  if (request.anonymousMastery?.length || has(message, /掌握度|具体缺口|准备好|readiness|薄弱知识/)) intents.add("evaluate_student_readiness");
  if (has(message, /预测[^。！？]{0,30}(?:分数线|等级线)|predicted?\s*(?:grade\s*)?boundar/)) intents.add("explain_boundary_prediction");
  if (request.academicQuery?.type === "lookup") {
    intents.add("lookup_grade_boundary");
    intents.add("lookup_grade_statistics");
  }
  return intents;
}

const unique = (values: string[]) => [...new Set(values)];

const parseYear = (request: AIChatRequest) => {
  if (request.academicQuery?.type === "lookup" && request.academicQuery.year) return request.academicQuery.year;
  const match = /\b(20\d{2})\b/.exec(latestUserMessage(request));
  return match ? Number(match[1]) : undefined;
};

const parseSeries = (request: AIChatRequest) => {
  if (request.academicQuery?.type === "lookup") return request.academicQuery.series;
  const message = latestUserMessage(request).toLowerCase();
  if (/january|jan(?:uary)?|一月|1月/.test(message)) return "january" as const;
  if (/march|mar(?:ch)?|三月|3月/.test(message)) return "march" as const;
  if (/june|may\s*\/\s*june|夏季|六月|6月|5\s*\/\s*6月/.test(message)) return "june" as const;
  if (/november|october\s*\/\s*november|冬季|十一月|11月|10\s*\/\s*11月/.test(message)) return "november" as const;
  return undefined;
};

const recordMatches = (
  record: { qualificationVersionId: string; awardQualificationId: string; year?: number; series?: string; routeId?: string; tier?: string },
  qualificationVersionIds: string[],
  request: AIChatRequest,
) => {
  const query = request.academicQuery;
  const awardQualificationId = query?.awardQualificationId;
  const year = parseYear(request);
  const series = parseSeries(request);
  const routeId = query?.routeId;
  const tier = query?.type === "lookup" ? query.tier : undefined;
  return (qualificationVersionIds.length === 0 || qualificationVersionIds.includes(record.qualificationVersionId))
    && (!awardQualificationId || record.awardQualificationId === awardQualificationId)
    && (!year || record.year === year)
    && (!series || record.series === series)
    && (!routeId || record.routeId === routeId)
    && (!tier || record.tier === tier);
};

export function buildAcademicToolContext(
  request: AIChatRequest,
  manifestValue: unknown,
  qualificationVersionIds: string[],
): AcademicToolContext | undefined {
  const intents = detectAcademicToolIntents(request);
  if (intents.size === 0) return undefined;
  const manifest: AcademicResultsManifestV2 = AcademicResultsManifestV2Schema.parse(manifestValue);
  const approvedBoundaries = manifest.boundaries.filter(record => record.verificationStatus === "owner-approved");
  const approvedStatistics = manifest.statistics.filter(record => record.verificationStatus === "owner-approved");
  const approvedRules = manifest.awardRules.filter(record => record.verificationStatus === "owner-approved");
  const approvedDifficultyProfiles = manifest.difficultyProfiles.filter(record => record.verificationStatus === "owner-approved");
  const calls: AcademicToolCall[] = [];
  const add = (name: AcademicToolName, records: unknown[], sourceIds: string[]) => calls.push({
    name,
    status: records.length > 0 ? "ok" : "data-unavailable",
    result: records,
    sourceIds: unique(sourceIds),
  });

  if (intents.has("lookup_grade_boundary")) {
    const records = approvedBoundaries.filter(record => recordMatches(record, qualificationVersionIds, request));
    add("lookup_grade_boundary", records, records.flatMap(record => record.sourceIds));
  }
  if (intents.has("lookup_grade_statistics")) {
    const records = approvedStatistics.filter(record => recordMatches(record, qualificationVersionIds, request));
    add("lookup_grade_statistics", records, records.flatMap(record => record.sourceIds));
  }
  if (intents.has("explain_qualification_rule")) {
    const records = approvedRules.filter(record =>
      (qualificationVersionIds.length === 0 || qualificationVersionIds.includes(record.qualificationVersionId))
      && (!request.academicQuery?.awardQualificationId || record.awardQualificationId === request.academicQuery.awardQualificationId),
    );
    add("explain_qualification_rule", records, records.flatMap(record => record.sourceIds));
  }
  if (intents.has("compare_qualification_rules")) {
    const records = approvedRules.filter(record => qualificationVersionIds.includes(record.qualificationVersionId));
    add("compare_qualification_rules", records, records.flatMap(record => record.sourceIds));
  }
  if (intents.has("compare_subjects")) {
    const records = approvedDifficultyProfiles.filter(record =>
      qualificationVersionIds.includes(record.sourceQualificationVersionId)
      && qualificationVersionIds.includes(record.targetQualificationVersionId),
    );
    add("compare_subjects", records, records.flatMap(record => Object.values(record.dimensions).flatMap(dimension => dimension.sourceIds)));
  }
  if (intents.has("calculate_transition_difficulty")) {
    const records = approvedDifficultyProfiles.filter(record =>
      qualificationVersionIds.includes(record.sourceQualificationVersionId)
      && qualificationVersionIds.includes(record.targetQualificationVersionId),
    );
    add("calculate_transition_difficulty", records, records.flatMap(record => Object.values(record.dimensions).flatMap(dimension => dimension.sourceIds)));
  }
  if (intents.has("evaluate_student_readiness")) {
    const profiles = approvedDifficultyProfiles.filter(record =>
      qualificationVersionIds.includes(record.sourceQualificationVersionId)
      && qualificationVersionIds.includes(record.targetQualificationVersionId),
    );
    calls.push({
      name: "evaluate_student_readiness",
      status: profiles.length > 0 && request.anonymousMastery?.length ? "ok" : "input-required",
      result: {
        profiles,
        anonymousMastery: request.anonymousMastery ?? [],
        calculationPolicy: "Server requires the verified target concept set; the model must not infer missing nodes.",
      },
      sourceIds: unique(profiles.flatMap(record => Object.values(record.dimensions).flatMap(dimension => dimension.sourceIds))),
    });
  }
  if (intents.has("calculate_qualification_award")) {
    const query = request.academicQuery;
    if (query?.type !== "award-calculation") {
      calls.push({ name: "calculate_qualification_award", status: "input-required", result: null, sourceIds: [] });
    } else {
      const rule = approvedRules.find(record => record.ruleId === query.ruleId && record.awardQualificationId === query.awardQualificationId);
      const [year, series] = query.targetSeries.split("-");
      const boundary = approvedBoundaries.find(record =>
        record.awardQualificationId === query.awardQualificationId
        && record.routeId === query.routeId
        && record.year === Number(year)
        && record.series === series
        && record.boundaryScope === "overall",
      );
      if (!rule || !boundary) {
        calls.push({ name: "calculate_qualification_award", status: "data-unavailable", result: null, sourceIds: [] });
      } else {
        try {
          const result = calculateQualificationAwardV2(query, rule, boundary);
          calls.push({ name: "calculate_qualification_award", status: "ok", result, sourceIds: result.sourceIds });
        } catch (error) {
          calls.push({
            name: "calculate_qualification_award",
            status: "invalid-input",
            result: { error: error instanceof Error ? error.message : "invalid-input" },
            sourceIds: unique([...rule.sourceIds, ...boundary.sourceIds]),
          });
        }
      }
    }
  }
  if (intents.has("explain_boundary_prediction")) {
    const consent = request.featureConsent?.boundaryPrediction;
    if (!consent?.enabled || consent.disclaimerVersion !== BOUNDARY_PREDICTION_DISCLAIMER_VERSION) {
      calls.push({
        name: "explain_boundary_prediction",
        status: "consent-required",
        result: { disclaimerVersion: BOUNDARY_PREDICTION_DISCLAIMER_VERSION },
        sourceIds: [],
      });
    } else {
      const query = request.academicQuery;
      const year = parseYear(request);
      const series = parseSeries(request);
      const awardQualificationId = query?.awardQualificationId;
      const routeId = query?.routeId;
      const qualificationVersionId = qualificationVersionIds[0];
      if (!year || !series || !awardQualificationId || !routeId || !qualificationVersionId) {
        calls.push({ name: "explain_boundary_prediction", status: "input-required", result: null, sourceIds: [] });
      } else {
        try {
          const result = predictGradeBoundaryV1({
            qualificationVersionId,
            awardQualificationId,
            routeId,
            targetYear: year,
            targetSeries: series,
            dataCutoff: new Date().toISOString().slice(0, 10),
            tier: query?.type === "lookup" ? query.tier : undefined,
            disclaimerAccepted: true,
            disclaimerVersion: consent.disclaimerVersion,
          }, approvedBoundaries);
          calls.push({ name: "explain_boundary_prediction", status: "ok", result, sourceIds: result.sampleBoundaryIds.flatMap(id => approvedBoundaries.find(boundary => boundary.boundaryId === id)?.sourceIds ?? []) });
        } catch (error) {
          calls.push({
            name: "explain_boundary_prediction",
            status: error instanceof BoundaryPredictionErrorV1 && error.code === "CONSENT_REQUIRED" ? "consent-required" : "data-unavailable",
            result: { error: error instanceof Error ? error.message : "prediction-unavailable" },
            sourceIds: [],
          });
        }
      }
    }
  }

  return {
    activeBatch: manifest.activationBatch,
    dataPolicy: "Only owner-approved active rows are queryable. Missing rows are never guessed. Predictions are non-official and consent-gated.",
    calls,
  };
}
