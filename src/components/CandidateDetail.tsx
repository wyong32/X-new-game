import React, { useState, useEffect } from 'react';
import type { GameCandidate, XPost, CandidateHumanLabel, XQuery, CandidateQueryEvidence } from '../types.js';
import { formatDateTime, formatTimeAgo } from '../lib/formatters.js';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Globe,
  Share2,
  Calendar,
  Layers,
  Edit3,
  GitMerge,
  Sparkles,
  AlertTriangle,
  Info,
  ShieldCheck,
  Award,
  Compass
} from 'lucide-react';

interface CandidateDetailProps {
  candidateId: string;
  onBack: () => void;
  onUpdateCandidate: (id: string, partial: Partial<GameCandidate>) => Promise<void>;
  onMergeCandidate: (sourceId: string, targetId: string) => Promise<void>;
  allCandidates: GameCandidate[];
}

export const CandidateDetail: React.FC<CandidateDetailProps> = ({
  candidateId,
  onBack,
  onUpdateCandidate,
  onMergeCandidate,
  allCandidates
}) => {
  const [candidate, setCandidate] = useState<
    (GameCandidate & { posts: XPost[]; queries: XQuery[]; evidence?: CandidateQueryEvidence[] }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMergeTarget, setSelectedMergeTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('lab_token');
      const res = await fetch(`/api/candidates/${candidateId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setCandidate(data);
        setTempName(data.canonical_name);
        setNotes(data.human_notes || '');
      }
    } catch (err) {
      console.error('Failed to fetch candidate details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [candidateId]);

  if (loading || !candidate) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full mb-2" />
        <div>Loading candidate evidence and score breakdown...</div>
      </div>
    );
  }

  const handleSetLabel = async (label: CandidateHumanLabel) => {
    setSaving(true);
    try {
      await onUpdateCandidate(candidate.id, {
        human_label: label,
        human_notes: notes
      });
      await fetchDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await onUpdateCandidate(candidate.id, { human_notes: notes });
      await fetchDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    setSaving(true);
    try {
      await onUpdateCandidate(candidate.id, { canonical_name: tempName.trim() });
      setEditingName(false);
      await fetchDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleAddAlias = async () => {
    if (!newAlias.trim()) return;
    const updatedAliases = [...candidate.aliases, newAlias.trim()];
    setSaving(true);
    try {
      await onUpdateCandidate(candidate.id, { aliases: updatedAliases });
      setNewAlias('');
      await fetchDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedMergeTarget) return;
    if (confirm(`Merge "${candidate.canonical_name}" into target candidate?`)) {
      setSaving(true);
      try {
        await onMergeCandidate(candidate.id, selectedMergeTarget);
        onBack();
      } finally {
        setSaving(false);
      }
    }
  };

  const reviewButtons: { label: CandidateHumanLabel; text: string; color: string }[] = [
    { label: 'VALUABLE_NEW_GAME', text: '★ Valuable New Game', color: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
    { label: 'VALID_GAME', text: '✓ Valid Game', color: 'bg-sky-600 hover:bg-sky-500 text-white' },
    { label: 'WRONG_GAME_NAME', text: '✕ Wrong Game Name', color: 'bg-amber-600 hover:bg-amber-500 text-white' },
    { label: 'NOT_A_GAME', text: '✕ Not a Game', color: 'bg-rose-600 hover:bg-rose-500 text-white' },
    { label: 'OLD_GAME', text: '⚠ Old Game (Not New)', color: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
    { label: 'NOISE', text: '✕ Noise / Promotion', color: 'bg-rose-700 hover:bg-rose-600 text-white' },
    { label: 'GAME_NOT_TARGET', text: '⚠ Not Target Genre', color: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
    { label: 'DUPLICATE', text: '🔁 Duplicate Entity', color: 'bg-purple-600 hover:bg-purple-500 text-white' },
    { label: 'UNSURE', text: '？ Unsure', color: 'bg-slate-800 hover:bg-slate-700 text-slate-300' }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Back Nav & Quick Summary */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-md transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Candidates</span>
        </button>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400">Status:</span>
          <span className="font-mono bg-slate-800 border border-slate-700 text-slate-200 px-2 py-0.5 rounded">
            {candidate.status}
          </span>
          {candidate.human_label && (
            <span className="font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {candidate.human_label}
            </span>
          )}
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center space-x-3">
              {editingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    className="bg-slate-800 border border-slate-600 text-white text-lg font-bold px-2 py-1 rounded"
                  />
                  <button
                    onClick={handleSaveName}
                    className="bg-sky-600 text-white text-xs px-2.5 py-1.5 rounded"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="text-slate-400 text-xs px-2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {candidate.canonical_name}
                  </h1>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-slate-500 hover:text-sky-400 p-1"
                    title="Edit canonical title"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {candidate.browser_signal && (
                <span className="inline-flex items-center text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  <Globe className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  Browser / H5 Playable
                </span>
              )}
            </div>

            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-2">
              <span>Normalized Key: <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">{candidate.normalized_name}</code></span>
              <span>•</span>
              <span>Extraction Method: <strong className="text-sky-300">{candidate.extraction_method}</strong></span>
              <span>•</span>
              <span>First seen: {formatDateTime(candidate.first_seen_at)}</span>
              <span>•</span>
              <span>Last seen: {formatDateTime(candidate.last_seen_at)}</span>
            </div>

            {/* Aliases */}
            <div className="flex items-center space-x-2 mt-2 text-xs">
              <span className="text-slate-500">Aliases:</span>
              {candidate.aliases.length > 0 ? (
                candidate.aliases.map((a, i) => (
                  <span key={i} className="bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                    {a}
                  </span>
                ))
              ) : (
                <span className="text-slate-600 italic">None</span>
              )}
              <div className="inline-flex items-center space-x-1 ml-2">
                <input
                  type="text"
                  placeholder="+ Add alias"
                  value={newAlias}
                  onChange={e => setNewAlias(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 text-[11px] text-slate-200 px-2 py-0.5 rounded w-24 focus:outline-none focus:border-sky-500"
                />
                {newAlias && (
                  <button
                    onClick={handleAddAlias}
                    className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-1.5 py-0.5 rounded"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Big Score Box */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-3 text-center min-w-[140px]">
            <div className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">Candidate Score</div>
            <div className="text-3xl font-bold font-mono text-emerald-400 mt-0.5">
              {candidate.candidate_score}
              <span className="text-xs text-slate-500 font-normal">/100</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Entity Conf: <strong>{candidate.entity_confidence}/30</strong>
            </div>
          </div>
        </div>
      </div>

      {/* The Crucial Requirement ②: Explicitly Explain "Why this candidate was selected" */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Why Selected & Score Factors Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: Why was this candidate selected? */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center">
                <Award className="w-4 h-4 mr-2 text-sky-400" />
                Why This Candidate Was Selected
              </h2>
              <span className="text-[11px] text-slate-400">Total Score: {candidate.candidate_score} pts</span>
            </div>

            {/* Narrative summary points */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3 space-y-2 text-xs text-slate-200">
              {candidate.why_selected && candidate.why_selected.length > 0 ? (
                candidate.why_selected.map((reason, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                    <span>{reason}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-400">Candidate qualified through query match and context scoring.</div>
              )}
            </div>

            {/* Explicit Score Breakdown Table */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-300">Point Allocation Breakdown:</div>
              <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800 text-xs">
                {candidate.score_breakdown.map((factor, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-slate-900/60 hover:bg-slate-800/30">
                    <div className="space-y-0.5">
                      <div className="font-medium text-slate-200">{factor.name}</div>
                      <div className="text-[11px] text-slate-400">{factor.reason}</div>
                    </div>
                    <div className="text-right font-mono">
                      <span className={`font-bold ${factor.points > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        +{factor.points}
                      </span>
                      <span className="text-slate-600 text-[10px]"> / {factor.maxPoints}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Discovered URLs */}
            {candidate.urls.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-medium text-slate-300">Discovered Game URLs:</div>
                <div className="space-y-1.5">
                  {candidate.urls.map((u, i) => (
                    <a
                      key={i}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300 bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 rounded flex items-center justify-between transition-colors"
                    >
                      <span className="truncate">{u}</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-2 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: Query Attribution & Discovery Evidence (P1 Requirement 8) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center">
                <Compass className="w-4 h-4 mr-2 text-indigo-400" />
                Query Attribution & Discovery Evidence
              </h2>
              <span className="text-[11px] text-slate-400">
                {candidate.queries.length} contributing queries
              </span>
            </div>

            <div className="space-y-3">
              {candidate.queries.map(q => {
                const isFirst = candidate.first_discovery_query_id === q.id;
                const ev = candidate.evidence?.find(e => e.query_id === q.id);
                return (
                  <div
                    key={q.id}
                    className={`p-3 rounded-lg border text-xs space-y-1.5 transition-colors ${
                      isFirst
                        ? 'bg-indigo-950/30 border-indigo-500/40 text-slate-200'
                        : 'bg-slate-800/40 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {isFirst && (
                          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
                            ★ First Discovered By
                          </span>
                        )}
                        <span className="font-semibold text-white">{q.name}</span>
                        <span className="text-slate-500 font-mono text-[10px]">({q.id})</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                          {q.category}
                        </span>
                        <span className="font-mono text-sky-400">{q.priority}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono bg-slate-900/60 p-1.5 rounded">
                      {q.query_text}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>
                        Posts contributed:{' '}
                        <strong className="text-white">
                          {ev ? ev.post_count : candidate.posts.filter(p => p.query_ids.includes(q.id)).length}
                        </strong>
                      </span>
                      <span>
                        First seen:{' '}
                        <strong>{formatDateTime(ev?.first_seen_at || candidate.first_seen_at)}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: All Contributing Source Posts */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center">
                <Share2 className="w-4 h-4 mr-2 text-sky-400" />
                Contributing Source Posts ({candidate.posts.length})
              </h2>
              <span className="text-[11px] text-slate-400">{candidate.unique_author_count} unique authors</span>
            </div>

            <div className="space-y-4">
              {candidate.posts.map((post, idx) => (
                <div
                  key={post.id}
                  className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-4 space-y-3"
                >
                  {/* Post header */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">@{post.author_username}</span>
                      <span className="text-slate-500 font-mono text-[11px]">ID: {post.x_post_id}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">{formatDateTime(post.created_at)}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono text-[11px]">
                        Context Score: <strong className="text-emerald-400">{post.game_context_score}</strong>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          post.hard_filter_status === 'PASSED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {post.hard_filter_status}
                      </span>
                    </div>
                  </div>

                  {/* Post Text */}
                  <div className="text-xs text-slate-100 leading-relaxed bg-slate-900/60 p-3 rounded border border-slate-800">
                    {post.text}
                  </div>

                  {/* Positive/Negative Context Reasons for this post */}
                  <div className="text-[11px] space-y-1">
                    {post.game_context_positive_reasons.map((r, i) => (
                      <div key={i} className="text-emerald-400 flex items-center space-x-1.5">
                        <span>+</span>
                        <span>{r}</span>
                      </div>
                    ))}
                    {post.game_context_negative_reasons.map((r, i) => (
                      <div key={i} className="text-rose-400 flex items-center space-x-1.5">
                        <span>-</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>

                  {/* Post Footer Metrics */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                    <div className="flex items-center space-x-3">
                      <span>Likes: <strong>{post.like_count}</strong></span>
                      <span>Reposts: <strong>{post.repost_count}</strong></span>
                      <span>Replies: <strong>{post.reply_count}</strong></span>
                    </div>
                    <div>
                      Extraction: <strong className="text-slate-300">{post.extraction_method || 'None'}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Human Review Action Panel & Merge */}
        <div className="space-y-6">
          {/* Human Review Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center">
              <ShieldCheck className="w-4 h-4 mr-2 text-emerald-400" />
              Human Review Label
            </h2>

            <div className="space-y-2">
              <div className="text-xs text-slate-400">Assign verified ground-truth label:</div>
              <div className="grid grid-cols-1 gap-1.5">
                {reviewButtons.map(btn => (
                  <button
                    key={btn.label}
                    id={`detail-label-${btn.label}`}
                    onClick={() => handleSetLabel(btn.label)}
                    disabled={saving}
                    className={`px-3 py-2 rounded text-xs font-medium text-left flex items-center justify-between transition-all ${
                      candidate.human_label === btn.label
                        ? `${btn.color} ring-2 ring-white/30 shadow`
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{btn.text}</span>
                    {candidate.human_label === btn.label && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Reviewer Notes */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-medium text-slate-300">Human Research Notes:</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Why did you validate or reject this candidate? e.g. 'Legitimate browser demo on itch, good audio design'..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-2 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={handleSaveNotes}
                disabled={saving}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-1.5 rounded border border-slate-700 transition-colors"
              >
                Save Notes
              </button>
            </div>
          </div>

          {/* Merge Candidate Panel (Section 29) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center">
              <GitMerge className="w-4 h-4 mr-2 text-purple-400" />
              Merge Candidate
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              If this entity represents a duplicate of another game candidate, merge its posts and evidence into the primary candidate.
            </p>

            <select
              value={selectedMergeTarget}
              onChange={e => setSelectedMergeTarget(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-2 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="">Select target candidate...</option>
              {allCandidates
                .filter(c => c.id !== candidate.id)
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.canonical_name} (score: {c.candidate_score})
                  </option>
                ))}
            </select>

            <button
              onClick={handleMerge}
              disabled={!selectedMergeTarget || saving}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs py-2 rounded font-medium transition-colors"
            >
              Merge into Selected Candidate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
