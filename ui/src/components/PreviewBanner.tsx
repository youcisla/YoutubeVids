'use strict';

import { Github } from 'lucide-react';

interface PreviewBannerProps {
  repoUrl: string;
  setupDocUrl?: string;
}

export default function PreviewBanner({ repoUrl, setupDocUrl }: PreviewBannerProps) {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 flex items-center gap-4 text-sm">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
        !
      </span>
      <div className="flex-1">
        <div className="font-semibold text-amber-300">Preview build — no backend connected.</div>
        <div className="text-amber-100 text-xs mt-0.5">
          This Vercel deploy shows the UI only. The pipeline (Kokoro TTS + HyperFrames render + YouTube upload)
          runs locally. Clone the repo to use it for real.
        </div>
      </div>
      {setupDocUrl && (
        <a
          href={setupDocUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition-colors"
        >
          Setup Guide
        </a>
      )}
      <a
        href={repoUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold transition-colors"
      >
        <Github size={14} />
        Clone on GitHub
      </a>
    </div>
  );
}
