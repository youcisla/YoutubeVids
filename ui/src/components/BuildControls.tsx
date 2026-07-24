import { useState } from 'react';
import type { BookMeta, BuildOptions, BuildStatus } from '../types';
import { Play, RotateCcw, Settings2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  books: BookMeta[];
  selectedBook: string;
  selectedChapter: number;
  onSelectBook: (name: string) => void;
  onSelectChapter: (num: number) => void;
  flags: { keepTemp: boolean; noWhisper: boolean; upload: boolean };
  onFlagsChange: (f: { keepTemp: boolean; noWhisper: boolean; upload: boolean }) => void;
  onBuild: () => Promise<(() => void) | undefined>;
  status: BuildStatus;
}

export default function BuildControls({
  books, selectedBook, selectedChapter, onSelectBook, onSelectChapter,
  flags, onFlagsChange, onBuild, status,
}: Props) {
  const selectedBookData = books.find(b => b.name === selectedBook);
  const selectedChapterData = selectedBookData?.chapters.find(c => c.number === selectedChapter);

  return (
    <div className="card-panel space-y-5">
      <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
        <Settings2 size={18} className="text-accent-gold" />
        Build
      </h2>

      {/* Book + Chapter selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[#64748B] mb-1.5">Book</label>
          <select
            value={selectedBook}
            onChange={e => { onSelectBook(e.target.value); onSelectChapter(0); }}
            className="input-field"
          >
            <option value="">— Select —</option>
            {books.map(b => (
              <option key={b.name} value={b.name}>{b.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#64748B] mb-1.5">Chapter</label>
          <select
            value={selectedChapter}
            onChange={e => onSelectChapter(parseInt(e.target.value))}
            className="input-field"
            disabled={!selectedBook}
          >
            <option value={0}>— Select —</option>
            {selectedBookData?.chapters.map(ch => (
              <option key={ch.number} value={ch.number}>
                {String(ch.number).padStart(2, '0')} — {ch.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chapter info */}
      {selectedChapterData && (
        <div className="flex gap-3 text-xs text-[#64748B]">
          <span>{selectedChapterData.sceneCount} scenes</span>
          <span>·</span>
          <span>{selectedChapterData.wordCount} words</span>
          {selectedChapterData.hasOutput && (
            <>
              <span>·</span>
              <span className="text-emerald-400">rendered</span>
            </>
          )}
        </div>
      )}

      {/* Flags */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input
            type="checkbox"
            checked={flags.keepTemp}
            onChange={e => onFlagsChange({ ...flags, keepTemp: e.target.checked })}
            className="rounded border-[#1E293B] bg-slate-850 text-accent-gold"
          />
          Keep temp files
        </label>
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input
            type="checkbox"
            checked={flags.noWhisper}
            onChange={e => onFlagsChange({ ...flags, noWhisper: e.target.checked })}
            className="rounded border-[#1E293B] bg-slate-850 text-accent-gold"
          />
          Skip Whisper (use static captions)
        </label>
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input
            type="checkbox"
            checked={flags.upload}
            onChange={e => onFlagsChange({ ...flags, upload: e.target.checked })}
            className="rounded border-[#1E293B] bg-slate-850 text-accent-gold"
          />
          Upload to YouTube
        </label>
      </div>

      {/* Build button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBuild}
          disabled={!selectedBook || !selectedChapter || status === 'building'}
          className="btn-primary flex items-center gap-2"
        >
          {status === 'building' ? (
            <><RotateCcw size={16} className="animate-spin" /> Building...</>
          ) : (
            <><Play size={16} /> Build Chapter</>
          )}
        </button>

        {status === 'done' && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckCircle2 size={16} /> Complete
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <AlertCircle size={16} /> Failed
          </span>
        )}
      </div>
    </div>
  );
}
