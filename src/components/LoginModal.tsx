import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Please verify password.');
      }

      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400 mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            X Game Discovery Lab
          </h1>
          <p className="text-xs text-slate-400">
            Private Access Guard • LIVE Experimentation Lab
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-slate-300 text-xs font-medium font-mono uppercase tracking-wider">
              Lab Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter lab password..."
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-sky-500 font-mono transition-colors"
            />
            <p className="text-[11px] text-slate-500">
              Authentication password configured in server environment variable <code className="text-slate-400 font-mono">APP_PASSWORD</code>.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <span>{loading ? 'Verifying...' : 'Unlock Lab Access'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Protected Endpoint Guard</span>
          </span>
          <span className="font-mono text-slate-400">Security: HttpOnly Cookie</span>
        </div>
      </div>
    </div>
  );
};
