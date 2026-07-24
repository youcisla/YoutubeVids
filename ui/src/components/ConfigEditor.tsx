import { useState, useEffect } from 'react';
import type { AppConfig } from '../types';

interface Props {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

export default function ConfigEditor({ config, onSave }: Props) {
  const [local, setLocal] = useState<AppConfig>(config);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocal(config); }, [config]);

  const update = (key: keyof AppConfig, value: any) => {
    setLocal(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const updateYoutube = (key: string, value: any) => {
    setLocal(prev => ({
      ...prev,
      youtube: { ...(prev.youtube || { publish_type: 'PUBLIC', channel: '', upload_as_draft: true }), [key]: value },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg">Configuration</h2>
        <button onClick={handleSave} className="btn-primary">
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {/* Voice */}
      <div className="card-panel space-y-4">
        <h3 className="text-sm font-heading font-semibold text-[#94A3B8] uppercase tracking-wider">Voice</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">TTS Voice</label>
            <select value={local.voice} onChange={e => update('voice', e.target.value)} className="input-field">
              <option value="en-US-GuyNeural">Guy (US)</option>
              <option value="en-US-JennyNeural">Jenny (US)</option>
              <option value="en-GB-RyanNeural">Ryan (UK)</option>
              <option value="en-GB-SoniaNeural">Sonia (UK)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">Rate (e.g. -3%, +5%)</label>
            <input
              type="text"
              value={local.voice_rate}
              onChange={e => update('voice_rate', e.target.value)}
              className="input-field"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">Audio Format</label>
            <select value={local.audio_format} onChange={e => update('audio_format', e.target.value)} className="input-field">
              <option value="wav">WAV</option>
              <option value="mp3">MP3</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">Target WPM</label>
            <input
              type="number"
              value={local.wpm}
              onChange={e => update('wpm', parseInt(e.target.value))}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Render */}
      <div className="card-panel space-y-4">
        <h3 className="text-sm font-heading font-semibold text-[#94A3B8] uppercase tracking-wider">Render</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">FPS</label>
            <select value={local.fps} onChange={e => update('fps', parseInt(e.target.value))} className="input-field">
              <option value="24">24</option>
              <option value="30">30</option>
              <option value="60">60</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">Quality</label>
            <select value={local.quality} onChange={e => update('quality', e.target.value)} className="input-field">
              <option value="draft">Draft</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">Canvas</label>
            <select value={`${local.canvas_width}x${local.canvas_height}`} onChange={e => {
              const [w, h] = e.target.value.split('x').map(Number);
              update('canvas_width', w);
              update('canvas_height', h);
            }} className="input-field">
              <option value="1920x1080">1920×1080</option>
              <option value="1080x1920">1080×1920 (Vertical)</option>
              <option value="1280x720">1280×720</option>
            </select>
          </div>
        </div>
      </div>

      {/* YouTube */}
      <div className="card-panel space-y-4">
        <h3 className="text-sm font-heading font-semibold text-[#94A3B8] uppercase tracking-wider">YouTube Upload</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">Channel Name</label>
            <input
              type="text"
              value={local.youtube?.channel || ''}
              onChange={e => updateYoutube('channel', e.target.value)}
              className="input-field"
              placeholder="My Channel"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">Visibility</label>
            <select value={local.youtube?.publish_type || 'PUBLIC'} onChange={e => updateYoutube('publish_type', e.target.value)} className="input-field">
              <option value="PUBLIC">Public</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input
            type="checkbox"
            checked={local.youtube?.upload_as_draft ?? true}
            onChange={e => updateYoutube('upload_as_draft', e.target.checked)}
            className="rounded border-[#1E293B] bg-slate-850 text-accent-gold"
          />
          Upload as draft (safe mode)
        </label>
      </div>
    </div>
  );
}
