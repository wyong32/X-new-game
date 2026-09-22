import React, { useState } from 'react';
import type { XPost, XQuery, PostHumanLabel } from '../types.js';
import { formatDateTime, formatTimeAgo } from '../lib/formatters.js';
import {
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle2,
  XCircle,
  Sparkles,
  Link2,
  Image as ImageIcon
} from 'lucide-react';

interface PostExplorerProps {
  posts: XPost[];
  queries: XQuery[];
  onUpdatePostLabel: (postId: string, label: PostHumanLabel) => Promise<void>;
  onSelectCandidate?: (candidateId: string) => void;
}

export const PostExplorer: React.FC<PostExplorerProps> = ({
  posts,
  queries,
  onUpdatePostLabel,
  onSelectCandidate
}) => {
  const [search, setSearch] = useState('');
  const [selectedQueryId, setSelectedQueryId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<number>(0);
  const [hasUrlOnly, setHasUrlOnly] = useState<boolean>(false);
  const [hasMediaOnly, setHasMediaOnly] = useState<boolean>(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // Filter posts
  const filtered = posts.filter(p => {
    if (search) {
      const term = search.toLowerCase();
      const matchText = p.text.toLowerCase().includes(term);
      const matchAuthor = p.author_username.toLowerCase().includes(term);
      const matchGame = p.extracted_game_name && p.extracted_game_name.toLowerCase().includes(term);
      if (!matchText && !matchAuthor && !matchGame) return false;
    }

    if (selectedQueryId !== 'ALL' && !p.query_ids.includes(selectedQueryId)) {
      return false;
    }

    if (filterStatus !== 'ALL' && p.hard_filter_status !== filterStatus) {
      return false;
    }

    if (p.game_context_score < minScore) {
      return false;
    }

    if (hasUrlOnly && p.urls.length === 0) {
      return false;
    }

    if (hasMediaOnly && !p.has_media) {
      return false;
    }

    return true;
  });

  const getQueryName = (queryId: string) => {
    const q = queries.find(item => item.id === queryId);
    return q ? q.name : queryId;
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 font-bold';
    if (score >= 40) return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    if (score >= 20) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-slate-400 bg-slate-800 border-slate-700';
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              id="input-post-search"
              type="text"
              placeholder="Search post text, @author, extracted game..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md pl-8 pr-3 py-2 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Query Filter Dropdown */}
          <div className="flex items-center space-x-1 text-slate-400 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedQueryId}
              onChange={e => setSelectedQueryId(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer max-w-xs"
            >
              <option value="ALL">All Source Queries ({queries.length})</option>
              {queries.map(q => (
                <option key={q.id} value={q.id}>
                  {q.name} ({q.category})
                </option>
              ))}
            </select>
          </div>

          {/* Hard Filter Status */}
          <div className="flex items-center bg-slate-900 rounded-md border border-slate-700 p-0.5 text-xs">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2 py-1 rounded text-[11px] ${
                filterStatus === 'ALL' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setFilterStatus('PASSED')}
              className={`px-2 py-1 rounded text-[11px] ${
                filterStatus === 'PASSED' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Passed Filter
            </button>
            <button
              onClick={() => setFilterStatus('REJECTED')}
              className={`px-2 py-1 rounded text-[11px] ${
                filterStatus === 'REJECTED' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Noise Rejected
            </button>
          </div>
        </div>

        {/* Secondary Filter Toggles */}
        <div className="flex flex-wrap items-center justify-between text-xs pt-1 border-t border-slate-700/50">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px]">Min Context Score:</span>
            {[0, 30, 50, 70].map(s => (
              <button
                key={s}
                onClick={() => setMinScore(s)}
                className={`px-2 py-0.5 rounded text-[11px] ${
                  minScore === s ? 'bg-sky-600 text-white font-medium' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s === 0 ? 'Any' : `≥ ${s}`}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setHasUrlOnly(prev => !prev)}
              className={`px-2 py-0.5 rounded text-[11px] border flex items-center space-x-1 ${
                hasUrlOnly ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <Link2 className="w-3 h-3" />
              <span>Has URL</span>
            </button>

            <button
              onClick={() => setHasMediaOnly(prev => !prev)}
              className={`px-2 py-0.5 rounded text-[11px] border flex items-center space-x-1 ${
                hasMediaOnly ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Has Media</span>
            </button>

            <a
              href={`/api/export/posts?auth_token=${localStorage.getItem('lab_token') || ''}`}
              className="ml-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono transition-colors"
              title="Download CSV of all raw posts"
            >
              Export CSV
            </a>
          </div>
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-800/80 text-[11px] text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Filter</th>
                <th className="py-2.5 px-3">Score</th>
                <th className="py-2.5 px-3">Extracted Game</th>
                <th className="py-2.5 px-3">Author & Tweet Text</th>
                <th className="py-2.5 px-3">Source Query</th>
                <th className="py-2.5 px-3">Engagement</th>
                <th className="py-2.5 px-3 text-right">Explain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    No posts match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map(post => {
                  const isExpanded = expandedPostId === post.id;
                  return (
                    <React.Fragment key={post.id}>
                      <tr
                        className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-slate-800/40' : ''
                        }`}
                        onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                      >
                        {/* 1. Hard filter status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {post.hard_filter_status === 'PASSED' ? (
                            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> PASSED
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                              <XCircle className="w-3 h-3 mr-1" /> REJECTED
                            </span>
                          )}
                        </td>

                        {/* 2. Context score */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div
                            className={`inline-flex items-center justify-center border px-2 py-0.5 rounded text-xs font-mono ${getScoreColor(
                              post.game_context_score
                            )}`}
                          >
                            {post.game_context_score}
                          </div>
                        </td>

                        {/* 3. Extracted Game */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {post.extracted_game_name ? (
                            <div>
                              <div
                                onClick={e => {
                                  if (post.candidate_id && onSelectCandidate) {
                                    e.stopPropagation();
                                    onSelectCandidate(post.candidate_id);
                                  }
                                }}
                                className="font-semibold text-sky-300 hover:underline cursor-pointer"
                              >
                                {post.extracted_game_name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {post.extraction_method}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">None</span>
                          )}
                        </td>

                        {/* 4. Author & Post text */}
                        <td className="py-3 px-3 max-w-md">
                          <div className="flex items-center space-x-2 text-[11px] mb-1">
                            <span className="font-bold text-slate-200">@{post.author_username}</span>
                            <span className="text-slate-500 font-mono text-[10px]">{formatTimeAgo(post.created_at)}</span>
                            {post.urls.length > 0 && (
                              <span className="text-[10px] bg-slate-800 text-sky-400 px-1 py-0.2 rounded">
                                {post.urls.length} link{post.urls.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-300 line-clamp-2 text-xs leading-relaxed">
                            {post.text}
                          </div>
                        </td>

                        {/* 5. Source Query */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="text-[11px] text-slate-300 font-mono">
                            {getQueryName(post.query_ids[0])}
                          </div>
                          {post.query_ids.length > 1 && (
                            <div className="text-[10px] text-slate-500">
                              +{post.query_ids.length - 1} more queries
                            </div>
                          )}
                        </td>

                        {/* 6. Engagement */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          <div>♥ {post.like_count}</div>
                          <div>🔁 {post.repost_count}</div>
                        </td>

                        {/* 7. Action */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Expand Explainability Card"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Explainability Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-800/60">
                          <td colSpan={7} className="p-4">
                            <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <div className="font-semibold text-white text-xs flex items-center space-x-2">
                                  <Sparkles className="w-4 h-4 text-sky-400" />
                                  <span>Pipeline Diagnostics for Post {post.x_post_id}</span>
                                </div>
                                <a
                                  href={`https://x.com/${post.author_username}/status/${post.x_post_id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-sky-400 hover:underline flex items-center"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <span>View on X</span>
                                  <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {/* Left: Hard Filter Reasons & Scoring */}
                                <div className="space-y-2">
                                  <div className="font-medium text-slate-300">
                                    Hard Filter Evaluation:
                                  </div>
                                  {post.hard_filter_status === 'PASSED' ? (
                                    <div className="text-emerald-400 text-xs bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                                      ✓ Passed: No recruitment, tutorial, crypto, or spam patterns detected.
                                    </div>
                                  ) : (
                                    <div className="text-rose-400 text-xs bg-rose-500/10 p-2 rounded border border-rose-500/20 space-y-1">
                                      <div className="font-semibold">Rejection Triggers:</div>
                                      {(post.hard_filter_reasons || []).map((r, i) => (
                                        <div key={i}>• {r}</div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="font-medium text-slate-300 pt-1">
                                    Game Context Score Breakdown ({post.game_context_score}/100):
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    {post.game_context_positive_reasons.map((r, i) => (
                                      <div key={i} className="text-emerald-400">
                                        + {r}
                                      </div>
                                    ))}
                                    {post.game_context_negative_reasons.map((r, i) => (
                                      <div key={i} className="text-rose-400">
                                        - {r}
                                      </div>
                                    ))}
                                    {post.game_context_positive_reasons.length === 0 && (
                                      <div className="text-slate-500 italic">No positive release/game signals identified.</div>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Extraction Evidence & Ground Truth Labeling */}
                                <div className="space-y-3">
                                  <div>
                                    <div className="font-medium text-slate-300">Extracted Game Name:</div>
                                    <div className="text-slate-200 mt-1">
                                      {post.extracted_game_name ? (
                                        <div className="bg-slate-800 p-2 rounded border border-slate-700 text-xs">
                                          <div className="font-bold text-sky-400">{post.extracted_game_name}</div>
                                          <div className="text-slate-400 text-[11px] mt-0.5">
                                            Extraction Confidence: {post.extraction_confidence ?? 0}/30 • Method: {post.extraction_method}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-slate-500 italic text-xs">
                                          No valid entity extracted by URL, pattern, or heuristics.
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Human Labeling for post */}
                                  <div className="pt-2 border-t border-slate-800">
                                    <div className="font-medium text-slate-300 mb-1.5">Human Post Validation:</div>
                                    <div className="flex flex-wrap gap-1.5">
                                      <button
                                        onClick={() => onUpdatePostLabel(post.id, 'GOOD_DISCOVERY_POST')}
                                        className={`px-2 py-1 rounded text-[10px] font-medium border ${
                                          post.human_post_label === 'GOOD_DISCOVERY_POST'
                                            ? 'bg-emerald-600 border-emerald-500 text-white'
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-300'
                                        }`}
                                      >
                                        ✓ Good Discovery Post
                                      </button>
                                      <button
                                        onClick={() => onUpdatePostLabel(post.id, 'REAL_GAME_BUT_NOT_NEW')}
                                        className={`px-2 py-1 rounded text-[10px] font-medium border ${
                                          post.human_post_label === 'REAL_GAME_BUT_NOT_NEW'
                                            ? 'bg-sky-600 border-sky-500 text-white'
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-sky-300'
                                        }`}
                                      >
                                        ⚠ Real Game Not New
                                      </button>
                                      <button
                                        onClick={() => onUpdatePostLabel(post.id, 'NOISE')}
                                        className={`px-2 py-1 rounded text-[10px] font-medium border ${
                                          post.human_post_label === 'NOISE'
                                            ? 'bg-rose-600 border-rose-500 text-white'
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-rose-300'
                                        }`}
                                      >
                                        ✕ Noise / Spam
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
