import React, { useEffect, useState } from 'react';
import {
  FlaskConical,
  BarChart2,
  CheckCircle2,
  TrendingUp,
  Award,
  Layers,
  HelpCircle
} from 'lucide-react';

export const FeedbackAnalytics: React.FC = () => {
  const [data, setData] = useState<{
    total_reviewed: number;
    calibration: {
      bucket: string;
      total_candidates: number;
      valid_games: number;
      valuable_new: number;
      valid_rate_pct: number;
      valuable_rate_pct: number;
    }[];
    extractionStats: {
      method: string;
      total: number;
      valid: number;
      precision_pct: number;
    }[];
    labelCounts: Record<string, number>;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/feedback')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full mb-2" />
        <div>Computing feedback analytics and score calibration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
          <FlaskConical className="w-5 h-5 text-purple-400" />
          <span>Score Calibration & Method Precision</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Validates that higher algorithm scores directly translate to higher human validation accuracy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: Score Calibration Buckets (Section 50) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-emerald-400" />
              Score Calibration Buckets
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              {data.total_reviewed} Annotated Candidates
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
              <thead className="bg-slate-800/80 text-[10px] text-slate-400 uppercase font-mono">
                <tr>
                  <th className="py-2 px-3">Score Bucket</th>
                  <th className="py-2 px-3">Reviewed</th>
                  <th className="py-2 px-3">Valid Games</th>
                  <th className="py-2 px-3">Valid %</th>
                  <th className="py-2 px-3 text-right">Valuable New %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {data.calibration.map(b => (
                  <tr key={b.bucket} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-white">{b.bucket}</td>
                    <td className="py-2.5 px-3">{b.total_candidates}</td>
                    <td className="py-2.5 px-3 text-sky-300">{b.valid_games}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          b.valid_rate_pct >= 75
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : b.valid_rate_pct >= 50
                            ? 'text-sky-400 bg-sky-500/10'
                            : 'text-slate-400'
                        }`}
                      >
                        {b.valid_rate_pct}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          b.valuable_rate_pct >= 50
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-slate-400'
                        }`}
                      >
                        {b.valuable_rate_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Extraction Method Precision (Section 51) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center">
              <Award className="w-4 h-4 mr-2 text-sky-400" />
              Extraction Method Precision
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">Hierarchy Performance</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
              <thead className="bg-slate-800/80 text-[10px] text-slate-400 uppercase font-mono">
                <tr>
                  <th className="py-2 px-3">Method</th>
                  <th className="py-2 px-3">Reviewed</th>
                  <th className="py-2 px-3">Valid Games</th>
                  <th className="py-2 px-3 text-right">Precision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {data.extractionStats.map(m => (
                  <tr key={m.method} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-white">{m.method}</td>
                    <td className="py-2.5 px-3">{m.total}</td>
                    <td className="py-2.5 px-3 text-sky-300">{m.valid}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          m.precision_pct >= 80
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : m.precision_pct >= 50
                            ? 'text-sky-400 bg-sky-500/10'
                            : 'text-amber-400 bg-amber-500/10'
                        }`}
                      >
                        {m.precision_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Label Counts Breakdown */}
          <div className="pt-3 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-300 mb-2">Ground-Truth Label Distribution:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(data.labelCounts).map(([lbl, count]) => (
                <div key={lbl} className="bg-slate-800/60 p-2 rounded flex items-center justify-between">
                  <span className="text-slate-300 text-[11px] truncate max-w-[140px]">{lbl}</span>
                  <span className="font-mono font-bold text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
