import React, { useEffect, useState } from 'react';
import type { QueryAnalyticsSummary, QueryHealth } from '../types.js';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  Download,
  BarChart3,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Layers
} from 'lucide-react';

interface QueryAnalyticsProps {
  onSelectQueryFilter?: (queryId: string) => void;
}

export const QueryAnalytics: React.FC<QueryAnalyticsProps> = ({ onSelectQueryFilter }) => {
  const [data, setData] = useState<{
    summaries: QueryAnalyticsSummary[];
    leaderboard_valuable_yield: QueryAnalyticsSummary[];
    leaderboard_precision: QueryAnalyticsSummary[];
    highest_noise: QueryAnalyticsSummary[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/queries');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load query analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full mb-2" />
        <div>Computing query precision and yield analytics...</div>
      </div>
    );
  }

  const getHealthBadge = (health: QueryHealth) => {
    switch (health) {
      case 'EXCELLENT':
        return <span className="inline-flex items-center text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded">★ EXCELLENT</span>;
      case 'GOOD':
        return <span className="inline-flex items-center text-[10px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded">✓ GOOD</span>;
      case 'WATCH':
        return <span className="inline-flex items-center text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded">⚠ WATCH</span>;
      case 'POOR':
        return <span className="inline-flex items-center text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">✕ POOR</span>;
      case 'ERROR':
        return <span className="inline-flex items-center text-[10px] font-bold bg-rose-700/40 text-rose-200 border border-rose-600 px-2 py-0.5 rounded">ERROR</span>;
      default:
        return <span className="inline-flex items-center text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">INSUFFICIENT DATA</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-sky-400" />
              <span>Query Precision & Yield Analytics</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Determines exactly which X queries deliver high-value new discoveries versus wasteful noise.
            </p>
          </div>

          <a
            href="/api/export/queries"
            className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export Analytics CSV</span>
          </a>
        </div>
      </div>

      {/* Top 3 Metric Leaderboard Cards (Requirement ③ Focus) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leaderboard 1: Top Valuable Yield */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center uppercase tracking-wider font-mono">
              <Award className="w-4 h-4 mr-1.5" />
              Top Valuable Yield (Per 1k)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">GOLD STANDARD</span>
          </div>
          <div className="space-y-2">
            {data.leaderboard_valuable_yield.slice(0, 3).map((q, idx) => (
              <div key={q.query_id} className="bg-slate-800/40 p-2 rounded border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-100 flex items-center space-x-1.5">
                    <span className="text-emerald-400 font-mono">#{idx + 1}</span>
                    <span className="truncate max-w-[170px]">{q.query_name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {q.valuable_new_games} valuable games from {q.total_posts} posts
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-bold text-emerald-400">{q.yield_valuable_per_1k_posts}</div>
                  <div className="text-[9px] text-slate-500">per 1k posts</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard 2: Top Precision */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-sky-400 flex items-center uppercase tracking-wider font-mono">
              <TrendingUp className="w-4 h-4 mr-1.5" />
              Highest Valid Precision
            </span>
            <span className="text-[10px] text-slate-500 font-mono">VALID GAME %</span>
          </div>
          <div className="space-y-2">
            {data.leaderboard_precision.slice(0, 3).map((q, idx) => (
              <div key={q.query_id} className="bg-slate-800/40 p-2 rounded border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-100 flex items-center space-x-1.5">
                    <span className="text-sky-400 font-mono">#{idx + 1}</span>
                    <span className="truncate max-w-[170px]">{q.query_name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {q.human_valid_games} valid / {q.human_reviewed_candidates} reviewed
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-bold text-sky-400">{q.precision_valid_game}%</div>
                  <div className="text-[9px] text-slate-500">precision</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard 3: Highest Noise / Needs Tightening */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-rose-400 flex items-center uppercase tracking-wider font-mono">
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              Highest Noise Queries
            </span>
            <span className="text-[10px] text-slate-500 font-mono">LOW PASS RATE</span>
          </div>
          <div className="space-y-2">
            {data.highest_noise.slice(0, 3).map((q, idx) => (
              <div key={q.query_id} className="bg-slate-800/40 p-2 rounded border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-100 flex items-center space-x-1.5">
                    <span className="text-rose-400 font-mono">#{idx + 1}</span>
                    <span className="truncate max-w-[170px]">{q.query_name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {q.total_posts - q.posts_passed} rejected by hard filter
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-bold text-rose-400">{q.pass_rate}%</div>
                  <div className="text-[9px] text-slate-500">pass rate</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comprehensive Query Analytics Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
            Query Performance & Efficiency Matrix
          </div>
          <div className="text-[11px] text-slate-400">
            Based on ground-truth human annotations & hard filter performance
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-800/80 text-[11px] text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Health</th>
                <th className="py-2.5 px-3">Query Name & Syntax</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Posts Collected</th>
                <th className="py-2.5 px-3">Pass Rate</th>
                <th className="py-2.5 px-3">Candidates</th>
                <th className="py-2.5 px-3">Valid Game %</th>
                <th className="py-2.5 px-3">Valuable New %</th>
                <th className="py-2.5 px-3">Yield / 1k Posts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {data.summaries.map(s => (
                <tr key={s.query_id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Health */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getHealthBadge(s.health)}
                  </td>

                  {/* Query Name */}
                  <td className="py-3 px-3 max-w-xs">
                    <div className="font-semibold text-slate-100">{s.query_name}</div>
                    <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5" title={s.query_text}>
                      {s.query_text}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {s.category}
                    </span>
                  </td>

                  {/* Total Posts */}
                  <td className="py-3 px-3 whitespace-nowrap font-mono">
                    <strong className="text-white">{s.total_posts}</strong>
                    <div className="text-[10px] text-slate-500">
                      {s.posts_passed} passed
                    </div>
                  </td>

                  {/* Pass Rate */}
                  <td className="py-3 px-3 whitespace-nowrap font-mono">
                    <span
                      className={`font-semibold ${
                        s.pass_rate >= 70
                          ? 'text-emerald-400'
                          : s.pass_rate >= 40
                          ? 'text-sky-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {s.pass_rate}%
                    </span>
                  </td>

                  {/* Candidates Generated & Reviewed */}
                  <td className="py-3 px-3 whitespace-nowrap font-mono">
                    <div>
                      <strong className="text-sky-300">{s.candidates_generated}</strong> cands
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {s.human_reviewed_candidates} reviewed
                    </div>
                  </td>

                  {/* Precision Valid Game */}
                  <td className="py-3 px-3 whitespace-nowrap font-mono">
                    <div className="font-bold text-white">{s.precision_valid_game}%</div>
                    <div className="text-[10px] text-slate-500">
                      {s.human_valid_games} valid
                    </div>
                  </td>

                  {/* Precision Valuable New Game */}
                  <td className="py-3 px-3 whitespace-nowrap font-mono">
                    <div className="font-bold text-emerald-400">{s.precision_valuable_new_game}%</div>
                    <div className="text-[10px] text-slate-500">
                      {s.valuable_new_games} valuable
                    </div>
                  </td>

                  {/* Yield per 1k posts */}
                  <td className="py-3 px-3 whitespace-nowrap font-mono">
                    <div className="text-sm font-bold text-emerald-400">
                      {s.yield_valuable_per_1k_posts}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      1 game / {s.posts_per_valuable_game || '—'} posts
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
