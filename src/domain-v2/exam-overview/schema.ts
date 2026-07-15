import { z } from "zod";

export const ExamComponentSchema = z.object({
  code: z.string(),
  name: z.string(),
  group: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  marks: z.number().int().positive(),
  weighting: z.string(),
  calculator: z.enum(["allowed", "not-allowed", "required", "unknown"]),
  assessmentMode: z.enum([
    "written", "multiple-choice", "practical", "alternative-practical",
    "programming", "pre-release",
  ]).optional(),
  note: z.string().optional(),
});

export const ExamRouteSchema = z.object({
  id: z.string(),
  level: z.string(),
  label: z.string(),
  papers: z.array(z.string()).min(1),
  note: z.string().optional(),
});

export const ExamEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.string(),
  code: z.string(),
  title: z.string(),
  durationMinutes: z.number().int().positive(),
  group: z.string().optional(),
});

export const ExamMaterialSchema = z.object({
  id: z.string(),
  type: z.enum([
    "syllabus", "formula", "timetable", "update-notice",
    "data-booklet", "periodic-table", "practical-guidance", "reference-document",
  ]),
  title: z.string(),
  version: z.string(),
  status: z.enum(["current", "future", "reference"]),
  officialUrl: z.string().url(),
  previewUrl: z.string().min(1),
  note: z.string().optional(),
});

const QualificationViewSchema = z.object({
  key: z.enum(["ial", "ias"]),
  label: z.string(),
  paperCount: z.string(),
  routes: z.array(ExamRouteSchema),
  componentGroups: z.array(z.string()).optional(),
});

export const ExamOverviewSchema = z.object({
  id: z.string(),
  board: z.string(),
  qualification: z.string(),
  code: z.string(),
  region: z.object({ label: z.string(), note: z.string() }),
  examSeries: z.array(z.object({ name: z.string(), note: z.string().optional() })).min(1),
  paperCount: z.string(),
  nextExam: ExamEntrySchema,
  components: z.array(ExamComponentSchema).min(1),
  routes: z.array(ExamRouteSchema).min(1),
  qualificationViews: z.array(QualificationViewSchema).optional(),
  calculator: z.object({
    status: z.enum(["all", "mixed", "none", "unknown"]),
    summary: z.string(),
    prohibited: z.array(z.string()),
  }),
  formula: z.object({
    supplied: z.boolean(),
    status: z.enum(["provided", "not-provided", "varies", "not-applicable", "unknown"]).optional(),
    summary: z.string(),
    label: z.string().optional(),
  }),
  practical: z.object({
    status: z.enum(["required", "route-dependent", "not-applicable"]),
    summary: z.string(),
    options: z.array(z.object({
      label: z.string(),
      papers: z.array(z.string()).min(1),
      note: z.string().optional(),
    })),
  }).optional(),
  upcomingSeries: z.string(),
  timetableStatus: z.string(),
  upcomingExams: z.array(ExamEntrySchema).min(1),
  materials: z.array(ExamMaterialSchema).min(1),
  release: z.object({
    status: z.literal("approved"),
    approvedAt: z.string(),
    verifiedAt: z.string(),
    schedule: z.object({ normal: z.string(), nearExam: z.string(), materials: z.string() }),
  }),
});

export type ExamOverview = z.infer<typeof ExamOverviewSchema>;
export type ExamMaterial = z.infer<typeof ExamMaterialSchema>;
export type ExamRoute = z.infer<typeof ExamRouteSchema>;
