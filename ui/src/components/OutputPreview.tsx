import type { BuildStatus } from '../types';
import { FileVideo, Download, ExternalLink } from 'lucide-react';

interface Props {
  outputUrl: string | null;
  status: BuildStatus;
  book: string;
  chapter: number;
  chapterTitle?: string;
}

export default function OutputPreview({ outputUrl, status, book, chapter, chapterTitle }: Props) {
  const isReady = status === 'done' && outputUrl;
  const hasBuilt = status !== 'idle';

  return (
    <div className="card-panel space-y-3">
      <h3 className="text-sm font-heading font-semibold text-[#94A3B8] uppercase tracking-wider flex items-center gap-2">
        <FileVideo size={16} />
        Output
      </h3>

      {!hasBuilt && (
        <div className="text-sm text-[#475569] py-8 text-center">
          Select a book chapter and press Build
        </div>
      )}

      {status === 'building' && (
        <div className="text-sm text-accent-gold py-8 text-center animate-pulse">
          Rendering in progress...
        </div>
      )}

      {isReady && (
        <div className="space-y-3">
          {chapterTitle && (
            <div className="text-sm text-[#CBD5E1]">
              {book.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — Chapter {chapter}: {chapterTitle}
            </div>
          )}
          <div className="flex gap-2">
            <a
              href={outputUrl!}
              download
              className="btn-secondary flex items-center gap-2"
            >
              <Download size={16} /> Download MP4
            </a>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="text-sm text-red-400 py-4">
          Build failed. Check the logs for details.
        </div>
      )}
    </div>
  );
}
