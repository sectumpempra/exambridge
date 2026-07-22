import { SUBJECT_CATEGORY_LABELS } from "@/course-context/catalog";
import type { CourseContextEntry, SubjectCategory } from "@/course-context/types";

export type CoursePickerFilters = {
  search: string;
  subjectCategory: SubjectCategory | "all";
  board: string;
  level: string;
};

export type CoursePickerGroup = {
  id: string;
  label: string;
  courses: CourseContextEntry[];
};

const BOARD_LABELS: Record<string, string> = {
  CAIE: "Cambridge International (CAIE)",
  Edexcel: "Pearson International",
  "Edexcel UK": "Pearson UK",
  AQA: "AQA",
  OCR: "OCR",
  "WJEC/Eduqas": "WJEC / Eduqas",
};

const SUBJECT_ORDER: SubjectCategory[] = [
  "mathematics", "physics", "chemistry", "biology", "computer-science",
  "economics", "accounting", "humanities", "languages", "creative", "other",
];

export function getCoursePickerBoardLabel(boardName: string): string {
  return BOARD_LABELS[boardName] ?? boardName;
}

export function getCoursePickerCapabilityLabel(course: CourseContextEntry): string {
  const relevant = ["examOverview", "papers", "syllabus", "boundaries", "statistics"] as const;
  const available = relevant.filter((feature) => course.capabilities[feature].status !== "unavailable").length;
  if (available >= 4) return "多项资料可用";
  if (available > 0) return "部分资料可用";
  return "仅课程目录";
}

export function filterCoursePickerCourses(
  courses: CourseContextEntry[],
  filters: CoursePickerFilters,
): CourseContextEntry[] {
  const query = filters.search.trim().toLocaleLowerCase("en-GB");
  return courses.filter((course) => {
    if (filters.subjectCategory !== "all" && course.subjectCategory !== filters.subjectCategory) return false;
    if (filters.board && course.boardName !== filters.board) return false;
    if (filters.level && course.level !== filters.level) return false;
    if (!query) return true;
    return `${course.boardName} ${getCoursePickerBoardLabel(course.boardName)} ${course.subjectCode} ${course.subjectName} ${course.level} ${SUBJECT_CATEGORY_LABELS[course.subjectCategory]}`
      .toLocaleLowerCase("en-GB")
      .includes(query);
  });
}

export function groupCoursePickerCourses(
  courses: CourseContextEntry[],
  filters: Pick<CoursePickerFilters, "subjectCategory" | "board">,
): CoursePickerGroup[] {
  const groupByBoard = filters.subjectCategory !== "all" && !filters.board;
  const groups = new Map<string, CourseContextEntry[]>();
  for (const course of courses) {
    const id = groupByBoard ? course.boardName : course.subjectCategory;
    groups.set(id, [...(groups.get(id) ?? []), course]);
  }
  return [...groups.entries()]
    .map(([id, groupCourses]) => ({
      id,
      label: groupByBoard ? getCoursePickerBoardLabel(id) : SUBJECT_CATEGORY_LABELS[id as SubjectCategory],
      courses: [...groupCourses].sort((a, b) =>
        getCoursePickerBoardLabel(a.boardName).localeCompare(getCoursePickerBoardLabel(b.boardName), "zh-CN")
        || a.subjectName.localeCompare(b.subjectName, "en-GB")
        || a.subjectCode.localeCompare(b.subjectCode, "en-GB", { numeric: true }),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

export function countCoursesBySubject(courses: CourseContextEntry[]): Array<{
  id: SubjectCategory;
  label: string;
  count: number;
}> {
  const counts = new Map<SubjectCategory, number>();
  for (const course of courses) counts.set(course.subjectCategory, (counts.get(course.subjectCategory) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count, label: SUBJECT_CATEGORY_LABELS[id] }))
    .sort((a, b) => SUBJECT_ORDER.indexOf(a.id) - SUBJECT_ORDER.indexOf(b.id));
}
