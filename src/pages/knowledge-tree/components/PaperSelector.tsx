import { FileText } from "lucide-react";

interface PaperSelectorProps {
  label: string;
  papers: string[];
  value: string | null; // null = whole subject
  onChange: (paper: string | null) => void;
  disabled?: boolean;
}

export default function PaperSelector({
  label,
  papers,
  value,
  onChange,
  disabled = false,
}: PaperSelectorProps) {
  if (papers.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span title={label}><FileText className="w-3.5 h-3.5 text-[#C4BDB3]" /></span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        disabled={disabled}
        className="rounded-lg border border-[#E8E4DE] bg-white px-3 py-1.5 text-xs text-[#3D3832] focus:border-[#8F7F6E] focus:outline-none focus:ring-1 focus:ring-[#8F7F6E]/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <option value="">整科</option>
        {papers.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}
