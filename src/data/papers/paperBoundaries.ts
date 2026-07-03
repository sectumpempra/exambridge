/**
 * Paper 级 Grade Boundaries 数据
 * 从现有分数线数据按 Paper 维度重组
 * 包含中国区(Zone 5)考卷：15/25/35/45/55/65 及额外变体 58/59/60
 */

export interface PaperBoundaryEntry {
  year: string;
  session: string;
  component: string;
  maxMark: number;
  grades: Record<string, number>;
}

const CAIE_0580_P2: PaperBoundaryEntry[] = [
  {
    "year": "2021",
    "session": "June",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 47,
      "B": 36,
      "C": 26,
      "D": 19,
      "E": 13,
      "F": 15,
      "G": 7
    }
  },
  {
    "year": "2021",
    "session": "March",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 54,
      "B": 46,
      "C": 38,
      "D": 30,
      "E": 22,
      "F": 14,
      "G": 6
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 47,
      "B": 36,
      "C": 26,
      "D": 19,
      "E": 13,
      "F": 16,
      "G": 8
    }
  },
  {
    "year": "2022",
    "session": "March",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 55,
      "B": 47,
      "C": 39,
      "D": 31,
      "E": 23,
      "F": 15,
      "G": 7
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 56,
      "B": 46,
      "C": 38,
      "D": 30,
      "E": 23,
      "F": 17,
      "G": 9
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 52,
      "B": 42,
      "C": 32,
      "D": 24,
      "E": 17,
      "F": 16,
      "G": 8
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 56,
      "B": 44,
      "C": 33,
      "D": 26,
      "E": 20,
      "F": 16,
      "G": 8
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "21",
    "maxMark": 100,
    "grades": {
      "A": 64,
      "B": 51,
      "C": 38,
      "D": 32,
      "E": 26
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "22",
    "maxMark": 100,
    "grades": {
      "A": 76,
      "B": 59,
      "C": 43,
      "D": 34,
      "E": 26
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "22",
    "maxMark": 100,
    "grades": {
      "A": 78,
      "B": 62,
      "C": 46,
      "D": 38,
      "E": 31
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "21",
    "maxMark": 100,
    "grades": {
      "A": 64,
      "B": 51,
      "C": 38,
      "D": 32,
      "E": 26
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "22",
    "maxMark": 100,
    "grades": {
      "A": 76,
      "B": 59,
      "C": 43,
      "D": 34,
      "E": 26
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 47,
      "B": 36,
      "C": 26,
      "D": 19,
      "E": 13
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 47,
      "B": 36,
      "C": 26,
      "D": 19,
      "E": 13
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 46,
      "B": 36,
      "C": 29,
      "D": 23,
      "E": 17
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 45,
      "B": 35,
      "C": 25,
      "D": 21,
      "E": 18
    }
  },
  {
    "year": "2021",
    "session": "March",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 55,
      "B": 47,
      "C": 39,
      "D": 31,
      "E": 23
    }
  },
  {
    "year": "2022",
    "session": "March",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 56,
      "B": 48,
      "C": 40,
      "D": 32,
      "E": 24
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 57,
      "B": 49,
      "C": 41,
      "D": 33,
      "E": 25
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "21",
    "maxMark": 100,
    "grades": {
      "A": 75,
      "B": 59,
      "C": 43,
      "D": 34,
      "E": 25
    }
  },
  {
    "year": "2024",
    "session": "March",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 60,
      "B": 51,
      "C": 43,
      "D": 37,
      "E": 32
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 50,
      "B": 39,
      "C": 29,
      "D": 24,
      "E": 19
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 58,
      "B": 50,
      "C": 43,
      "D": 36,
      "E": 29
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 46,
      "B": 36,
      "C": 29,
      "D": 23,
      "E": 17
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 56,
      "B": 46,
      "C": 38,
      "D": 30,
      "E": 23
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 47,
      "B": 36,
      "C": 26,
      "D": 19,
      "E": 13
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 47,
      "B": 36,
      "C": 26,
      "D": 19,
      "E": 13
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "21",
    "maxMark": 70,
    "grades": {
      "A": 50,
      "B": 40,
      "C": 31,
      "D": 27,
      "E": 23
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "22",
    "maxMark": 70,
    "grades": {
      "A": 50,
      "B": 40,
      "C": 31,
      "D": 27,
      "E": 23
    }
  }
];

const CAIE_0580_P4: PaperBoundaryEntry[] = [
  {
    "year": "2021",
    "session": "June",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 76,
      "B": 54,
      "C": 34,
      "D": 25,
      "E": 17,
      "F": 26,
      "G": 11
    }
  },
  {
    "year": "2021",
    "session": "March",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 100,
      "B": 85,
      "C": 70,
      "D": 55,
      "E": 40,
      "F": 25,
      "G": 10
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 80,
      "B": 59,
      "C": 37,
      "D": 27,
      "E": 17,
      "F": 28,
      "G": 13
    }
  },
  {
    "year": "2022",
    "session": "March",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 101,
      "B": 86,
      "C": 71,
      "D": 56,
      "E": 41,
      "F": 26,
      "G": 11
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 81,
      "B": 62,
      "C": 43,
      "D": 33,
      "E": 22,
      "F": 29,
      "G": 14
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 93,
      "B": 72,
      "C": 52,
      "D": 39,
      "E": 26,
      "F": 27,
      "G": 12
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 94,
      "B": 73,
      "C": 52,
      "D": 40,
      "E": 28,
      "F": 27,
      "G": 12
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "41",
    "maxMark": 100,
    "grades": {
      "A": 67,
      "B": 55,
      "C": 43,
      "D": 36,
      "E": 29
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "42",
    "maxMark": 100,
    "grades": {
      "A": 76,
      "B": 60,
      "C": 43,
      "D": 34,
      "E": 25
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "42",
    "maxMark": 100,
    "grades": {
      "A": 83,
      "B": 66,
      "C": 49,
      "D": 40,
      "E": 31
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "41",
    "maxMark": 100,
    "grades": {
      "A": 67,
      "B": 55,
      "C": 43,
      "D": 36,
      "E": 29
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "42",
    "maxMark": 100,
    "grades": {
      "A": 76,
      "B": 60,
      "C": 43,
      "D": 34,
      "E": 25
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 76,
      "B": 54,
      "C": 34,
      "D": 25,
      "E": 17
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 80,
      "B": 59,
      "C": 37,
      "D": 27,
      "E": 17
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 81,
      "B": 62,
      "C": 43,
      "D": 33,
      "E": 22
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 80,
      "B": 63,
      "C": 47,
      "D": 35,
      "E": 22
    }
  },
  {
    "year": "2021",
    "session": "March",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 101,
      "B": 86,
      "C": 71,
      "D": 56,
      "E": 41
    }
  },
  {
    "year": "2022",
    "session": "March",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 102,
      "B": 87,
      "C": 72,
      "D": 57,
      "E": 42
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 103,
      "B": 88,
      "C": 73,
      "D": 58,
      "E": 43
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "41",
    "maxMark": 100,
    "grades": {
      "A": 75,
      "B": 59,
      "C": 43,
      "D": 34,
      "E": 25
    }
  },
  {
    "year": "2024",
    "session": "March",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 102,
      "B": 81,
      "C": 60,
      "D": 49,
      "E": 38
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 90,
      "B": 73,
      "C": 55,
      "D": 42,
      "E": 30
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 102,
      "B": 80,
      "C": 57,
      "D": 46,
      "E": 35
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 87,
      "B": 68,
      "C": 49,
      "D": 40,
      "E": 31
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 87,
      "B": 68,
      "C": 49,
      "D": 40,
      "E": 31
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 90,
      "B": 70,
      "C": 49,
      "D": 40,
      "E": 31
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 90,
      "B": 70,
      "C": 49,
      "D": 40,
      "E": 31
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "41",
    "maxMark": 130,
    "grades": {
      "A": 87,
      "B": 66,
      "C": 44,
      "D": 34,
      "E": 24
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "42",
    "maxMark": 130,
    "grades": {
      "A": 87,
      "B": 66,
      "C": 44,
      "D": 34,
      "E": 24
    }
  }
];

const CAIE_9709_P1: PaperBoundaryEntry[] = [
  {
    "year": "2025",
    "session": "November",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 60,
      "B": 51,
      "C": 40,
      "D": 28,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 60,
      "B": 51,
      "C": 39,
      "D": 27,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 61,
      "B": 54,
      "C": 43,
      "D": 30,
      "E": 19
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "15",
    "maxMark": 75,
    "grades": {
      "A": 63,
      "B": 55,
      "C": 43,
      "D": 31,
      "E": 18
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 59,
      "B": 50,
      "C": 38,
      "D": 26,
      "E": 15
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 61,
      "B": 52,
      "C": 40,
      "D": 28,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 62,
      "B": 54,
      "C": 41,
      "D": 28,
      "E": 15
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "15",
    "maxMark": 75,
    "grades": {
      "A": 64,
      "B": 54,
      "C": 40,
      "D": 27,
      "E": 14
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "59",
    "maxMark": 75,
    "grades": {
      "A": 64,
      "B": 59,
      "C": 49,
      "D": 39,
      "E": 30
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "60",
    "maxMark": 75,
    "grades": {
      "A": 64,
      "B": 59,
      "C": 52,
      "D": 45,
      "E": 37
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 61,
      "B": 55,
      "C": 45,
      "D": 36,
      "E": 27
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 52,
      "B": 44,
      "C": 34,
      "D": 25,
      "E": 15
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 52,
      "B": 44,
      "C": 34,
      "D": 24,
      "E": 15
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 47,
      "C": 37,
      "D": 27,
      "E": 18
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 50,
      "B": 44,
      "C": 34,
      "D": 23,
      "E": 12
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 60,
      "B": 49,
      "C": 36,
      "D": 24,
      "E": 12
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 58,
      "B": 48,
      "C": 36,
      "D": 24,
      "E": 12
    }
  },
  {
    "year": "2024",
    "session": "March",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 63,
      "B": 57,
      "C": 47,
      "D": 38,
      "E": 29
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 44,
      "C": 34,
      "D": 24,
      "E": 14
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 46,
      "C": 35,
      "D": 24,
      "E": 13
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 62,
      "B": 56,
      "C": 45,
      "D": 34,
      "E": 23
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "58",
    "maxMark": 75,
    "grades": {
      "A": 66,
      "B": 61,
      "C": 53,
      "D": 46,
      "E": 39
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "59",
    "maxMark": 75,
    "grades": {
      "A": 64,
      "B": 59,
      "C": 49,
      "D": 39,
      "E": 30
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 50,
      "B": 43,
      "C": 33,
      "D": 23,
      "E": 14
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 49,
      "B": 40,
      "C": 30,
      "D": 20,
      "E": 10
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 62,
      "B": 53,
      "C": 40,
      "D": 28,
      "E": 16
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "58",
    "maxMark": 75,
    "grades": {
      "A": 66,
      "B": 61,
      "C": 53,
      "D": 46,
      "E": 39
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "59",
    "maxMark": 75,
    "grades": {
      "A": 64,
      "B": 59,
      "C": 49,
      "D": 39,
      "E": 30
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "60",
    "maxMark": 75,
    "grades": {
      "A": 64,
      "B": 59,
      "C": 52,
      "D": 45,
      "E": 37
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 60,
      "B": 52,
      "C": 42,
      "D": 33,
      "E": 24
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 57,
      "B": 46,
      "C": 37,
      "D": 28,
      "E": 19
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 61,
      "B": 54,
      "C": 42,
      "D": 29,
      "E": 16
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 46,
      "C": 37,
      "D": 28,
      "E": 19
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "58",
    "maxMark": 75,
    "grades": {
      "A": 51,
      "B": 42,
      "C": 33,
      "D": 24,
      "E": 15
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "59",
    "maxMark": 75,
    "grades": {
      "A": 50,
      "B": 44,
      "C": 35,
      "D": 26,
      "E": 18
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 54,
      "B": 46,
      "C": 36,
      "D": 27,
      "E": 17
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 54,
      "B": 42,
      "C": 31,
      "D": 21,
      "E": 10
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 59,
      "B": 50,
      "C": 41,
      "D": 31,
      "E": 21
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "58",
    "maxMark": 75,
    "grades": {
      "A": 51,
      "B": 42,
      "C": 33,
      "D": 24,
      "E": 15
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "59",
    "maxMark": 75,
    "grades": {
      "A": 50,
      "B": 44,
      "C": 35,
      "D": 26,
      "E": 18
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "60",
    "maxMark": 75,
    "grades": {
      "A": 51,
      "B": 44,
      "C": 35,
      "D": 27,
      "E": 18
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 50,
      "B": 40,
      "C": 30,
      "D": 21,
      "E": 11
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 51,
      "B": 40,
      "C": 29,
      "D": 18,
      "E": 7
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 52,
      "B": 43,
      "C": 34,
      "D": 25,
      "E": 15
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "11",
    "maxMark": 75,
    "grades": {
      "A": 49,
      "B": 41,
      "C": 32,
      "D": 23,
      "E": 13
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 51,
      "B": 42,
      "C": 31,
      "D": 21,
      "E": 10
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "13",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 46,
      "C": 37,
      "D": 28,
      "E": 18
    }
  },
  {
    "year": "2022",
    "session": "March",
    "component": "12",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 47,
      "C": 37,
      "D": 27,
      "E": 16
    }
  }
];

const CAIE_9709_P2: PaperBoundaryEntry[] = [
  {
    "year": "2025",
    "session": "November",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 37,
      "C": 29,
      "D": 21,
      "E": 13
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 37,
      "C": 29,
      "D": 21,
      "E": 13
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 37,
      "C": 29,
      "D": 21,
      "E": 13
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "25",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 37,
      "C": 29,
      "D": 21,
      "E": 13
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 32,
      "C": 25,
      "D": 19,
      "E": 12
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 31,
      "C": 25,
      "D": 18,
      "E": 11
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 31,
      "C": 25,
      "D": 18,
      "E": 11
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "25",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 31,
      "C": 25,
      "D": 18,
      "E": 11
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 36,
      "C": 29,
      "D": 22,
      "E": 15
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 35,
      "C": 27,
      "D": 20,
      "E": 12
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 35,
      "C": 27,
      "D": 20,
      "E": 12
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 35,
      "C": 27,
      "D": 20,
      "E": 12
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 34,
      "C": 27,
      "D": 21,
      "E": 15
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 33,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 33,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2024",
    "session": "March",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 36,
      "C": 30,
      "D": 24,
      "E": 18
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 35,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 35,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 35,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 33,
      "B": 28,
      "C": 23,
      "D": 19,
      "E": 14
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 30,
      "C": 23,
      "D": 16,
      "E": 9
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 30,
      "C": 23,
      "D": 16,
      "E": 9
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 34,
      "C": 28,
      "D": 22,
      "E": 16
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 35,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 35,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 35,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 30,
      "C": 23,
      "D": 16,
      "E": 10
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 30,
      "C": 23,
      "D": 16,
      "E": 9
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 30,
      "C": 23,
      "D": 16,
      "E": 9
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 33,
      "C": 25,
      "D": 17,
      "E": 10
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 33,
      "C": 24,
      "D": 15,
      "E": 7
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 33,
      "C": 25,
      "D": 17,
      "E": 10
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "21",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 28,
      "C": 22,
      "D": 16,
      "E": 10
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "22",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 32,
      "C": 25,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "23",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 32,
      "C": 25,
      "D": 18,
      "E": 12
    }
  }
];

const CAIE_9709_P3: PaperBoundaryEntry[] = [
  {
    "year": "2025",
    "session": "November",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 58,
      "B": 49,
      "C": 40,
      "D": 31,
      "E": 21
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 45,
      "B": 38,
      "C": 32,
      "D": 25,
      "E": 17
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 58,
      "B": 49,
      "C": 41,
      "D": 31,
      "E": 22
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "35",
    "maxMark": 75,
    "grades": {
      "A": 60,
      "B": 51,
      "C": 42,
      "D": 32,
      "E": 21
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 49,
      "C": 38,
      "D": 27,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 47,
      "C": 37,
      "D": 27,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 52,
      "B": 46,
      "C": 36,
      "D": 26,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "35",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 49,
      "C": 38,
      "D": 27,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 64,
      "B": 56,
      "C": 46,
      "D": 36,
      "E": 25
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 54,
      "B": 45,
      "C": 37,
      "D": 29,
      "E": 20
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 51,
      "B": 42,
      "C": 35,
      "D": 27,
      "E": 19
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 55,
      "B": 45,
      "C": 37,
      "D": 29,
      "E": 20
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 48,
      "B": 39,
      "C": 31,
      "D": 23,
      "E": 14
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 48,
      "B": 39,
      "C": 30,
      "D": 23,
      "E": 14
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 54,
      "B": 45,
      "C": 37,
      "D": 29,
      "E": 20
    }
  },
  {
    "year": "2024",
    "session": "March",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 58,
      "B": 52,
      "C": 44,
      "D": 35,
      "E": 26
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 54,
      "B": 45,
      "C": 39,
      "D": 32,
      "E": 24
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 54,
      "B": 45,
      "C": 39,
      "D": 32,
      "E": 24
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 66,
      "B": 59,
      "C": 51,
      "D": 42,
      "E": 32
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 52,
      "B": 45,
      "C": 36,
      "D": 26,
      "E": 17
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 52,
      "B": 45,
      "C": 36,
      "D": 27,
      "E": 17
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 57,
      "B": 51,
      "C": 42,
      "D": 34,
      "E": 25
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "34",
    "maxMark": 75,
    "grades": {
      "A": 53,
      "B": 45,
      "C": 36,
      "D": 26,
      "E": 16
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 58,
      "B": 51,
      "C": 42,
      "D": 33,
      "E": 24
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 58,
      "B": 51,
      "C": 42,
      "D": 33,
      "E": 23
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 58,
      "B": 50,
      "C": 41,
      "D": 31,
      "E": 21
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 57,
      "B": 49,
      "C": 41,
      "D": 32,
      "E": 23
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 53,
      "B": 45,
      "C": 37,
      "D": 28,
      "E": 18
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 57,
      "B": 49,
      "C": 40,
      "D": 31,
      "E": 21
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 57,
      "B": 51,
      "C": 43,
      "D": 36,
      "E": 27
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 52,
      "B": 43,
      "C": 35,
      "D": 26,
      "E": 17
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 50,
      "B": 41,
      "C": 33,
      "D": 24,
      "E": 14
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 52,
      "B": 44,
      "C": 36,
      "D": 28,
      "E": 19
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "31",
    "maxMark": 75,
    "grades": {
      "A": 52,
      "B": 45,
      "C": 37,
      "D": 29,
      "E": 20
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 54,
      "B": 46,
      "C": 37,
      "D": 28,
      "E": 19
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "33",
    "maxMark": 75,
    "grades": {
      "A": 56,
      "B": 49,
      "C": 41,
      "D": 32,
      "E": 24
    }
  },
  {
    "year": "2022",
    "session": "March",
    "component": "32",
    "maxMark": 75,
    "grades": {
      "A": 57,
      "B": 49,
      "C": 41,
      "D": 32,
      "E": 22
    }
  }
];

const CAIE_9709_P4: PaperBoundaryEntry[] = [
  {
    "year": "2025",
    "session": "November",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 32,
      "C": 25,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 29,
      "C": 23,
      "D": 17,
      "E": 11
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 28,
      "C": 22,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "45",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 31,
      "C": 24,
      "D": 17,
      "E": 11
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 43,
      "B": 37,
      "C": 29,
      "D": 21,
      "E": 12
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 43,
      "B": 39,
      "C": 35,
      "D": 32,
      "E": 29
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 34,
      "C": 26,
      "D": 18,
      "E": 10
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "45",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 35,
      "C": 28,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 44,
      "B": 38,
      "C": 32,
      "D": 26,
      "E": 20
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 34,
      "C": 27,
      "D": 19,
      "E": 12
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 33,
      "B": 27,
      "C": 21,
      "D": 15,
      "E": 9
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 34,
      "C": 26,
      "D": 19,
      "E": 11
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 34,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 30,
      "C": 25,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 32,
      "C": 25,
      "D": 18,
      "E": 10
    }
  },
  {
    "year": "2024",
    "session": "March",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 32,
      "C": 27,
      "D": 22,
      "E": 17
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 34,
      "C": 26,
      "D": 19,
      "E": 12
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 35,
      "C": 27,
      "D": 19,
      "E": 12
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 45,
      "B": 40,
      "C": 33,
      "D": 27,
      "E": 21
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 31,
      "C": 26,
      "D": 22,
      "E": 16
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 30,
      "C": 24,
      "D": 18,
      "E": 13
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 31,
      "C": 25,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 30,
      "C": 24,
      "D": 17,
      "E": 10
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 34,
      "B": 30,
      "C": 24,
      "D": 18,
      "E": 13
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 34,
      "B": 28,
      "C": 22,
      "D": 17,
      "E": 12
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 30,
      "B": 25,
      "C": 20,
      "D": 15,
      "E": 11
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 30,
      "C": 25,
      "D": 20,
      "E": 16
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 32,
      "C": 25,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 31,
      "C": 26,
      "D": 20,
      "E": 15
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 29,
      "C": 23,
      "D": 16,
      "E": 10
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 28,
      "B": 23,
      "C": 17,
      "D": 11,
      "E": 6
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 29,
      "C": 22,
      "D": 16,
      "E": 10
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "41",
    "maxMark": 50,
    "grades": {
      "A": 34,
      "B": 27,
      "C": 21,
      "D": 15,
      "E": 10
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 31,
      "B": 26,
      "C": 21,
      "D": 16,
      "E": 11
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "43",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 30,
      "C": 24,
      "D": 19,
      "E": 14
    }
  },
  {
    "year": "2022",
    "session": "March",
    "component": "42",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 33,
      "C": 26,
      "D": 19,
      "E": 13
    }
  }
];

const CAIE_9709_P5: PaperBoundaryEntry[] = [
  {
    "year": "2025",
    "session": "November",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 37,
      "C": 29,
      "D": 22,
      "E": 15
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 33,
      "C": 25,
      "D": 18,
      "E": 10
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 45,
      "B": 40,
      "C": 32,
      "D": 25,
      "E": 17
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "55",
    "maxMark": 50,
    "grades": {
      "A": 43,
      "B": 39,
      "C": 32,
      "D": 25,
      "E": 19
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 35,
      "C": 28,
      "D": 21,
      "E": 14
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 33,
      "C": 26,
      "D": 18,
      "E": 11
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 36,
      "C": 29,
      "D": 21,
      "E": 14
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "55",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 37,
      "C": 30,
      "D": 23,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 43,
      "B": 38,
      "C": 33,
      "D": 27,
      "E": 22
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 36,
      "C": 29,
      "D": 22,
      "E": 15
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 36,
      "C": 29,
      "D": 22,
      "E": 15
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 34,
      "C": 28,
      "D": 22,
      "E": 15
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 32,
      "C": 25,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 30,
      "C": 24,
      "D": 17,
      "E": 11
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 44,
      "B": 39,
      "C": 32,
      "D": 25,
      "E": 18
    }
  },
  {
    "year": "2024",
    "session": "March",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 44,
      "B": 39,
      "C": 33,
      "D": 26,
      "E": 20
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 34,
      "C": 27,
      "D": 20,
      "E": 14
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 36,
      "C": 28,
      "D": 21,
      "E": 14
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 46,
      "B": 42,
      "C": 36,
      "D": 30,
      "E": 25
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 30,
      "C": 24,
      "D": 19,
      "E": 13
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 31,
      "C": 25,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 34,
      "C": 27,
      "D": 20,
      "E": 13
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 29,
      "C": 24,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 34,
      "C": 28,
      "D": 22,
      "E": 17
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 30,
      "C": 23,
      "D": 17,
      "E": 11
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 33,
      "C": 27,
      "D": 21,
      "E": 15
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 33,
      "C": 27,
      "D": 21,
      "E": 16
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 31,
      "C": 24,
      "D": 16,
      "E": 9
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 31,
      "C": 25,
      "D": 19,
      "E": 14
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 31,
      "C": 24,
      "D": 17,
      "E": 11
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 31,
      "C": 22,
      "D": 14,
      "E": 6
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 35,
      "C": 29,
      "D": 23,
      "E": 17
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "51",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 30,
      "C": 24,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 34,
      "C": 28,
      "D": 22,
      "E": 16
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "53",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 34,
      "C": 28,
      "D": 22,
      "E": 15
    }
  },
  {
    "year": "2022",
    "session": "March",
    "component": "52",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 29,
      "C": 22,
      "D": 16,
      "E": 10
    }
  }
];

const CAIE_9709_P6: PaperBoundaryEntry[] = [
  {
    "year": "2025",
    "session": "November",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 46,
      "B": 42,
      "C": 34,
      "D": 27,
      "E": 19
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 32,
      "C": 26,
      "D": 21,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 46,
      "B": 42,
      "C": 34,
      "D": 27,
      "E": 19
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "65",
    "maxMark": 50,
    "grades": {
      "A": 44,
      "B": 39,
      "C": 32,
      "D": 25,
      "E": 19
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 35,
      "C": 29,
      "D": 23,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 43,
      "B": 37,
      "C": 30,
      "D": 23,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 35,
      "C": 28,
      "D": 22,
      "E": 16
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "65",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 38,
      "C": 31,
      "D": 24,
      "E": 17
    }
  },
  {
    "year": "2025",
    "session": "March",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 45,
      "B": 39,
      "C": 32,
      "D": 26,
      "E": 20
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 43,
      "B": 38,
      "C": 31,
      "D": 24,
      "E": 17
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 38,
      "C": 30,
      "D": 22,
      "E": 14
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 43,
      "B": 38,
      "C": 31,
      "D": 24,
      "E": 17
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 34,
      "C": 28,
      "D": 21,
      "E": 15
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 33,
      "C": 28,
      "D": 21,
      "E": 16
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 36,
      "C": 30,
      "D": 24,
      "E": 18
    }
  },
  {
    "year": "2024",
    "session": "March",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 36,
      "C": 30,
      "D": 25,
      "E": 20
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 36,
      "C": 29,
      "D": 23,
      "E": 17
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 35,
      "B": 30,
      "C": 23,
      "D": 16,
      "E": 10
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 36,
      "C": 29,
      "D": 23,
      "E": 17
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 34,
      "C": 28,
      "D": 23,
      "E": 16
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 34,
      "C": 29,
      "D": 24,
      "E": 19
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 38,
      "B": 31,
      "C": 26,
      "D": 20,
      "E": 15
    }
  },
  {
    "year": "2023",
    "session": "March",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 34,
      "C": 28,
      "D": 22,
      "E": 16
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 34,
      "C": 29,
      "D": 23,
      "E": 18
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 32,
      "C": 26,
      "D": 21,
      "E": 16
    }
  },
  {
    "year": "2022",
    "session": "November",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 40,
      "B": 34,
      "C": 29,
      "D": 23,
      "E": 18
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 32,
      "C": 26,
      "D": 20,
      "E": 15
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 34,
      "C": 28,
      "D": 22,
      "E": 16
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 41,
      "B": 33,
      "C": 28,
      "D": 21,
      "E": 16
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 37,
      "C": 31,
      "D": 26,
      "E": 20
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 34,
      "B": 30,
      "C": 24,
      "D": 19,
      "E": 14
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 42,
      "B": 37,
      "C": 31,
      "D": 26,
      "E": 20
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "61",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 30,
      "C": 24,
      "D": 18,
      "E": 12
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 39,
      "B": 35,
      "C": 29,
      "D": 23,
      "E": 18
    }
  },
  {
    "year": "2021",
    "session": "June",
    "component": "63",
    "maxMark": 50,
    "grades": {
      "A": 37,
      "B": 32,
      "C": 26,
      "D": 20,
      "E": 14
    }
  },
  {
    "year": "2022",
    "session": "March",
    "component": "62",
    "maxMark": 50,
    "grades": {
      "A": 36,
      "B": 30,
      "C": 24,
      "D": 18,
      "E": 12
    }
  }
];

const EDX_4MA1_P1H: PaperBoundaryEntry[] = [
  {
    "year": "2022",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 68,
      "7": 58,
      "6": 48,
      "5": 38,
      "4": 28
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 77,
      "8": 67,
      "7": 57,
      "6": 47,
      "5": 37,
      "4": 27
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 68,
      "7": 58,
      "6": 48,
      "5": 38,
      "4": 28
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 79,
      "8": 69,
      "7": 59,
      "6": 49,
      "5": 39,
      "4": 29
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 68,
      "7": 58,
      "6": 48,
      "5": 38,
      "4": 28
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 79,
      "8": 69,
      "7": 59,
      "6": 49,
      "5": 39,
      "4": 29
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 79,
      "8": 69,
      "7": 59,
      "6": 49,
      "5": 39,
      "4": 29
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 68,
      "7": 58,
      "6": 48,
      "5": 38,
      "4": 28
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 79,
      "8": 69,
      "7": 59,
      "6": 49,
      "5": 39,
      "4": 29
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 80,
      "8": 70,
      "7": 60,
      "6": 50,
      "5": 40,
      "4": 30
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 79,
      "8": 69,
      "7": 59,
      "6": 49,
      "5": 39,
      "4": 29
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 80,
      "8": 70,
      "7": 60,
      "6": 50,
      "5": 40,
      "4": 30
    }
  },
  {
    "year": "2023",
    "session": "January",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 76,
      "8": 66,
      "7": 56,
      "6": 46,
      "5": 36,
      "4": 26
    }
  },
  {
    "year": "2023",
    "session": "January",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 77,
      "8": 67,
      "7": 57,
      "6": 47,
      "5": 37,
      "4": 27
    }
  },
  {
    "year": "2024",
    "session": "January",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 77,
      "8": 67,
      "7": 57,
      "6": 47,
      "5": 37,
      "4": 27
    }
  },
  {
    "year": "2024",
    "session": "January",
    "component": "Mathematics Paper 1H",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 68,
      "7": 58,
      "6": 48,
      "5": 38,
      "4": 28
    }
  },
  {
    "year": "2025",
    "session": "Jun",
    "component": "Mathematics Paper 01H",
    "maxMark": 100,
    "grades": {
      "9": 87,
      "8": 73,
      "7": 60,
      "6": 47,
      "5": 34
    }
  },
  {
    "year": "2025",
    "session": "Jun",
    "component": "Mathematics Paper 01HR",
    "maxMark": 100,
    "grades": {
      "9": 81,
      "8": 67,
      "7": 54,
      "6": 42,
      "5": 31
    }
  },
  {
    "year": "2024",
    "session": "Jun",
    "component": "Mathematics Paper 01HR",
    "maxMark": 100,
    "grades": {
      "9": 83,
      "8": 69,
      "7": 55,
      "6": 43,
      "5": 31
    }
  },
  {
    "year": "2023",
    "session": "Jan",
    "component": "Mathematics Paper 01HR",
    "maxMark": 100,
    "grades": {
      "9": 75,
      "8": 62,
      "7": 50,
      "6": 38,
      "5": 26
    }
  },
  {
    "year": "2022",
    "session": "Jan",
    "component": "Mathematics Paper 01HR",
    "maxMark": 100,
    "grades": {
      "9": 66,
      "8": 54,
      "7": 42,
      "6": 31,
      "5": 20
    }
  },
  {
    "year": "2021",
    "session": "Jan",
    "component": "Mathematics Paper 01H",
    "maxMark": 100,
    "grades": {
      "9": 72,
      "8": 59,
      "7": 47,
      "6": 35,
      "5": 23
    }
  },
  {
    "year": "2021",
    "session": "Jan",
    "component": "Mathematics Paper 01HR",
    "maxMark": 100,
    "grades": {
      "9": 76,
      "8": 61,
      "7": 46,
      "6": 34,
      "5": 22
    }
  },
  {
    "year": "2020",
    "session": "Jan",
    "component": "Mathematics Paper 01H",
    "maxMark": 100,
    "grades": {
      "9": 81,
      "8": 67,
      "7": 53,
      "6": 42,
      "5": 31
    }
  },
  {
    "year": "2020",
    "session": "Jan",
    "component": "Mathematics Paper 01HR",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 64,
      "7": 51,
      "6": 40,
      "5": 30
    }
  },
  {
    "year": "2019",
    "session": "Jan",
    "component": "Mathematics Paper 01H",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 64,
      "7": 50,
      "6": 39,
      "5": 29
    }
  },
  {
    "year": "2019",
    "session": "Jan",
    "component": "Mathematics Paper 01HR",
    "maxMark": 100,
    "grades": {
      "9": 75,
      "8": 61,
      "7": 48,
      "6": 38,
      "5": 28
    }
  },
  {
    "year": "2018",
    "session": "Jun",
    "component": "Mathematics Paper 01H",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 65,
      "7": 52,
      "6": 41,
      "5": 30
    }
  },
  {
    "year": "2018",
    "session": "Jun",
    "component": "Mathematics Paper 01HR",
    "maxMark": 100,
    "grades": {
      "9": 75,
      "8": 62,
      "7": 50,
      "6": 39,
      "5": 29
    }
  }
];

const EDX_4MA1_P2H: PaperBoundaryEntry[] = [
  {
    "year": "2025",
    "session": "June",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 85,
      "8": 71,
      "7": 57,
      "6": 45,
      "5": 33
    }
  },
  {
    "year": "2025",
    "session": "June",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 86,
      "8": 72,
      "7": 59,
      "6": 46,
      "5": 33
    }
  },
  {
    "year": "2025",
    "session": "November",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 84,
      "8": 69,
      "7": 54,
      "6": 43,
      "5": 33
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 83,
      "8": 69,
      "7": 55,
      "6": 43,
      "5": 32
    }
  },
  {
    "year": "2024",
    "session": "June",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 84,
      "8": 69,
      "7": 55,
      "6": 43,
      "5": 31
    }
  },
  {
    "year": "2024",
    "session": "November",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 82,
      "8": 69,
      "7": 56,
      "6": 45,
      "5": 34
    }
  },
  {
    "year": "2023",
    "session": "January",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 72,
      "8": 59,
      "7": 46,
      "6": 35,
      "5": 24
    }
  },
  {
    "year": "2023",
    "session": "January",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 74,
      "8": 61,
      "7": 49,
      "6": 37,
      "5": 26
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 77,
      "8": 62,
      "7": 48,
      "6": 38,
      "5": 28
    }
  },
  {
    "year": "2023",
    "session": "June",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 79,
      "8": 64,
      "7": 49,
      "6": 38,
      "5": 27
    }
  },
  {
    "year": "2023",
    "session": "November",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 77,
      "8": 62,
      "7": 48,
      "6": 38,
      "5": 29
    }
  },
  {
    "year": "2022",
    "session": "January",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 66,
      "8": 53,
      "7": 41,
      "6": 30,
      "5": 20
    }
  },
  {
    "year": "2022",
    "session": "January",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 70,
      "8": 57,
      "7": 44,
      "6": 33,
      "5": 22
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 76,
      "8": 61,
      "7": 47,
      "6": 35,
      "5": 24
    }
  },
  {
    "year": "2022",
    "session": "June",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 65,
      "8": 52,
      "7": 40,
      "6": 30,
      "5": 20
    }
  },
  {
    "year": "2021",
    "session": "January",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 69,
      "8": 56,
      "7": 44,
      "6": 33,
      "5": 22
    }
  },
  {
    "year": "2021",
    "session": "January",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 76,
      "8": 60,
      "7": 45,
      "6": 33,
      "5": 21
    }
  },
  {
    "year": "2021",
    "session": "November",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 69,
      "8": 56,
      "7": 44,
      "6": 33,
      "5": 22
    }
  },
  {
    "year": "2020",
    "session": "January",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 64,
      "7": 51,
      "6": 40,
      "5": 30
    }
  },
  {
    "year": "2020",
    "session": "January",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 80,
      "8": 66,
      "7": 52,
      "6": 41,
      "5": 31
    }
  },
  {
    "year": "2020",
    "session": "November",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 70,
      "8": 57,
      "7": 45,
      "6": 34,
      "5": 23
    }
  },
  {
    "year": "2020",
    "session": "November",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 75,
      "8": 60,
      "7": 45,
      "6": 33,
      "5": 21
    }
  },
  {
    "year": "2019",
    "session": "January",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 64,
      "7": 50,
      "6": 39,
      "5": 29
    }
  },
  {
    "year": "2019",
    "session": "January",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 77,
      "8": 63,
      "7": 49,
      "6": 39,
      "5": 29
    }
  },
  {
    "year": "2019",
    "session": "June",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 75,
      "8": 62,
      "7": 49,
      "6": 39,
      "5": 29
    }
  },
  {
    "year": "2019",
    "session": "June",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 78,
      "8": 64,
      "7": 51,
      "6": 40,
      "5": 29
    }
  },
  {
    "year": "2018",
    "session": "June",
    "component": "Mathematics Paper 02H",
    "maxMark": 100,
    "grades": {
      "9": 75,
      "8": 62,
      "7": 50,
      "6": 39,
      "5": 29
    }
  },
  {
    "year": "2018",
    "session": "June",
    "component": "Mathematics Paper 02HR",
    "maxMark": 100,
    "grades": {
      "9": 80,
      "8": 66,
      "7": 53,
      "6": 42,
      "5": 31
    }
  }
];

export const PAPER_BOUNDARIES: Record<string, PaperBoundaryEntry[]> = {
  'CAIE-0580-P2': CAIE_0580_P2,
  'CAIE-0580-P4': CAIE_0580_P4,
  'CAIE-9709-P1': CAIE_9709_P1,
  'CAIE-9709-P2': CAIE_9709_P2,
  'CAIE-9709-P3': CAIE_9709_P3,
  'CAIE-9709-P4': CAIE_9709_P4,
  'CAIE-9709-P5': CAIE_9709_P5,
  'CAIE-9709-P6': CAIE_9709_P6,
  'EDX-4MA1-P1H': EDX_4MA1_P1H,
  'EDX-4MA1-P2H': EDX_4MA1_P2H,
};

export function getBoundariesForPaper(paperId: string): PaperBoundaryEntry[] {
  return PAPER_BOUNDARIES[paperId] || [];
}
