import React, { useState } from 'react';
import type { AppSettings } from '../types.js';
import {
  Sliders,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Save,
  X,
  CheckCircle2,
  Lock,
  Cpu
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
  const [maxRequests, setMaxRequests] = useState(settings.max_x_requests_per_run || 30);
  const [maxPostsPerRun, setMaxPostsPerRun] = useState(settings.max_x_posts_per_run || 1000);
  const [maxPostsPerQuery, setMaxPostsPerQuery] = useState(settings.max_x_posts_per_query || 100);
  const [maxGemini, setMaxGemini] = useState(settings.max_gemini_extractions_per_run || 30);
  const [geminiEnabled, setGeminiEnabled] = useState(settings.gemini_extraction_enabled ?? true);
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
        max_x_requests_per_run: Number(maxRequests),
        max_x_posts_per_run: Number(maxPostsPerRun),
        max_x_posts_per_query: Number(maxPostsPerQuery),
        max_gemini_extractions_per_run: Number(maxGemini),
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
              System Settings & Experiment Budgets
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
                  Uses realistic local test fixtures and mock pagination. Safe for development with zero API consumption.
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
                  Fetches live recent tweets from X API v2 using server-side credentials only.
                </div>
              </div>
            </div>
          </div>

          {/* Section: Server-side Secret Security Status (P0 Security) */}
          <div className="p-3 rounded-lg border border-slate-700/80 bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-200 font-semibold">
                <Lock className="w-3.5 h-3.5 text-sky-400" />
                <span>X API Token Security</span>
              </div>
              {settings.x_api_configured ? (
                <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded text-[10px] font-mono">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Configured in Server Secrets</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-amber-400 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded text-[10px] font-mono">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Not Configured</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              For security, <code className="text-slate-300 font-mono">X_BEARER_TOKEN</code> is strictly read from container environment secrets on the backend and is never exposed to or accepted from client UI inputs.
            </p>
          </div>

          {/* Section: API Budgets (P0 Budget Configuration) */}
          <div className="space-y-3 pt-1 border-t border-slate-800">
            <label className="block text-slate-300 font-semibold uppercase tracking-wider font-mono text-[11px]">
              API Quotas & Execution Budgets
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium text-[11px]">Max X Requests / Run:</label>
                <input
                  type="number"
                  value={maxRequests}
                  onChange={e => setMaxRequests(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded p-2 focus:outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">Max HTTP search requests per execution cycle</p>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium text-[11px]">Max X Posts / Query:</label>
                <input
                  type="number"
                  value={maxPostsPerQuery}
                  onChange={e => setMaxPostsPerQuery(Number(e.target.value))}
                  min={10}
                  max={500}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded p-2 focus:outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">Max posts paged per single query</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium text-[11px]">Max Total Posts / Run:</label>
                <input
                  type="number"
                  value={maxPostsPerRun}
                  onChange={e => setMaxPostsPerRun(Number(e.target.value))}
                  min={50}
                  max={5000}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded p-2 focus:outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">Max posts processed across all queries</p>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium text-[11px]">Max Gemini Extractions / Run:</label>
                <input
                  type="number"
                  value={maxGemini}
                  onChange={e => setMaxGemini(Number(e.target.value))}
                  min={0}
                  max={100}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded p-2 focus:outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">Hard limit on AI extraction calls per run</p>
              </div>
            </div>
          </div>

          {/* Section: Gemini Fallback Toggle (P0 Gemini Limits) */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span className="text-slate-200 font-medium">Gemini AI Entity Extraction</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={geminiEnabled}
                  onChange={e => setGeminiEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When enabled, Gemini extracts game names from high-context posts that rule-based extractors miss. When disabled, 0 Gemini calls are made and candidates remain based purely on deterministic patterns.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleReSeed}
              disabled={reseeding}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors text-xs disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${reseeding ? 'animate-spin' : ''}`} />
              <span>{reseeding ? 'Resetting...' : 'Reset & Re-Seed Mock Pipeline'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded transition-colors text-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
