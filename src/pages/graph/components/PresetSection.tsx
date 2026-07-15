import { useState } from 'react';
import { TRIG_PRESETS, ALGEBRA_PRESETS, POLAR_PRESETS } from '../lib/presets';
import type { PresetFunction } from '../types';

type PresetTab = 'algebra' | 'trig' | 'polar';

interface PresetSectionProps {
  onApplyPreset: (preset: PresetFunction) => void;
}

const TABS: { key: PresetTab; label: string }[] = [
  { key: 'algebra', label: '代数函数' },
  { key: 'trig', label: '三角函数' },
  { key: 'polar', label: '极坐标' },
];

const TAB_STYLES: Record<PresetTab, { accent: string; active: string; card: string }> = {
  algebra: {
    accent: '#3f78a8',
    active: 'border-[#7ca7ca] bg-[#eaf3fb] text-[#2d5f87]',
    card: 'hover:border-[#7ca7ca] hover:bg-[#f5faff]',
  },
  trig: {
    accent: '#b7791f',
    active: 'border-[#d6a85d] bg-[#fff5df] text-[#8b5a14]',
    card: 'hover:border-[#d6a85d] hover:bg-[#fffaf0]',
  },
  polar: {
    accent: '#a75d78',
    active: 'border-[#cf91a8] bg-[#fceef3] text-[#87455e]',
    card: 'hover:border-[#cf91a8] hover:bg-[#fff7fa]',
  },
};

function PresetCard({ preset, onApply, tab }: { preset: PresetFunction; onApply: () => void; tab: PresetTab }) {
  const prefix = preset.mode === 'polar' ? 'r =' : 'y =';
  const theme = TAB_STYLES[tab];
  return (
    <button
      onClick={onApply}
      className={`group relative flex min-h-[108px] flex-col items-start overflow-hidden rounded-xl border border-[#d8e0e9] bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${theme.card}`}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: theme.accent }} />
      <span className="text-xs font-semibold leading-5 text-[#3d3832]">{preset.name}</span>
      {preset.description && (
        <span className="mt-0.5 text-[10px] leading-4 text-[#8b8378]">{preset.description}</span>
      )}
      <span className="mt-auto pt-2 font-mono text-[10px] text-[#5f6d7d] group-hover:text-[#26384a]">
        {prefix} {preset.expression}
      </span>
    </button>
  );
}

export default function PresetSection({ onApplyPreset }: PresetSectionProps) {
  const [activeTab, setActiveTab] = useState<PresetTab>('algebra');

  const presets = {
    trig: TRIG_PRESETS,
    algebra: ALGEBRA_PRESETS,
    polar: POLAR_PRESETS,
  }[activeTab];

  return (
    <div className="border-b border-[#dbe3ec] bg-white/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-[#6c6c6c] uppercase tracking-wider">函数预设</h3>
        <span className="text-[10px] text-[#626262]">点击快速添加</span>
      </div>

      {/* 分类标签 */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg border py-2 text-[11px] font-semibold transition-colors ${
              activeTab === tab.key
                ? TAB_STYLES[tab.key].active
                : 'border-[#d8e0e9] bg-white text-[#64748b] hover:bg-[#f8fafc]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 预设卡片网格 */}
      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => (
          <PresetCard
            key={preset.name}
            preset={preset}
            onApply={() => onApplyPreset(preset)}
            tab={activeTab}
          />
        ))}
      </div>
    </div>
  );
}
