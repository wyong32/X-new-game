/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  GameCandidate,
  XPost,
  XQuery,
  CandidateHumanLabel,
  PostHumanLabel,
  AppSettings
} from './types.js';
import { Header } from './components/Header.js';
import { Dashboard } from './components/Dashboard.js';
import { CandidateList } from './components/CandidateList.js';
import { CandidateDetail } from './components/CandidateDetail.js';
import { PostExplorer } from './components/PostExplorer.js';
import { QueryManagement } from './components/QueryManagement.js';
import { QueryAnalytics } from './components/QueryAnalytics.js';
import { FeedbackAnalytics } from './components/FeedbackAnalytics.js';
import { SettingsModal } from './components/SettingsModal.js';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const [status, setStatus] = useState<any>(null);
  const [queries, setQueries] = useState<XQuery[]>([]);
  const [posts, setPosts] = useState<XPost[]>([]);
  const [candidates, setCandidates] = useState<GameCandidate[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Synchronize route from window.location.pathname or hash
  const syncRouteFromUrl = useCallback(() => {
    const path = window.location.pathname.replace(/^\//, '');
    const hash = window.location.hash.replace(/^#\/?/, '');
    const route = hash || path;

    if (route.startsWith('candidates/')) {
      const id = route.replace('candidates/', '');
      setCurrentTab('candidates');
      setSelectedCandidateId(id);
    } else if (route === 'candidates') {
      setCurrentTab('candidates');
      setSelectedCandidateId(null);
    } else if (route === 'posts') {
      setCurrentTab('posts');
      setSelectedCandidateId(null);
    } else if (route === 'queries') {
      setCurrentTab('queries');
      setSelectedCandidateId(null);
    } else if (route === 'analytics/queries' || route === 'analytics_queries') {
      setCurrentTab('analytics_queries');
      setSelectedCandidateId(null);
    } else if (route === 'analytics/feedback' || route === 'analytics_feedback') {
      setCurrentTab('analytics_feedback');
      setSelectedCandidateId(null);
    } else {
      setCurrentTab('dashboard');
      setSelectedCandidateId(null);
    }
  }, []);

  // Fetch all core datasets from server
  const loadData = useCallback(async () => {
    try {
      const [statusRes, queriesRes, postsRes, candidatesRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/queries'),
        fetch('/api/posts'),
        fetch('/api/candidates')
      ]);

      if (statusRes.ok) {
        const s = await statusRes.json();
        setStatus(s);
        setSettings(s.settings);
      }
      if (queriesRes.ok) {
        setQueries(await queriesRes.json());
      }
      if (postsRes.ok) {
        setPosts(await postsRes.json());
      }
      if (candidatesRes.ok) {
        setCandidates(await candidatesRes.json());
      }
    } catch (err) {
      console.error('Failed to load discovery lab data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    syncRouteFromUrl();

    const handlePopState = () => {
      syncRouteFromUrl();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadData, syncRouteFromUrl]);

  // Navigate tab & update URL history
  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    setSelectedCandidateId(null);

    let path = '/';
    if (tab === 'candidates') path = '/candidates';
    else if (tab === 'posts') path = '/posts';
    else if (tab === 'queries') path = '/queries';
    else if (tab === 'analytics_queries') path = '/analytics/queries';
    else if (tab === 'analytics_feedback') path = '/analytics/feedback';

    window.history.pushState(null, '', path);
  };

  const handleSelectCandidate = (id: string) => {
    setSelectedCandidateId(id);
    window.history.pushState(null, '', `/candidates/${id}`);
  };

  const handleBackToCandidates = () => {
    setSelectedCandidateId(null);
    window.history.pushState(null, '', '/candidates');
  };

  // Label update handlers
  const handleUpdateCandidateLabel = async (id: string, label: CandidateHumanLabel) => {
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ human_label: label })
      });
      if (res.ok) {
        showToast(`Candidate marked as "${label}". Query precision updated.`);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to update candidate label:', err);
    }
  };

  const handleUpdateCandidate = async (id: string, partial: Partial<GameCandidate>) => {
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial)
      });
      if (res.ok) {
        showToast('Candidate changes saved.');
        await loadData();
      }
    } catch (err) {
      console.error('Failed to update candidate:', err);
    }
  };

  const handleMergeCandidate = async (sourceId: string, targetId: string) => {
    try {
      const res = await fetch(`/api/candidates/${sourceId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId })
      });
      if (res.ok) {
        showToast('Candidates successfully merged.');
        await loadData();
      }
    } catch (err) {
      console.error('Failed to merge candidate:', err);
    }
  };

  const handleUpdatePostLabel = async (postId: string, label: PostHumanLabel) => {
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ human_post_label: label })
      });
      if (res.ok) {
        showToast(`Post marked as "${label}".`);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to update post label:', err);
    }
  };

  // Query Execution Handlers
  const handleRunQuery = async (queryId: string) => {
    setOperating(true);
    try {
      const res = await fetch(`/api/queries/${queryId}/run`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        showToast(
          `Query run complete: +${result.posts_fetched} posts, ${result.posts_passed} passed, +${result.candidates_created} candidates.`
        );
        await loadData();
      } else {
        const err = await res.json();
        showToast(`Run failed: ${err.error}`);
      }
    } catch (err: any) {
      showToast(`Run failed: ${err.message}`);
    } finally {
      setOperating(false);
    }
  };

  const handleRunBatch = async (filter: 'P1' | 'ENABLED' | 'DUE') => {
    setOperating(true);
    try {
      const res = await fetch('/api/queries/run-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter })
      });
      if (res.ok) {
        const json = await res.json();
        const totalFetched = json.results.reduce((acc: number, r: any) => acc + r.posts_fetched, 0);
        const totalCands = json.results.reduce((acc: number, r: any) => acc + r.candidates_created, 0);
        showToast(
          `Batch complete: ${json.results.length} queries executed. Fetched ${totalFetched} posts, generated ${totalCands} candidates.`
        );
        await loadData();
      }
    } catch (err: any) {
      showToast(`Batch failed: ${err.message}`);
    } finally {
      setOperating(false);
    }
  };

  const handleToggleQuery = async (queryId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/queries/${queryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        showToast(`Query ${enabled ? 'enabled' : 'disabled'}.`);
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetQueryStats = async (queryId: string) => {
    try {
      const res = await fetch(`/api/queries/${queryId}/reset`, { method: 'POST' });
      if (res.ok) {
        showToast('Query statistics reset.');
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddQuery = async (queryData: Partial<XQuery>) => {
    try {
      const res = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryData)
      });
      if (res.ok) {
        showToast('New query approved and added to matrix.');
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetAndSeed = async () => {
    try {
      const res = await fetch('/api/reset-and-seed', { method: 'POST' });
      if (res.ok) {
        showToast('Database reset and mock pipeline completed.');
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      {/* Top Navigation & App Bar */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        mode={status?.mode || 'mock'}
        onOpenSettings={() => setShowSettings(true)}
        onQuickRunP1={() => handleRunBatch('P1')}
        isOperating={operating}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {loading ? (
          <div className="py-24 text-center text-slate-500">
            <div className="animate-spin inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full mb-3" />
            <div className="text-sm font-medium text-slate-300">Loading X Game Discovery Lab...</div>
          </div>
        ) : (
          <>
            {/* View Switching */}
            {selectedCandidateId ? (
              <CandidateDetail
                candidateId={selectedCandidateId}
                onBack={handleBackToCandidates}
                onUpdateCandidate={handleUpdateCandidate}
                onMergeCandidate={handleMergeCandidate}
                allCandidates={candidates}
              />
            ) : currentTab === 'dashboard' ? (
              <Dashboard
                status={status}
                candidates={candidates}
                queries={queries}
                onSelectCandidate={handleSelectCandidate}
                onNavigateTab={handleSelectTab}
                onUpdateLabel={handleUpdateCandidateLabel}
              />
            ) : currentTab === 'candidates' ? (
              <CandidateList
                candidates={candidates}
                onSelectCandidate={handleSelectCandidate}
                onUpdateLabel={handleUpdateCandidateLabel}
                isLoading={operating}
              />
            ) : currentTab === 'posts' ? (
              <PostExplorer
                posts={posts}
                queries={queries}
                onUpdatePostLabel={handleUpdatePostLabel}
                onSelectCandidate={handleSelectCandidate}
              />
            ) : currentTab === 'queries' ? (
              <QueryManagement
                queries={queries}
                onRunQuery={handleRunQuery}
                onRunBatch={handleRunBatch}
                onToggleQuery={handleToggleQuery}
                onResetQueryStats={handleResetQueryStats}
                onAddQuery={handleAddQuery}
                isOperating={operating}
              />
            ) : currentTab === 'analytics_queries' ? (
              <QueryAnalytics onSelectQueryFilter={qId => handleSelectTab('queries')} />
            ) : currentTab === 'analytics_feedback' ? (
              <FeedbackAnalytics />
            ) : null}
          </>
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-700 text-slate-100 px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Settings Modal */}
      {settings && (
        <SettingsModal
          settings={settings}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onUpdateSettings={handleUpdateSettings}
          onResetAndSeed={handleResetAndSeed}
        />
      )}
    </div>
  );
}
