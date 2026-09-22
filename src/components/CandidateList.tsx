import React, { useState } from 'react';
import type { GameCandidate, CandidateHumanLabel } from '../types.js';
import { formatTimeAgo } from '../lib/formatters.js';
import {
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Globe,
  Filter,
  ArrowUpDown,
  ChevronRight,
  Info
} from 'lucide-react';

interface CandidateListProps {
  candidates: GameCandidate[];
  onSelectCandidate: (id: string) => void;
  onUpdateLabel: (id: string, label: CandidateHumanLabel) => void;
  isLoading: boolean;
}

export const CandidateList: React.FC<CandidateListProps> = ({
  candidates,
  onSelectCandidate,
  onUpdateLabel,
  isLoading
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HIGH_CONFIDENCE' | 'REVIEW' | 'WEAK'>('ALL');
  const [browserFilter, setBrowserFilter] = useState<'ALL' | 'BROWSER' | 'NON_BROWSER'>('ALL');
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'UNREVIEWED' | 'REVIEWED'>('ALL');
  const [sortBy, setSortBy] = useState<'score' | 'newest' | 'authors' | 'engagement'>('score');

  // Filter candidates
  const filtered = candidates.filter(c => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = c.canonical_name.toLowerCase().includes(term);
      const matchAlias = c.aliases.some(a => a.toLowerCase().includes(term));
      if (!matchName && !matchAlias) return false;
    }

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'HIGH_CONFIDENCE' && c.candidate_score < 80) return false;
      if (statusFilter === 'REVIEW' && (c.candidate_score < 60 || c.candidate_score >= 80)) return false;
      if (statusFilter === 'WEAK' && c.candidate_score >= 60) return false;
    }

    if (browserFilter === 'BROWSER' && !c.browser_signal) return false;
    if (browserFilter === 'NON_BROWSER' && c.browser_signal) return false;

    if (reviewFilter === 'UNREVIEWED' && c.human_label) return false;
    if (reviewFilter === 'REVIEWED' && !c.human_label) return false;

    return true;
  });

  // Sort candidates
  filtered.sort((a, b) => {
    if (sortBy === 'score') return b.candidate_score - a.candidate_score;
    if (sortBy === 'newest') return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    if (sortBy === 'authors') return b.unique_author_count - a.unique_author_count;
    if (sortBy === 'engagement') return b.max_engagement - a.max_engagement;
    return 0;
  });

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold';
    if (score >= 60) return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    if (score >= 40) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'URL_METADATA':
        return <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">URL Slug</span>;
      case 'EXPLICIT_PATTERN':
        return <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded">Pattern</span>;
      case 'HASHTAG':
        return <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">Hashtag</span>;
      case 'GEMINI':
        return <span className="text-[10px] bg-teal-500/15 text-teal-300 border border-teal-500/30 px-1.5 py-0.5 rounded">Gemini AI</span>;
      default:
        return <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">Heuristic</span>;
    }
  };

  const renderHumanLabelBadge = (label?: CandidateHumanLabel) => {
    if (!label) {
      return (
        <span className="inline-flex items-center text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
          <Clock className="w-3 h-3 mr-1 text-amber-400" /> Pending Review
        </span>
      );
    }

    switch (label) {
      case 'VALUABLE_NEW_GAME':
        return (
          <span className="inline-flex items-center text-[11px] font-medium text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" /> Valuable New Game
          </span>
        );
      case 'VALID_GAME':
        return (
          <span className="inline-flex items-center text-[11px] font-medium text-sky-300 bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3 mr-1 text-sky-400" /> Valid Game
          </span>
        );
      case 'NOT_A_GAME':
        return (
          <span className="inline-flex items-center text-[11px] text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded">
            <XCircle className="w-3 h-3 mr-1 text-rose-400" /> Not a Game
          </span>
        );
      case 'WRONG_GAME_NAME':
        return (
          <span className="inline-flex items-center text-[11px] text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded">
            <XCircle className="w-3 h-3 mr-1 text-amber-400" /> Wrong Name
          </span>
        );
      case 'OLD_GAME':
        return (
          <span className="inline-flex items-center text-[11px] text-slate-300 bg-slate-700/60 border border-slate-600 px-2 py-0.5 rounded">
            Old Game
          </span>
        );
      case 'DUPLICATE':
        return (
          <span className="inline-flex items-center text-[11px] text-purple-300 bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 rounded">
            Duplicate
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[11px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
            {label}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              id="input-candidate-search"
              type="text"
              placeholder="Search game title, aliases..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md pl-8 pr-3 py-2 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Status */}
            <div className="flex items-center bg-slate-900 rounded-md border border-slate-700 p-0.5">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2 py-1 rounded text-[11px] transition-colors ${
                  statusFilter === 'ALL' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Scores
              </button>
              <button
                onClick={() => setStatusFilter('HIGH_CONFIDENCE')}
                className={`px-2 py-1 rounded text-[11px] transition-colors ${
                  statusFilter === 'HIGH_CONFIDENCE' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                High Conf (≥80)
              </button>
              <button
                onClick={() => setStatusFilter('REVIEW')}
                className={`px-2 py-1 rounded text-[11px] transition-colors ${
                  statusFilter === 'REVIEW' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Review (60-79)
              </button>
              <button
                onClick={() => setStatusFilter('WEAK')}
                className={`px-2 py-1 rounded text-[11px] transition-colors ${
                  statusFilter === 'WEAK' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Weak (&lt;60)
              </button>
            </div>

            {/* Browser Toggle */}
            <button
              onClick={() =>
                setBrowserFilter(prev => (prev === 'ALL' ? 'BROWSER' : prev === 'BROWSER' ? 'NON_BROWSER' : 'ALL'))
              }
              className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium flex items-center space-x-1 transition-colors ${
                browserFilter === 'BROWSER'
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : browserFilter === 'NON_BROWSER'
                  ? 'bg-slate-700 border-slate-600 text-slate-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3 h-3 mr-1" />
              <span>{browserFilter === 'BROWSER' ? 'Browser/H5 Only' : browserFilter === 'NON_BROWSER' ? 'PC/Steam Only' : 'All Platforms'}</span>
            </button>

            {/* Review Status Toggle */}
            <button
              onClick={() =>
                setReviewFilter(prev => (prev === 'ALL' ? 'UNREVIEWED' : prev === 'UNREVIEWED' ? 'REVIEWED' : 'ALL'))
              }
              className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium flex items-center space-x-1 transition-colors ${
                reviewFilter === 'UNREVIEWED'
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : reviewFilter === 'REVIEWED'
                  ? 'bg-slate-700 border-slate-600 text-slate-200'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Filter className="w-3 h-3 mr-1" />
              <span>{reviewFilter === 'UNREVIEWED' ? 'Unreviewed Only' : reviewFilter === 'REVIEWED' ? 'Reviewed Only' : 'Review State: All'}</span>
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1 text-slate-400 bg-slate-900 border border-slate-700 rounded-md px-2 py-1">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
              >
                <option value="score">Highest Score</option>
                <option value="newest">Newest Discovery</option>
                <option value="authors">Most Authors</option>
                <option value="engagement">Max Likes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status Count Summary Bar */}
        <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-700/60 pt-2 px-1">
          <div>
            Showing <strong className="text-white">{filtered.length}</strong> of{' '}
            <strong className="text-slate-300">{candidates.length}</strong> discovered game candidates
          </div>
          <div className="flex items-center space-x-3">
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
              High Conf (≥80): {candidates.filter(c => c.candidate_score >= 80).length}
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-sky-400 mr-1.5" />
              Review (60-79): {candidates.filter(c => c.candidate_score >= 60 && c.candidate_score < 80).length}
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-indigo-400 mr-1.5" />
              Browser/H5: {candidates.filter(c => c.browser_signal).length}
            </span>
          </div>
        </div>
      </div>

      {/* Candidates Dense Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-800/80 text-[11px] text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Score</th>
                <th className="py-2.5 px-3">Game Title & Identity</th>
                <th className="py-2.5 px-3">Platform</th>
                <th className="py-2.5 px-3">Extraction</th>
                <th className="py-2.5 px-3">Signals</th>
                <th className="py-2.5 px-3">Human Review Label</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    No candidates matching current filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  return (
                    <tr
                      key={c.id}
                      id={`candidate-row-${c.id}`}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => onSelectCandidate(c.id)}
                    >
                      {/* 1. Score */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div
                          className={`inline-flex items-center justify-center border px-2 py-1 rounded text-xs font-mono ${getScoreBadgeColor(
                            c.candidate_score
                          )}`}
                          title={`Score: ${c.candidate_score}/100. Entity Conf: ${c.entity_confidence}/30`}
                        >
                          {c.candidate_score}
                        </div>
                      </td>

                      {/* 2. Game Title & Identity */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-100 group-hover:text-sky-300 transition-colors flex items-center space-x-1.5">
                          <span>{c.canonical_name}</span>
                          {c.urls.length > 0 && (
                            <a
                              href={c.urls[0]}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-slate-500 hover:text-sky-400 p-0.5"
                              title={c.urls[0]}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        {c.aliases.length > 0 && (
                          <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                            aliases: {c.aliases.join(', ')}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-0.5">
                          <span>Discovered {formatTimeAgo(c.first_seen_at)}</span>
                          <span>•</span>
                          <span>{c.source_query_ids.length} queries matched</span>
                        </div>
                      </td>

                      {/* 3. Platform */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {c.browser_signal ? (
                          <span className="inline-flex items-center text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded">
                            <Globe className="w-3 h-3 mr-1 text-emerald-400" /> Browser / H5
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            PC / Indie
                          </span>
                        )}
                      </td>

                      {/* 4. Extraction Method */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          {getMethodBadge(c.extraction_method)}
                          <div className="text-[10px] text-slate-500 font-mono">
                            conf: {Math.round((c.entity_confidence / 30) * 100)}%
                          </div>
                        </div>
                      </td>

                      {/* 5. Signals */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-[11px] text-slate-300 space-y-0.5">
                          <div>
                            <strong className="text-white">{c.unique_post_count}</strong> post{c.unique_post_count > 1 ? 's' : ''} ({c.unique_author_count} author{c.unique_author_count > 1 ? 's' : ''})
                          </div>
                          <div className="text-[10px] text-slate-400">
                            max likes: {c.max_engagement}
                          </div>
                        </div>
                      </td>

                      {/* 6. Human Review Label & Inline quick actions */}
                      <td className="py-3 px-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="space-y-1.5">
                          <div>{renderHumanLabelBadge(c.human_label)}</div>

                          {/* Quick review buttons */}
                          <div className="flex items-center space-x-1">
                            <button
                              id={`btn-label-valuable-${c.id}`}
                              onClick={() => onUpdateLabel(c.id, 'VALUABLE_NEW_GAME')}
                              className={`p-1 rounded text-[10px] border transition-colors ${
                                c.human_label === 'VALUABLE_NEW_GAME'
                                  ? 'bg-emerald-600 border-emerald-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/40'
                              }`}
                              title="Mark as VALUABLE_NEW_GAME"
                            >
                              ★ Valuable
                            </button>
                            <button
                              id={`btn-label-valid-${c.id}`}
                              onClick={() => onUpdateLabel(c.id, 'VALID_GAME')}
                              className={`p-1 rounded text-[10px] border transition-colors ${
                                c.human_label === 'VALID_GAME'
                                  ? 'bg-sky-600 border-sky-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-sky-300 hover:border-sky-500/40'
                              }`}
                              title="Mark as VALID_GAME"
                            >
                              ✓ Valid
                            </button>
                            <button
                              id={`btn-label-wrong-${c.id}`}
                              onClick={() => onUpdateLabel(c.id, 'WRONG_GAME_NAME')}
                              className={`p-1 rounded text-[10px] border transition-colors ${
                                c.human_label === 'WRONG_GAME_NAME'
                                  ? 'bg-amber-600 border-amber-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-500/40'
                              }`}
                              title="Mark as WRONG_GAME_NAME"
                            >
                              ✕ Name
                            </button>
                            <button
                              id={`btn-label-reject-${c.id}`}
                              onClick={() => onUpdateLabel(c.id, 'NOT_A_GAME')}
                              className={`p-1 rounded text-[10px] border transition-colors ${
                                c.human_label === 'NOT_A_GAME'
                                  ? 'bg-rose-600 border-rose-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-500/40'
                              }`}
                              title="Mark as NOT_A_GAME"
                            >
                              ✕ Not Game
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 7. Action Button */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          id={`btn-view-evidence-${c.id}`}
                          onClick={e => {
                            e.stopPropagation();
                            onSelectCandidate(c.id);
                          }}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs transition-colors"
                        >
                          <span>Evidence</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
