import { useRef, useEffect } from 'react';
import type { LogLine, BuildStatus } from '../types';
import { Terminal } from 'lucide-react';

interface Props {
  logs: LogLine[];
  status: BuildStatus;
}

export default function LiveLog({ logs, status }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const levelStyle = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-accent-gold';
      case 'system': return 'text-accent-violet';
      default: return 'text-[#CBD5E1]';
    }
  };

  return (
    <div className="card-panel h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 text-sm font-heading font-semibold text-[#94A3B8]">
        <Terminal size={16} />
        Build Log
        {status === 'building' && (
          <span className="ml-auto text-xs text-accent-gold animate-pulse">● Running</span>
        )}
      </div>
      <div className="flex-1 bg-midnight/60 rounded-lg p-4 overflow-y-auto font-mono text-xs leading-relaxed min-h-[300px]">
        {logs.length === 0 && status === 'idle' && (
          <div className="text-[#475569] italic">Waiting for a build...</div>
        )}
        {logs.map((line, i) => (
          <div key={i} className={`${levelStyle(line.level)} whitespace-pre-wrap`}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
