import React from 'react';
import type { GameCandidate, XQuery, CandidateHumanLabel } from '../types.js';
import { formatTimeAgo } from '../lib/formatters.js';
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Globe,
  Award,
  Layers,
  ChevronRight,
  Filter,
  Activity,
  AlertTriangle
} from 'lucide-react';

interface DashboardProps {
  status: any;
  candidates: GameCandidate[];
  queries: XQuery[];
  onSelectCandidate: (id: string) => void;
  onNavigateTab: (tab: string) => void;
  onUpdateLabel: (id: string, label: CandidateHumanLabel) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  status,
  candidates,
  queries,
  onSelectCandidate,
  onNavigateTab,
  onUpdateLabel
}) => {
  // Sort candidates by score descending
  const topCandidates = [...candidates]
    .sort((a, b) => b.candidate_score - a.candidate_score)
    .slice(0, 6);

  // Best queries by precision
  const bestQueries = [...queries]
    .sort((a, b) => b.precision - a.precision)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>𝕏 Game Discovery Research Lab</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Automated entity extraction, game-ness context scoring, and query precision analytics for discovering new web/indie games from X posts.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="dash-btn-review-candidates"
              onClick={() => onNavigateTab('candidates')}
              className="inline-flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-3 py-2 rounded-md shadow transition-colors"
            >
              <span>Review Candidates ({candidates.filter(c => !c.human_label).length} pending)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Core Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Valuable New Game Precision */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Valuable New Precision</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {status?.valuable_new_precision_pct ?? 0}%
          </div>
          <div className="text-[11px] text-slate-400">
            <strong>{status?.valuable_new_games ?? 0}</strong> of {status?.reviewed_candidates ?? 0} reviewed
          </div>
        </div>

        {/* Metric 2: Candidate Precision */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Valid Game Precision</span>
            <ShieldCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-sky-400">
            {status?.candidate_precision_pct ?? 0}%
          </div>
          <div className="text-[11px] text-slate-400">
            <strong>{status?.valid_games ?? 0}</strong> verified games
          </div>
        </div>

        {/* Metric 3: Raw Posts Processed & Filter Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Filter Pass Rate</span>
            <Filter className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {status?.total_posts ? Math.round((status.passed_posts / status.total_posts) * 100) : 0}%
          </div>
          <div className="text-[11px] text-slate-400">
            {status?.passed_posts ?? 0} passed / {status?.total_posts ?? 0} total posts
          </div>
        </div>

        {/* Metric 4: High Confidence Candidates */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Total Candidates</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">
            {status?.total_candidates ?? 0}
          </div>
          <div className="text-[11px] text-slate-400">
            <strong>{status?.high_confidence_candidates ?? 0}</strong> with score ≥ 80
          </div>
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Top Candidates Discovered */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-sky-400" />
              Top Discovered Candidates Today
            </h2>
            <button
              onClick={() => onNavigateTab('candidates')}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center"
            >
              <span>View all ({candidates.length})</span>
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          <div className="space-y-3">
            {topCandidates.map(c => (
              <div
                key={c.id}
                onClick={() => onSelectCandidate(c.id)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-2 cursor-pointer transition-all hover:bg-slate-800/30 group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white group-hover:text-sky-300 transition-colors text-sm">
                        {c.canonical_name}
                      </span>
                      {c.browser_signal && (
                        <span className="inline-flex items-center text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                          <Globe className="w-2.5 h-2.5 mr-1" /> Browser / H5
                        </span>
                      )}
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                        {c.extraction_method}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {c.unique_post_count} posts from {c.unique_author_count} creators • Discovered {formatTimeAgo(c.first_seen_at)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      {c.candidate_score}
                      <span className="text-xs text-slate-500 font-normal">/100</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Conf: {c.entity_confidence}/30
                    </div>
                  </div>
                </div>

                {/* Why Selected highlights (Requirement ②) */}
                {c.why_selected && c.why_selected.length > 0 && (
                  <div className="bg-slate-800/40 rounded p-2 text-xs text-slate-300 space-y-1 border border-slate-800">
                    <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold">
                      Why Selected:
                    </div>
                    {c.why_selected.slice(0, 2).map((reason, idx) => (
                      <div key={idx} className="flex items-center space-x-1.5 text-[11px]">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span className="truncate">{reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom row: Review status & inline actions */}
                <div
                  className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="text-[11px]">
                    {c.human_label ? (
                      <span className="font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {c.human_label}
                      </span>
                    ) : (
                      <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Pending Review
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onUpdateLabel(c.id, 'VALUABLE_NEW_GAME')}
                      className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                    >
                      ★ Valuable
                    </button>
                    <button
                      onClick={() => onUpdateLabel(c.id, 'VALID_GAME')}
                      className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                    >
                      ✓ Valid
                    </button>
                    <button
                      onClick={() => onUpdateLabel(c.id, 'NOT_A_GAME')}
                      className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Top Performing Queries & Noise Defense */}
        <div className="space-y-6">
          {/* Top Performing Queries */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-emerald-400" />
                Best Queries by Precision
              </h3>
              <button
                onClick={() => onNavigateTab('analytics_queries')}
                className="text-[11px] text-sky-400 hover:underline"
              >
                Analytics
              </button>
            </div>

            <div className="space-y-2">
              {bestQueries.map(q => (
                <div key={q.id} className="bg-slate-800/40 p-2.5 rounded border border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 truncate max-w-[170px]">{q.name}</span>
                    <span className="font-mono font-bold text-emerald-400">{q.precision}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>{q.valuable_new_games} valuable games</span>
                    <span className="font-mono">{q.posts_collected} posts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Noise Defense Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2 text-rose-400" />
                Noise Rejection Engine
              </h3>
              <span className="text-[10px] font-mono text-slate-400">HARD FILTER</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              The two-stage hard filter automatically rejects recruitment, Unity/Godot beginner tutorials, Unreal asset packs, and crypto promotions before candidate extraction.
            </p>

            <div className="bg-slate-800/40 p-3 rounded border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Noise Filtered Out:</span>
                <strong className="text-rose-400 font-mono">
                  {status?.total_posts ? status.total_posts - status.passed_posts : 0} posts
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Filter Rejection Rate:</span>
                <strong className="text-white font-mono">{status?.noise_rate_pct ?? 0}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
