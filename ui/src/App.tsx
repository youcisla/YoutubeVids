import { useState, useEffect, useCallback, useRef } from 'react';
import type { BookMeta, AppConfig, BuildOptions, LogLine } from './types';
import * as api from './lib/api';
import Sidebar from './components/Sidebar';
import ConfigEditor from './components/ConfigEditor';
import BuildControls from './components/BuildControls';
import LiveLog from './components/LiveLog';
import OutputPreview from './components/OutputPreview';

export default function App() {
  const cancelBuildRef = useRef<(() => void) | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedBook, setSelectedBook] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [tab, setTab] = useState<'build' | 'config'>('build');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'building' | 'done' | 'error'>('idle');
  const [outputUrl, setOutputUrl] = useState('');
  const [flags, setFlags] = useState({ keepTemp: false, noWhisper: false, upload: false });

  useEffect(() => {
    api.initializeSession().then(() => setSessionReady(true)).catch(console.error);
    api.fetchBooks().then(setBooks).catch(console.error);
    api.fetchConfig().then(setConfig).catch(console.error);
    return () => cancelBuildRef.current?.();
  }, []);

  const handleBuild = useCallback(async () => {
    if (!selectedBook || !selectedChapter || !sessionReady) return;
    cancelBuildRef.current?.();
    setStatus('building');
    setLogs([]);
    setOutputUrl('');

    cancelBuildRef.current = api.startBuild(
      selectedBook,
      selectedChapter,
      flags,
      (text) => setLogs(prev => [...prev, { timestamp: Date.now(), text, level: 'info' }]),
      (url) => {
        setStatus('done');
        setOutputUrl(url || '');
      },
      (err) => {
        setStatus('error');
        setLogs(prev => [...prev, { timestamp: Date.now(), text: err, level: 'error' }]);
      },
    );
  }, [selectedBook, selectedChapter, sessionReady, flags]);

  const currentChapter = books
    .find(b => b.name === selectedBook)
    ?.chapters.find(c => c.number === selectedChapter);

  const outputFile = selectedBook && selectedChapter
    ? `/output/${selectedBook}_Ch${String(selectedChapter).padStart(2, '0')}.mp4`
    : null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        books={books}
        selectedBook={selectedBook}
        selectedChapter={selectedChapter}
        onSelectBook={setSelectedBook}
        onSelectChapter={(n) => { setSelectedChapter(n); setTab('build'); }}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-[#1E293B] flex items-center px-6 gap-6 shrink-0">
          <h1 className="font-heading font-semibold text-lg tracking-tight">
            {config?.youtube?.channel || 'Edu Channel'} <span className="text-[#475569] text-sm font-normal">Studio</span>
          </h1>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setTab('build')}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                tab === 'build' ? 'bg-accent-gold/10 text-accent-gold' : 'text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              Build
            </button>
            <button
              onClick={() => setTab('config')}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                tab === 'config' ? 'bg-accent-gold/10 text-accent-gold' : 'text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              Config
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {tab === 'config' && config && (
            <ConfigEditor config={config} onSave={(nextConfig) => {
              setConfig(nextConfig);
              return api.saveConfig(nextConfig);
            }} />
          )}

          {tab === 'build' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full">
              <div className="flex flex-col gap-6">
                <BuildControls
                  books={books}
                  selectedBook={selectedBook}
                  selectedChapter={selectedChapter}
                  onSelectBook={setSelectedBook}
                  onSelectChapter={setSelectedChapter}
                  flags={flags}
                  onFlagsChange={setFlags}
                  onBuild={handleBuild}
                  status={status}
                />
                <OutputPreview
                  outputUrl={outputUrl || outputFile}
                  status={status}
                  book={selectedBook}
                  chapter={selectedChapter}
                  chapterTitle={currentChapter?.title}
                />
              </div>
              <div className="h-full">
                <LiveLog logs={logs} status={status} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
