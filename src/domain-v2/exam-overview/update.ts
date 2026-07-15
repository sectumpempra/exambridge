import { z } from "zod";
import { ExamOverviewSchema, type ExamOverview } from "./schema";

export const ExamOverviewCandidateSchema = ExamOverviewSchema.omit({ release: true }).extend({
  release: z.object({
    status: z.literal("candidate"),
    generatedAt: z.string(),
    sourceRun: z.string(),
  }),
});

export type ExamOverviewCandidate = z.infer<typeof ExamOverviewCandidateSchema>;

export type ExamOverviewDiff = {
  courseId: string;
  changedSections: string[];
  requiresApproval: true;
};

export function diffExamOverview(active: ExamOverview, candidate: ExamOverviewCandidate): ExamOverviewDiff {
  const sections: (keyof ExamOverview)[] = [
    "region", "examSeries", "paperCount", "nextExam", "components", "routes",
    "qualificationViews", "calculator", "formula", "practical", "upcomingSeries", "timetableStatus",
    "upcomingExams", "materials",
  ];
  return {
    courseId: active.id,
    changedSections: sections.filter((key) => JSON.stringify(active[key]) !== JSON.stringify(candidate[key])),
    requiresApproval: true,
  };
}
