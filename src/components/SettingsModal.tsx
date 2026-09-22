import React, { useState } from 'react';
import type { AppSettings } from '../types.js';
import {
  Sliders,
  Download,
  RotateCcw,
  Key,
  ShieldAlert,
  Save,
  X,
  CheckCircle2,
  Database
} from 'lucide-react';

interface SettingsModalProps {
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  onResetAndSeed: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  isOpen,
  onClose,
  onUpdateSettings,
  onResetAndSeed
}) => {
  const [mode, setMode] = useState<'mock' | 'live'>(settings.x_data_mode);
  const [apiKey, setApiKey] = useState(settings.x_bearer_token || '');
  const [maxPosts, setMaxPosts] = useState(settings.max_x_posts_per_run || 25);
  const [geminiEnabled, setGeminiEnabled] = useState(settings.gemini_extraction_enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [reseeding, setReseeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await onUpdateSettings({
        x_data_mode: mode,
        x_bearer_token: apiKey,
        max_x_posts_per_run: Number(maxPosts),
        gemini_extraction_enabled: geminiEnabled
      });
      setMessage('Settings successfully updated.');
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReSeed = async () => {
    if (confirm('Re-run mock fixtures and pipeline from scratch? This will reset all in-memory post and candidate states.')) {
      setReseeding(true);
      try {
        await onResetAndSeed();
        setMessage('Mock dataset re-seeded successfully.');
      } catch (err: any) {
        setMessage(`Error: ${err.message}`);
      } finally {
        setReseeding(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              System Settings & Data Pipeline
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {message && (
          <div className="p-2.5 rounded text-xs bg-slate-800 text-slate-200 border border-slate-700 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Section: Data Mode Toggle */}
          <div className="space-y-2">
            <label className="block text-slate-300 font-semibold uppercase tracking-wider font-mono text-[11px]">
              Pipeline Data Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setMode('mock')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  mode === 'mock'
                    ? 'bg-amber-500/10 border-amber-500/60 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold flex items-center space-x-1.5 text-amber-300">
                  <span>Mock Mode</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Uses realistic test fixture posts, simulated search queries, and local rate limits without consuming X API credits.
                </div>
              </div>

              <div
                onClick={() => setMode('live')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  mode === 'live'
                    ? 'bg-emerald-500/10 border-emerald-500/60 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold flex items-center space-x-1.5 text-emerald-300">
                  <span>Live X API Mode</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Connects to Twitter/X API v2 recent search endpoint using your Bearer Token.
                </div>
              </div>
            </div>
          </div>

          {/* Section: X API Bearer Token */}
          {mode === 'live' && (
            <div className="space-y-1.5 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <label className="block text-slate-200 font-medium">X API Bearer Token:</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AAAAAAAAAAAAAAAAAAAAA..."
                  className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded pl-8 pr-3 py-2 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Requires standard X Developer API Bearer Token with read permissions.
              </p>
            </div>
          )}

          {/* Section: Max Posts Per Query */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-medium">Max Posts Per Query Fetch:</label>
            <input
              type="number"
              value={maxPosts}
              onChange={e => setMaxPosts(Number(e.target.value))}
              min={10}
              max={100}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded p-2 focus:outline-none focus:border-sky-500"
            />
            <p className="text-[11px] text-slate-500">
              Default is 25 posts. Caps API quota usage per execution cycle.
            </p>
          </div>

          {/* Section: Gemini AI Fallback Extraction */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <div>
              <div className="font-semibold text-slate-200">Gemini AI Fallback Extraction</div>
              <div className="text-[11px] text-slate-400">
                Only runs on high context score (≥70) posts when deterministic patterns don't find a title.
              </div>
            </div>
            <input
              type="checkbox"
              checked={geminiEnabled}
              onChange={e => setGeminiEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-sky-500 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white py-2 rounded text-xs font-semibold shadow transition-colors flex items-center justify-center space-x-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </form>

        {/* Section: CSV Exports */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="text-slate-300 font-semibold uppercase tracking-wider font-mono text-[11px]">
            Data Export (CSV)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a
              href="/api/export/candidates"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded text-center border border-slate-700 transition-colors block"
            >
              Candidates CSV
            </a>
            <a
              href="/api/export/queries"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded text-center border border-slate-700 transition-colors block"
            >
              Queries CSV
            </a>
            <a
              href="/api/export/posts"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded text-center border border-slate-700 transition-colors block"
            >
              Raw Posts CSV
            </a>
          </div>
        </div>

        {/* Section: Danger Zone - Reset and Re-seed */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="text-rose-400 font-semibold uppercase tracking-wider font-mono text-[11px] flex items-center space-x-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Mock Database Reset & Re-run</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Resets all posts and candidates, reloads initial query seeds, runs the entire pipeline on the mock test suite, and applies demo ground-truth labels.
          </p>
          <button
            onClick={handleReSeed}
            disabled={reseeding}
            className="w-full bg-slate-800 hover:bg-rose-950 text-rose-300 border border-rose-900/60 py-2 rounded text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${reseeding ? 'animate-spin' : ''}`} />
            <span>Reset Database & Re-run Mock Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
