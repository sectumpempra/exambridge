import { ChevronDown } from "lucide-react";

export interface SubjectOption {
  code: string;
  board: string;
  subjectCode: string;
  name: string;
  level: string;
}

interface SubjectSelectorProps {
  label: string;
  value: string;
  options: SubjectOption[];
  onChange: (code: string) => void;
  accentColor?: string;
}

const BOARD_COLORS: Record<string, string> = {
  CAIE: "#675A4D",
  Edexcel: "#435F7A",
  AQA: "#6B8F5E",
  OCR: "#A08078",
  WJEC: "#5A7080",
};

export default function SubjectSelector({ label, value, options, onChange }: SubjectSelectorProps) {
  const selected = options.find((o) => o.code === value);

  // Group by level
  const gcse = options.filter((o) => o.level === "GCSE");
  const alevel = options.filter((o) => o.level === "A-Level");

  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium text-[#625C54] mb-1.5 tracking-wider uppercase">
        {label}
      </label>
      <div className="relative">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 pr-10 text-sm text-[#3D3832] focus:border-[#675A4D] focus:outline-none focus:ring-1 focus:ring-[#675A4D]/20 cursor-pointer"
        >
          <option value="">选择科目...</option>
          {gcse.length > 0 && (
            <optgroup label="GCSE / IGCSE">
              {gcse.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.board} {o.subjectCode} — {o.name}
                </option>
              ))}
            </optgroup>
          )}
          {alevel.length > 0 && (
            <optgroup label="A-Level">
              {alevel.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.board} {o.subjectCode} — {o.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716A61] pointer-events-none" />
      </div>
      {selected && (
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: BOARD_COLORS[selected.board] || "#999" }}
          />
          <span className="text-[11px] text-[#6E675E]">
            {selected.board} · {selected.level}
          </span>
        </div>
      )}
    </div>
  );
}
