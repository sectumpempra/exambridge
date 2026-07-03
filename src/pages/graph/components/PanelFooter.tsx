import { Download, Share2, Presentation } from 'lucide-react';

interface PanelFooterProps {
  onExport: () => void;
  onExportLecture: () => void;
  onShare: () => void;
}

export default function PanelFooter({ onExport, onExportLecture, onShare }: PanelFooterProps) {
  return (
    <div className="px-4 py-3 border-t border-[#e5e5e5] bg-white space-y-2">
      <div className="flex gap-2">
        <button
          onClick={onExport}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border border-black bg-white text-black hover:bg-black hover:text-white transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          导出 PNG
        </button>
        <button
          onClick={onExportLecture}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border border-[#4f46e5] bg-white text-[#4f46e5] hover:bg-[#4f46e5] hover:text-white transition-colors"
        >
          <Presentation className="w-3.5 h-3.5" />
          课件图片
        </button>
      </div>
      <button
        onClick={onShare}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs border border-black bg-white text-black hover:bg-black hover:text-white transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        分享链接
      </button>
    </div>
  );
}
