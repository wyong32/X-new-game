import React, { useState } from 'react';
import type { XQuery, QueryCategory, QueryPriority } from '../types.js';
import { formatDateTime, formatTimeAgo } from '../lib/formatters.js';
import {
  Play,
  RotateCw,
  Plus,
  RotateCcw,
  Power,
  Layers,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';

interface QueryManagementProps {
  queries: XQuery[];
  onRunQuery: (queryId: string) => Promise<void>;
  onRunBatch: (filter: 'P1' | 'ENABLED' | 'DUE') => Promise<void>;
  onToggleQuery: (queryId: string, enabled: boolean) => Promise<void>;
  onResetQueryStats: (queryId: string) => Promise<void>;
  onAddQuery: (queryData: Partial<XQuery>) => Promise<void>;
  isOperating: boolean;
}

export const QueryManagement: React.FC<QueryManagementProps> = ({
  queries,
  onRunQuery,
  onRunBatch,
  onToggleQuery,
  onResetQueryStats,
  onAddQuery,
  isOperating
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [runningQueryId, setRunningQueryId] = useState<string | null>(null);

  // New query form state
  const [newQueryName, setNewQueryName] = useState('');
  const [newQueryText, setNewQueryText] = useState('');
  const [newCategory, setNewCategory] = useState<QueryCategory>('RELEASE');
  const [newPriority, setNewPriority] = useState<QueryPriority>('P2');
  const [newFreq, setNewFreq] = useState<number>(120);

  const handleSingleRun = async (id: string) => {
    setRunningQueryId(id);
    try {
      await onRunQuery(id);
    } finally {
      setRunningQueryId(null);
    }
  };

  const handleCreateQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueryText.trim()) return;

    await onAddQuery({
      name: newQueryName.trim() || newQueryText.trim().slice(0, 30),
      query_text: newQueryText.trim(),
      category: newCategory,
      priority: newPriority,
      run_frequency_minutes: newFreq
    });

    setNewQueryName('');
    setNewQueryText('');
    setShowAddModal(false);
  };

  const getPriorityBadge = (p: QueryPriority) => {
    switch (p) {
      case 'P1':
        return <span className="text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded">P1 (High)</span>;
      case 'P2':
        return <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded">P2 (Normal)</span>;
      case 'P3':
        return <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">P3 (Low)</span>;
    }
  };

  const getCategoryBadge = (c: QueryCategory) => {
    switch (c) {
      case 'RELEASE':
        return <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">Release</span>;
      case 'BROWSER':
        return <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">Browser/H5</span>;
      case 'INDIE_LAUNCH':
        return <span className="text-[10px] bg-teal-500/15 text-teal-300 border border-teal-500/30 px-1.5 py-0.5 rounded">Indie</span>;
      case 'GAME_JAM':
        return <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">Game Jam</span>;
      case 'VIRAL':
        return <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">Viral</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header Bar */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">X Search Query Matrix</span>
          <span className="text-xs text-slate-400">({queries.length} total queries)</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-batch-run-p1"
            onClick={() => onRunBatch('P1')}
            disabled={isOperating}
            className="inline-flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run All P1 Queries</span>
          </button>

          <button
            id="btn-batch-run-enabled"
            onClick={() => onRunBatch('ENABLED')}
            disabled={isOperating}
            className="inline-flex items-center space-x-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-600 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run All Enabled</span>
          </button>

          <button
            id="btn-add-query"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Query</span>
          </button>
        </div>
      </div>

      {/* Query Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-800/80 text-[11px] text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3">Name & Query Text</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Schedule</th>
                <th className="py-2.5 px-3">Posts Collected</th>
                <th className="py-2.5 px-3">Candidates</th>
                <th className="py-2.5 px-3">Precision</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {queries.map(q => {
                const isRunning = runningQueryId === q.id;
                return (
                  <tr key={q.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* 1. State / Toggle */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <button
                        onClick={() => onToggleQuery(q.id, !q.enabled)}
                        className={`p-1.5 rounded-md transition-colors ${
                          q.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                        }`}
                        title={q.enabled ? 'Enabled (Click to disable)' : 'Disabled (Click to enable)'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </td>

                    {/* 2. Name & Query Text */}
                    <td className="py-3 px-3 max-w-sm">
                      <div className="font-semibold text-slate-100 flex items-center space-x-2">
                        <span>{q.name}</span>
                        {q.last_status === 'SUCCESS' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Last run succeeded" />
                        )}
                        {q.last_status === 'ERROR' && (
                          <span className="w-2 h-2 rounded-full bg-rose-400" title="Last run error" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={q.query_text}>
                        {q.query_text}
                      </div>
                      {q.last_run_at && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Last run: {formatTimeAgo(q.last_run_at)}
                        </div>
                      )}
                    </td>

                    {/* 3. Category */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getCategoryBadge(q.category)}
                    </td>

                    {/* 4. Priority */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getPriorityBadge(q.priority)}
                    </td>

                    {/* 5. Schedule Frequency */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                      Every {q.run_frequency_minutes}m
                    </td>

                    {/* 6. Posts Collected */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono">
                      <div><strong className="text-white">{q.posts_collected}</strong> posts</div>
                      <div className="text-[10px] text-slate-500">
                        {q.posts_passed_filter} passed filter
                      </div>
                    </td>

                    {/* 7. Candidates */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono">
                      <div><strong className="text-sky-300">{q.candidates_generated}</strong> cands</div>
                      <div className="text-[10px] text-emerald-400">
                        {q.valuable_new_games} valuable new
                      </div>
                    </td>

                    {/* 8. Precision */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-xs ${
                          q.precision >= 60
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : q.precision >= 40
                            ? 'text-sky-400 bg-sky-500/10'
                            : 'text-amber-400 bg-amber-500/10'
                        }`}
                      >
                        {q.precision}%
                      </span>
                    </td>

                    {/* 9. Actions */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          id={`btn-run-query-${q.id}`}
                          onClick={() => handleSingleRun(q.id)}
                          disabled={isRunning || isOperating}
                          className="p-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white transition-colors"
                          title="Run Query Now"
                        >
                          {isRunning ? (
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </button>

                        <button
                          id={`btn-reset-query-${q.id}`}
                          onClick={() => {
                            if (confirm(`Reset stats for "${q.name}"?`)) {
                              onResetQueryStats(q.id);
                            }
                          }}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
                          title="Reset Query Stats"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Query Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center">
                <Plus className="w-4 h-4 mr-2 text-emerald-400" />
                Add New X Search Query
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuery} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Query Name / Label:</label>
                <input
                  type="text"
                  placeholder="e.g. Browser Playable itch.io Discovery"
                  value={newQueryName}
                  onChange={e => setNewQueryName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  X Search Query Text (supports AND, OR, quotes, url:itch.io, -is:retweet):
                </label>
                <textarea
                  placeholder='("play in browser" OR "playable in browser") (game OR demo) url:itch.io -is:retweet'
                  value={newQueryText}
                  onChange={e => setNewQueryText(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category:</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="RELEASE">RELEASE</option>
                    <option value="BROWSER">BROWSER</option>
                    <option value="INDIE_LAUNCH">INDIE_LAUNCH</option>
                    <option value="GAME_JAM">GAME_JAM</option>
                    <option value="VIRAL">VIRAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Priority:</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="P1">P1 (Core, frequent runs)</option>
                    <option value="P2">P2 (Secondary)</option>
                    <option value="P3">P3 (Exploratory)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Run Frequency (minutes):</label>
                <input
                  type="number"
                  value={newFreq}
                  onChange={e => setNewFreq(Number(e.target.value))}
                  min={15}
                  max={1440}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow"
                >
                  Approve & Add Query
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
