import { useState } from 'react';
import { TEACHER_PRESETS, TRIG_PRESETS, ALGEBRA_PRESETS, POLAR_PRESETS } from '../lib/presets';
import type { PresetFunction } from '../types';

type PresetTab = 'teacher' | 'trig' | 'algebra' | 'polar';

interface PresetSectionProps {
  onApplyPreset: (preset: PresetFunction) => void;
}

const TABS: { key: PresetTab; label: string }[] = [
  { key: 'teacher', label: '教师常用' },
  { key: 'trig', label: '三角函数' },
  { key: 'algebra', label: '代数函数' },
  { key: 'polar', label: '极坐标' },
];

function PresetCard({ preset, onApply }: { preset: PresetFunction; onApply: () => void }) {
  const prefix = preset.mode === 'polar' ? 'r =' : 'y =';
  return (
    <button
      onClick={onApply}
      className="flex flex-col items-start rounded-lg border border-[#d4d2cb] bg-white p-3 text-left transition hover:border-[#8f7f6e] hover:shadow-sm active:scale-[0.98]"
    >
      <span className="text-xs font-medium text-[#3d3832]">{preset.name}</span>
      <span className="mt-1 text-[10px] text-[#a8a095]">
        {prefix} {preset.expression}
      </span>
      <span className="mt-2 inline-block rounded-full bg-[#f7f6f2] px-2 py-0.5 text-[10px] text-[#8b8378]">
        {preset.category}
      </span>
    </button>
  );
}

export default function PresetSection({ onApplyPreset }: PresetSectionProps) {
  const [activeTab, setActiveTab] = useState<PresetTab>('teacher');

  const presets = {
    teacher: TEACHER_PRESETS,
    trig: TRIG_PRESETS,
    algebra: ALGEBRA_PRESETS,
    polar: POLAR_PRESETS,
  }[activeTab];

  return (
    <div className="p-4 border-b border-[#e5e5e5]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-[#6c6c6c] uppercase tracking-wider">函数预设</h3>
        <span className="text-[10px] text-[#999]">点击快速添加</span>
      </div>

      {/* 分类标签 */}
      <div className="mb-3 grid grid-cols-4 gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-1.5 text-[11px] font-medium border transition-colors ${
              activeTab === tab.key
                ? 'bg-black text-white border-black'
                : 'bg-white text-[#6c6c6c] border-[#e5e5e5] hover:border-black'
            } ${tab.key !== 'teacher' ? 'border-l-0' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 预设卡片网格 */}
      <div className={`grid gap-2 ${activeTab === 'polar' ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {presets.map((preset) => (
          <PresetCard
            key={preset.name}
            preset={preset}
            onApply={() => onApplyPreset(preset)}
          />
        ))}
      </div>
    </div>
  );
}
