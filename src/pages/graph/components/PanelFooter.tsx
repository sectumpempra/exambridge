import { Download, Share2, Presentation } from 'lucide-react';

interface PanelFooterProps {
  onExport: () => void;
  onExportLecture: () => void;
  onShare: () => void;
}

export default function PanelFooter({ onExport, onExportLecture, onShare }: PanelFooterProps) {
  return (
    <div className="space-y-2 border-t border-[#dbe3ec] bg-white px-4 py-3">
      <div className="flex gap-2">
        <button
          onClick={onExport}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#5c8b68] bg-[#eef8f0] py-2 text-xs font-semibold text-[#356242] transition-colors hover:bg-[#5c8b68] hover:text-white"
        >
          <Download className="w-3.5 h-3.5" />
          导出 PNG
        </button>
        <button
          onClick={onExportLecture}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#5476b5] bg-[#eef4ff] py-2 text-xs font-semibold text-[#355a96] transition-colors hover:bg-[#5476b5] hover:text-white"
        >
          <Presentation className="w-3.5 h-3.5" />
          课件图片
        </button>
      </div>
      <button
        onClick={onShare}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#8b6aa9] bg-[#f6f0fb] py-2 text-xs font-semibold text-[#684a84] transition-colors hover:bg-[#8b6aa9] hover:text-white"
      >
        <Share2 className="w-3.5 h-3.5" />
        分享链接
      </button>
    </div>
  );
}
