import type { BookMeta } from '../types';

interface Props {
  books: BookMeta[];
  selectedBook: string;
  selectedChapter: number;
  onSelectBook: (name: string) => void;
  onSelectChapter: (num: number) => void;
}

export default function Sidebar({ books, selectedBook, selectedChapter, onSelectBook, onSelectChapter }: Props) {
  return (
    <aside className="w-64 border-r border-[#1E293B] bg-slate-850/40 flex flex-col shrink-0 overflow-hidden">
      <div className="h-14 border-b border-[#1E293B] flex items-center px-5 font-heading font-semibold text-sm text-[#94A3B8] tracking-wider uppercase">
        Books
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {books.map(book => (
          <div key={book.name}>
            <button
              onClick={() => onSelectBook(book.name)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedBook === book.name
                  ? 'bg-accent-gold/10 text-accent-gold border border-accent-gold/20'
                  : 'text-[#CBD5E1] hover:bg-[#1E293B]'
              }`}
            >
              {book.title}
            </button>
            {selectedBook === book.name && (
              <div className="ml-2 mt-1 space-y-0.5">
                {book.chapters.map(ch => (
                  <button
                    key={ch.number}
                    onClick={() => onSelectChapter(ch.number)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 ${
                      selectedChapter === ch.number
                        ? 'bg-accent-gold/5 text-accent-gold'
                        : 'text-[#64748B] hover:text-[#CBD5E1] hover:bg-[#1E293B]/50'
                    }`}
                  >
                    <span className="w-5 text-right opacity-50">{String(ch.number).padStart(2, '0')}</span>
                    <span className="truncate flex-1">{ch.title}</span>
                    {ch.hasOutput && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
